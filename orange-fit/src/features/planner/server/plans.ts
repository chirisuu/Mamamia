import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, TablesInsert } from "@/lib/db/database.types";
import { getFoodsByIds } from "@/lib/foods/search";
import { roundNutrients, scaleNutrients } from "@/lib/nutrition";
import { addItemsToMeal } from "@/features/diary/server/log-items";
import { itemPosition, MAX_ITEMS_PER_SLOT, parsePlanParams, planSlots, slotFromPosition } from "../lib/plan";
import {
  addRecipeToPlanSchema,
  logPlanItemSchema,
  savePlanSchema,
  type AddRecipeToPlanInput,
  type LogPlanItemInput,
  type SavePlanInput,
} from "../schemas";

type Client = SupabaseClient<Database>;
type ItemInsert = TablesInsert<"meal_plan_items">;

export class PlanOpError extends Error {
  constructor(
    public code: "NOT_FOUND" | "FORBIDDEN" | "VALIDATION" | "DB_ERROR" | "BLOCKED",
    message: string,
  ) {
    super(message);
  }
}

const r2 = (v: number) => Math.round(v * 100) / 100;

interface ItemRef {
  dayIndex: number;
  slotIndex: number;
  mealType: Database["public"]["Enums"]["meal_type"];
  recipeId?: string | null;
  foodId?: string | null;
  servings?: number | null;
  grams?: number | null;
  position: number;
}

/**
 * Nutrientes de los ítems calculados en el SERVIDOR (nunca se confía en lo que manda el cliente):
 * recetas desde `recipe_nutrition` por porción, alimentos desde `foods` por 100 g. RLS decide qué
 * recetas y alimentos son visibles; uno no visible es NOT_FOUND.
 */
export async function buildItemRows(supabase: Client, userId: string, planId: string, items: readonly ItemRef[]): Promise<ItemInsert[]> {
  const recipeIds = [...new Set(items.flatMap((i) => (i.recipeId ? [i.recipeId] : [])))];
  const foodIds = [...new Set(items.flatMap((i) => (i.foodId ? [i.foodId] : [])))];
  const nutrition = new Map<string, Database["public"]["Views"]["recipe_nutrition"]["Row"]>();
  if (recipeIds.length) {
    const [{ data: visible }, { data: ns, error }] = await Promise.all([
      supabase.from("recipes").select("id, status, is_public, owner_id").in("id", recipeIds),
      supabase.from("recipe_nutrition").select("*").in("recipe_id", recipeIds),
    ]);
    if (error) throw new PlanOpError("DB_ERROR", "No se pudo calcular la nutrición de las recetas.");
    // Solo recetas del catálogo o propias (no borradores ajenos aunque el staff los vea).
    const allowed = new Set((visible ?? []).filter((r) => (r.status === "published" && r.is_public) || r.owner_id === userId).map((r) => r.id));
    for (const n of ns ?? []) if (n.recipe_id && allowed.has(n.recipe_id)) nutrition.set(n.recipe_id, n);
  }
  const foods = await getFoodsByIds(supabase, foodIds);

  return items.map((item) => {
    const base = {
      plan_id: planId,
      user_id: userId,
      day_index: item.dayIndex,
      meal_type: item.mealType,
      position: item.position,
    };
    if (item.recipeId) {
      const n = nutrition.get(item.recipeId);
      if (!n || n.per_serving_energy_kcal == null || !n.ingredients_count) {
        throw new PlanOpError("NOT_FOUND", "Una de las recetas del plan ya no está disponible. Cámbiala o quítala.");
      }
      const k = item.servings ?? 1;
      return {
        ...base,
        recipe_id: item.recipeId,
        food_id: null,
        servings: k,
        grams: null,
        energy_kcal: r2(Number(n.per_serving_energy_kcal) * k),
        protein_g: r2(Number(n.per_serving_protein_g ?? 0) * k),
        carbs_g: r2(Number(n.per_serving_carbs_g ?? 0) * k),
        fat_g: r2(Number(n.per_serving_fat_g ?? 0) * k),
      };
    }
    const food = item.foodId ? foods.get(item.foodId) : undefined;
    if (!food) throw new PlanOpError("NOT_FOUND", "Uno de los alimentos del plan ya no está disponible. Quítalo.");
    const n = roundNutrients(scaleNutrients(food.per100g, item.grams ?? 0));
    return {
      ...base,
      recipe_id: null,
      food_id: food.id,
      servings: null,
      grams: item.grams ?? null,
      energy_kcal: n.energyKcal,
      protein_g: n.proteinG,
      carbs_g: n.carbsG,
      fat_g: n.fatG,
    };
  });
}

/**
 * Crea o actualiza un plan con todos sus ítems. Al actualizar, inserta los ítems nuevos y luego
 * borra los anteriores: si algo falla a mitad, el plan no se queda vacío.
 */
export async function savePlan(
  supabase: Client,
  userId: string,
  raw: SavePlanInput,
  opts: { autoPlansBlocked: boolean },
): Promise<{ id: string; itemsCount: number }> {
  const parsed = savePlanSchema.safeParse(raw);
  if (!parsed.success) throw new PlanOpError("VALIDATION", "Revisa los datos del plan.");
  const input = parsed.data;
  if (input.generator === "engine" && opts.autoPlansBlocked && !input.planId) {
    throw new PlanOpError("BLOCKED", "Por tu perfil de salud, los planes automáticos necesitan revisión de un profesional. Puedes armar tu plan a mano.");
  }
  const slots = planSlots(input.params.mealsPerDay);
  const counters = new Map<string, number>();
  const refs: ItemRef[] = input.items.map((it) => {
    const slot = slots[it.slotIndex];
    if (!slot) throw new PlanOpError("VALIDATION", "Hay una comida en un horario que no existe en el plan.");
    const k = `${it.dayIndex}:${it.slotIndex}`;
    const order = counters.get(k) ?? 0;
    if (order >= MAX_ITEMS_PER_SLOT) throw new PlanOpError("VALIDATION", `Máximo ${MAX_ITEMS_PER_SLOT} elementos por comida.`);
    counters.set(k, order + 1);
    return { ...it, mealType: slot.mealType, position: itemPosition(it.slotIndex, order) };
  });

  const planFields = {
    name: input.name,
    start_date: input.startDate,
    days: input.days,
    generator: input.generator,
    params: input.params as unknown as NonNullable<Json>,
  };

  let planId: string;
  let previousIds: string[] = [];
  if (input.planId) {
    const { data: existing } = await supabase.from("meal_plans").select("id").eq("id", input.planId).eq("user_id", userId).maybeSingle();
    if (!existing) throw new PlanOpError("NOT_FOUND", "No encontramos ese plan.");
    planId = existing.id;
    const { error } = await supabase.from("meal_plans").update(planFields).eq("id", planId).eq("user_id", userId);
    if (error) throw new PlanOpError("DB_ERROR", "No se pudo guardar el plan.");
    const { data: old } = await supabase.from("meal_plan_items").select("id").eq("plan_id", planId).eq("user_id", userId);
    previousIds = (old ?? []).map((r) => r.id);
  } else {
    const { data, error } = await supabase
      .from("meal_plans")
      .insert({ ...planFields, user_id: userId, status: "draft" })
      .select("id")
      .single();
    if (error || !data) throw new PlanOpError("DB_ERROR", "No se pudo crear el plan.");
    planId = data.id;
  }

  try {
    const rows = await buildItemRows(supabase, userId, planId, refs);
    if (rows.length) {
      const { error } = await supabase.from("meal_plan_items").insert(rows);
      if (error) throw new PlanOpError("DB_ERROR", "No se pudieron guardar las comidas del plan.");
    }
  } catch (e) {
    if (!input.planId) await supabase.from("meal_plans").delete().eq("id", planId).eq("user_id", userId);
    throw e;
  }
  if (previousIds.length) {
    const { error } = await supabase.from("meal_plan_items").delete().in("id", previousIds).eq("user_id", userId);
    if (error) throw new PlanOpError("DB_ERROR", "Se guardó el plan, pero no se pudieron quitar las comidas anteriores. Vuelve a guardar.");
  }
  return { id: planId, itemsCount: refs.length };
}

/** Activar deja un solo plan activo: el que estaba activo pasa a archivados. */
export async function setPlanStatus(supabase: Client, userId: string, planId: string, status: "draft" | "active" | "archived"): Promise<{ archivedOthers: number }> {
  const { data: plan } = await supabase.from("meal_plans").select("id").eq("id", planId).eq("user_id", userId).maybeSingle();
  if (!plan) throw new PlanOpError("NOT_FOUND", "No encontramos ese plan.");
  let archivedOthers = 0;
  if (status === "active") {
    const { data: others, error } = await supabase
      .from("meal_plans")
      .update({ status: "archived" })
      .eq("user_id", userId)
      .eq("status", "active")
      .neq("id", planId)
      .select("id");
    if (error) throw new PlanOpError("DB_ERROR", "No se pudo activar el plan.");
    archivedOthers = others?.length ?? 0;
  }
  const { error } = await supabase.from("meal_plans").update({ status }).eq("id", planId).eq("user_id", userId);
  if (error) throw new PlanOpError("DB_ERROR", "No se pudo cambiar el estado del plan.");
  return { archivedOthers };
}

export async function deletePlan(supabase: Client, userId: string, planId: string): Promise<void> {
  const { data, error } = await supabase.from("meal_plans").delete().eq("id", planId).eq("user_id", userId).select("id");
  if (error) throw new PlanOpError("DB_ERROR", "No se pudo eliminar el plan.");
  if (!data?.length) throw new PlanOpError("NOT_FOUND", "No encontramos ese plan.");
}

/** Token aleatorio para compartir (32 caracteres hex, sin guiones). */
export function newShareToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Genera (o renueva) el enlace público del plan. Requiere consentimiento explícito (validado antes). */
export async function sharePlan(supabase: Client, userId: string, planId: string): Promise<{ token: string }> {
  const token = newShareToken();
  const { data, error } = await supabase
    .from("meal_plans")
    .update({ share_token: token, shared_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("user_id", userId)
    .select("id");
  if (error) throw new PlanOpError("DB_ERROR", "No se pudo generar el enlace.");
  if (!data?.length) throw new PlanOpError("NOT_FOUND", "No encontramos ese plan.");
  return { token };
}

export async function revokeShare(supabase: Client, userId: string, planId: string): Promise<void> {
  const { data, error } = await supabase
    .from("meal_plans")
    .update({ share_token: null, shared_at: null })
    .eq("id", planId)
    .eq("user_id", userId)
    .select("id");
  if (error) throw new PlanOpError("DB_ERROR", "No se pudo desactivar el enlace.");
  if (!data?.length) throw new PlanOpError("NOT_FOUND", "No encontramos ese plan.");
}

/** Agrega una receta a un hueco de un plan existente (desde el detalle de la receta). */
export async function addRecipeToPlan(supabase: Client, userId: string, raw: AddRecipeToPlanInput): Promise<{ planId: string }> {
  const input = addRecipeToPlanSchema.parse(raw);
  const { data: plan } = await supabase.from("meal_plans").select("id, days, status, params").eq("id", input.planId).eq("user_id", userId).maybeSingle();
  if (!plan) throw new PlanOpError("NOT_FOUND", "No encontramos ese plan.");
  if (plan.status === "archived") throw new PlanOpError("VALIDATION", "Ese plan está archivado. Elige otro o reactívalo.");
  if (input.dayIndex >= plan.days) throw new PlanOpError("VALIDATION", "Ese día no existe en el plan.");
  const slot = planSlots(parsePlanParams(plan.params).mealsPerDay)[input.slotIndex];
  if (!slot) throw new PlanOpError("VALIDATION", "Esa comida no existe en el plan.");
  const { data: existing } = await supabase.from("meal_plan_items").select("position").eq("plan_id", plan.id).eq("day_index", input.dayIndex);
  const used = (existing ?? []).filter((r) => slotFromPosition(r.position) === input.slotIndex).length;
  if (used >= MAX_ITEMS_PER_SLOT) throw new PlanOpError("VALIDATION", `Máximo ${MAX_ITEMS_PER_SLOT} elementos por comida.`);
  const [row] = await buildItemRows(supabase, userId, plan.id, [
    {
      dayIndex: input.dayIndex,
      slotIndex: input.slotIndex,
      mealType: slot.mealType,
      recipeId: input.recipeId,
      servings: input.servings,
      position: itemPosition(input.slotIndex, used),
    },
  ]);
  const { error } = await supabase.from("meal_plan_items").insert(row!);
  if (error) throw new PlanOpError("DB_ERROR", "No se pudo agregar la receta al plan.");
  return { planId: plan.id };
}

/** "Registrar esta comida": lleva un ítem del plan al diario (nutrientes recalculados desde la base). */
export async function logPlanItem(supabase: Client, userId: string, raw: LogPlanItemInput) {
  const input = logPlanItemSchema.parse(raw);
  const { data: item } = await supabase
    .from("meal_plan_items")
    .select("id, recipe_id, food_id, servings, grams")
    .eq("id", input.itemId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!item) throw new PlanOpError("NOT_FOUND", "Esa comida ya no está en el plan. Recarga la página.");
  if (item.recipe_id && item.servings != null) {
    return addItemsToMeal(supabase, userId, {
      localDate: input.localDate,
      mealType: input.mealType,
      items: [{ kind: "recipe", recipeId: item.recipe_id, servings: Number(item.servings), source: "plan" }],
    });
  }
  if (item.food_id && item.grams != null) {
    return addItemsToMeal(supabase, userId, {
      localDate: input.localDate,
      mealType: input.mealType,
      items: [{ kind: "food", foodId: item.food_id, grams: Number(item.grams), source: "plan" }],
    });
  }
  throw new PlanOpError("NOT_FOUND", "La receta o el alimento de esta comida ya no está disponible.");
}
