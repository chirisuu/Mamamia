import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables, TablesInsert, TablesUpdate } from "@/lib/db/database.types";
import { getFoodsByIds } from "@/lib/foods/search";
import { roundNutrients, scaleNutrients } from "@/lib/nutrition";
import { addItemsToMeal, getOrCreateMealLog } from "./log-items";
import type { LogItemInput } from "../schemas";
import type { MealType } from "../types";

/**
 * Operaciones del diario sobre registros ya existentes (editar cantidad, mover, duplicar,
 * copiar, plantillas, vaciar, favoritos). Reciben el cliente con la sesión del usuario: el RLS
 * sigue mandando y además se filtra por `user_id`, así un id ajeno simplemente "no existe".
 *
 * Todo lo que AGREGA ítems pasa por `addItemsToMeal` (nutrientes recalculados desde la base).
 * Solo los ítems cuyo alimento o receta ya no existe se copian tal cual (copia de servidor de una
 * fila que ya calculó el servidor), conservando su procedencia.
 */

type Client = SupabaseClient<Database>;
type ItemRow = Tables<"meal_log_items">;
type MealLogRow = Pick<Tables<"meal_logs">, "id" | "local_date" | "meal_type" | "custom_name">;

export type DiaryOpErrorCode = "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "DB_ERROR";

export class DiaryOpError extends Error {
  constructor(
    public code: DiaryOpErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DiaryOpError";
  }
}

export type MealTarget = { localDate: string; mealType: MealType; customName: string | null };

const round2 = (v: number) => Math.round(v * 100) / 100;
const num = (v: number | string | null | undefined): number | null => (v == null ? null : Number(v));

async function getOwnItem(supabase: Client, userId: string, itemId: string): Promise<ItemRow> {
  const { data, error } = await supabase.from("meal_log_items").select("*").eq("id", itemId).eq("user_id", userId).maybeSingle();
  if (error) throw new DiaryOpError("DB_ERROR", "No se pudo leer el registro.");
  if (!data) throw new DiaryOpError("NOT_FOUND", "Ese registro ya no existe.");
  return data;
}

async function getOwnMeal(supabase: Client, userId: string, mealLogId: string): Promise<MealLogRow> {
  const { data, error } = await supabase
    .from("meal_logs")
    .select("id, local_date, meal_type, custom_name")
    .eq("id", mealLogId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new DiaryOpError("DB_ERROR", "No se pudo leer la comida.");
  if (!data) throw new DiaryOpError("NOT_FOUND", "Esa comida ya no existe.");
  return data;
}

async function getMealItems(supabase: Client, userId: string, mealLogId: string): Promise<ItemRow[]> {
  const { data, error } = await supabase
    .from("meal_log_items")
    .select("*")
    .eq("meal_log_id", mealLogId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new DiaryOpError("DB_ERROR", "No se pudieron leer los alimentos de la comida.");
  return data ?? [];
}

/** Escala los valores guardados de un ítem (para manuales o ítems cuyo alimento ya no existe). */
function scaleStored(item: ItemRow, factor: number): TablesUpdate<"meal_log_items"> {
  const s = (v: number | null) => (v == null ? null : round2(Number(v) * factor));
  const micronutrients: Record<string, number> = {};
  const raw = item.micronutrients;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [code, value] of Object.entries(raw)) {
      if (typeof value === "number" && Number.isFinite(value)) micronutrients[code] = round2(value * factor);
    }
  }
  return {
    energy_kcal: round2(Number(item.energy_kcal) * factor),
    protein_g: round2(Number(item.protein_g) * factor),
    carbs_g: round2(Number(item.carbs_g) * factor),
    fat_g: round2(Number(item.fat_g) * factor),
    fiber_g: s(item.fiber_g),
    sugar_g: s(item.sugar_g),
    sodium_mg: s(item.sodium_mg),
    micronutrients,
  };
}

async function recipeNutritionMap(supabase: Client, recipeIds: string[]) {
  const map = new Map<string, Database["public"]["Views"]["recipe_nutrition"]["Row"]>();
  if (!recipeIds.length) return map;
  const { data, error } = await supabase.from("recipe_nutrition").select("*").in("recipe_id", [...new Set(recipeIds)]);
  if (error) throw new DiaryOpError("DB_ERROR", "No se pudo leer la nutrición de la receta.");
  for (const row of data ?? []) {
    if (row.recipe_id && row.per_serving_energy_kcal != null) map.set(row.recipe_id, row);
  }
  return map;
}

/* -------------------------------------------------------------------------- */
/* Editar cantidad                                                              */
/* -------------------------------------------------------------------------- */

export type UpdateQuantityData = {
  itemId: string;
  grams?: number;
  servings?: number;
  quantity?: number;
  unit?: string;
};

/**
 * Cambia la cantidad y recalcula en el servidor: alimentos desde `foods` (por 100 g), recetas
 * desde `recipe_nutrition` (por porción). Si el alimento o la receta ya no existen, o el ítem es
 * manual, se escalan sus propios valores en proporción.
 */
export async function updateItemQuantity(supabase: Client, userId: string, input: UpdateQuantityData): Promise<{ id: string }> {
  const item = await getOwnItem(supabase, userId, input.itemId);
  let patch: TablesUpdate<"meal_log_items"> | null = null;

  if (item.food_id && input.grams != null) {
    const food = (await getFoodsByIds(supabase, [item.food_id])).get(item.food_id);
    if (food) {
      const n = roundNutrients(scaleNutrients(food.per100g, input.grams));
      patch = {
        grams: input.grams,
        quantity: input.quantity ?? input.grams,
        unit: input.unit ?? "g",
        energy_kcal: n.energyKcal,
        protein_g: n.proteinG,
        carbs_g: n.carbsG,
        fat_g: n.fatG,
        fiber_g: n.fiberG,
        sugar_g: n.sugarG,
        sodium_mg: n.sodiumMg,
      };
    }
  } else if (item.recipe_id && (input.servings ?? input.quantity) != null) {
    const servings = (input.servings ?? input.quantity) as number;
    const ps = (await recipeNutritionMap(supabase, [item.recipe_id])).get(item.recipe_id);
    if (ps) {
      const r = (v: number | null) => (v == null ? null : round2(Number(v) * servings));
      patch = {
        quantity: servings,
        unit: servings === 1 ? "porción" : "porciones",
        grams: r(ps.per_serving_grams),
        energy_kcal: r(ps.per_serving_energy_kcal) ?? 0,
        protein_g: r(ps.per_serving_protein_g) ?? 0,
        carbs_g: r(ps.per_serving_carbs_g) ?? 0,
        fat_g: r(ps.per_serving_fat_g) ?? 0,
        fiber_g: ps.fiber_incomplete ? null : r(ps.per_serving_fiber_g),
      };
    }
  }

  if (!patch) {
    // Manual o huérfano: escala lo guardado.
    const oldGrams = num(item.grams);
    const oldQty = Number(item.quantity);
    const newQty = input.quantity ?? input.servings;
    let factor: number | null = null;
    if (input.grams != null && oldGrams && oldGrams > 0) factor = input.grams / oldGrams;
    else if (newQty != null && oldQty > 0) factor = newQty / oldQty;
    if (factor == null || !Number.isFinite(factor) || factor <= 0) {
      throw new DiaryOpError("VALIDATION", "Indica la nueva cantidad.");
    }
    patch = {
      ...scaleStored(item, factor),
      grams: oldGrams ? round2(oldGrams * factor) : null,
      quantity: newQty ?? round2(oldQty * factor),
      unit: input.unit ?? item.unit,
    };
  }

  const { data, error } = await supabase
    .from("meal_log_items")
    .update(patch)
    .eq("id", item.id)
    .eq("user_id", userId)
    .select("id");
  if (error) throw new DiaryOpError("DB_ERROR", "No se pudo actualizar la cantidad.");
  if (!data?.length) throw new DiaryOpError("NOT_FOUND", "Ese registro ya no existe.");
  return { id: item.id };
}

/* -------------------------------------------------------------------------- */
/* Eliminar, mover, duplicar                                                    */
/* -------------------------------------------------------------------------- */

export async function deleteItem(supabase: Client, userId: string, itemId: string): Promise<{ localDate: string | null }> {
  const { data, error } = await supabase
    .from("meal_log_items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", userId)
    .select("id, meal_log_id");
  if (error) throw new DiaryOpError("DB_ERROR", "No se pudo eliminar.");
  if (!data?.length) throw new DiaryOpError("NOT_FOUND", "Ese registro ya no existe.");
  const { data: meal } = await supabase.from("meal_logs").select("local_date").eq("id", data[0]!.meal_log_id).maybeSingle();
  return { localDate: meal?.local_date ?? null };
}

export async function moveItem(
  supabase: Client,
  userId: string,
  input: { itemId: string; mealType: MealType; customName: string | null },
): Promise<{ localDate: string }> {
  const item = await getOwnItem(supabase, userId, input.itemId);
  const meal = await getOwnMeal(supabase, userId, item.meal_log_id);
  const customName = input.mealType === "custom" ? input.customName : null;
  if (meal.meal_type === input.mealType && (meal.custom_name ?? null) === customName) return { localDate: meal.local_date };
  const targetId = await getOrCreateMealLog(supabase, userId, meal.local_date, input.mealType, customName);
  const { data, error } = await supabase
    .from("meal_log_items")
    .update({ meal_log_id: targetId })
    .eq("id", item.id)
    .eq("user_id", userId)
    .select("id");
  if (error) throw new DiaryOpError("DB_ERROR", "No se pudo mover.");
  if (!data?.length) throw new DiaryOpError("NOT_FOUND", "Ese registro ya no existe.");
  return { localDate: meal.local_date };
}

/**
 * Copia ítems a una comida destino. Alimentos y recetas vigentes pasan por `addItemsToMeal`
 * (recalcula desde la base); los manuales se registran otra vez como manuales; los que perdieron
 * su alimento/receta se copian tal cual con su procedencia original.
 */
export async function copyItemsTo(
  supabase: Client,
  userId: string,
  items: readonly ItemRow[],
  target: MealTarget,
  source: "copy" | "template" = "copy",
): Promise<{ copied: number }> {
  if (!items.length) return { copied: 0 };
  const foods = await getFoodsByIds(
    supabase,
    items.flatMap((i) => (i.food_id && i.grams ? [i.food_id] : [])),
  );
  const recipes = await recipeNutritionMap(
    supabase,
    items.flatMap((i) => (i.recipe_id ? [i.recipe_id] : [])),
  );

  const inputs: LogItemInput[] = [];
  const snapshots: ItemRow[] = [];
  for (const item of items) {
    const grams = num(item.grams);
    if (item.food_id && grams && grams <= 5000 && foods.has(item.food_id)) {
      inputs.push({
        kind: "food",
        foodId: item.food_id,
        grams,
        quantity: Number(item.quantity) <= 10000 ? Number(item.quantity) : grams,
        unit: item.unit.slice(0, 30),
        source,
        isEstimate: item.is_estimate || undefined,
        confidence: item.confidence ?? undefined,
      });
    } else if (item.recipe_id && recipes.has(item.recipe_id) && Number(item.quantity) > 0 && Number(item.quantity) <= 20) {
      inputs.push({ kind: "recipe", recipeId: item.recipe_id, servings: Number(item.quantity), source });
    } else if (!item.food_id && !item.recipe_id && item.data_provenance === "user_entered") {
      inputs.push({
        kind: "manual",
        name: item.name.slice(0, 120),
        energyKcal: Number(item.energy_kcal),
        proteinG: Number(item.protein_g),
        carbsG: Number(item.carbs_g),
        fatG: Number(item.fat_g),
        fiberG: num(item.fiber_g) ?? undefined,
        grams: grams ?? undefined,
        source: "manual",
      });
    } else {
      snapshots.push(item);
    }
  }

  let copied = 0;
  for (let i = 0; i < inputs.length; i += 30) {
    const chunk = inputs.slice(i, i + 30);
    const res = await addItemsToMeal(supabase, userId, {
      localDate: target.localDate,
      mealType: target.mealType,
      customName: target.customName,
      items: chunk,
    });
    copied += res.itemIds.length;
  }

  if (snapshots.length) {
    const mealLogId = await getOrCreateMealLog(supabase, userId, target.localDate, target.mealType, target.customName);
    const rows: TablesInsert<"meal_log_items">[] = snapshots.map((s) => ({
      meal_log_id: mealLogId,
      user_id: userId,
      food_id: null,
      recipe_id: null,
      name: s.name,
      brand_name: s.brand_name,
      quantity: s.quantity,
      unit: s.unit,
      grams: s.grams,
      energy_kcal: s.energy_kcal,
      protein_g: s.protein_g,
      carbs_g: s.carbs_g,
      fat_g: s.fat_g,
      fiber_g: s.fiber_g,
      sugar_g: s.sugar_g,
      sodium_mg: s.sodium_mg,
      micronutrients: s.micronutrients,
      source: "copy",
      data_provenance: s.data_provenance,
      confidence: s.confidence,
      is_estimate: s.is_estimate,
    }));
    const { data, error } = await supabase.from("meal_log_items").insert(rows).select("id");
    if (error) throw new DiaryOpError("DB_ERROR", "No se pudo copiar.");
    copied += data?.length ?? 0;
  }
  return { copied };
}

export async function duplicateItem(supabase: Client, userId: string, itemId: string): Promise<{ localDate: string; copied: number }> {
  const item = await getOwnItem(supabase, userId, itemId);
  const meal = await getOwnMeal(supabase, userId, item.meal_log_id);
  const res = await copyItemsTo(supabase, userId, [item], {
    localDate: meal.local_date,
    mealType: meal.meal_type,
    customName: meal.custom_name,
  });
  return { localDate: meal.local_date, copied: res.copied };
}

/* -------------------------------------------------------------------------- */
/* Acciones de comida                                                           */
/* -------------------------------------------------------------------------- */

/** Copia la comida completa a otro día (misma comida: desayuno → desayuno, "Post entreno" → "Post entreno"). */
export async function copyMealToDate(
  supabase: Client,
  userId: string,
  input: { mealLogId: string; targetDate: string },
): Promise<{ copied: number; sourceDate: string }> {
  const meal = await getOwnMeal(supabase, userId, input.mealLogId);
  const items = await getMealItems(supabase, userId, meal.id);
  if (!items.length) throw new DiaryOpError("VALIDATION", "Esta comida no tiene nada para copiar.");
  const res = await copyItemsTo(supabase, userId, items, {
    localDate: input.targetDate,
    mealType: meal.meal_type,
    customName: meal.custom_name,
  });
  return { copied: res.copied, sourceDate: meal.local_date };
}

/** Vacía la comida. Las estándar desaparecen; las personalizadas quedan (vacías) para seguir usándolas. */
export async function clearMeal(supabase: Client, userId: string, mealLogId: string): Promise<{ removed: number; localDate: string }> {
  const meal = await getOwnMeal(supabase, userId, mealLogId);
  const { data, error } = await supabase
    .from("meal_log_items")
    .delete()
    .eq("meal_log_id", meal.id)
    .eq("user_id", userId)
    .select("id");
  if (error) throw new DiaryOpError("DB_ERROR", "No se pudo vaciar la comida.");
  if (meal.meal_type !== "custom") {
    await supabase.from("meal_logs").delete().eq("id", meal.id).eq("user_id", userId);
  }
  return { removed: data?.length ?? 0, localDate: meal.local_date };
}

export async function createCustomMeal(
  supabase: Client,
  userId: string,
  input: { localDate: string; name: string },
): Promise<{ id: string }> {
  const name = input.name.trim();
  const { data, error } = await supabase
    .from("meal_logs")
    .insert({ user_id: userId, local_date: input.localDate, meal_type: "custom", custom_name: name })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw new DiaryOpError("CONFLICT", "Ya tienes una comida con ese nombre ese día.");
    throw new DiaryOpError("DB_ERROR", "No se pudo crear la comida.");
  }
  return { id: data.id };
}

export async function deleteCustomMeal(supabase: Client, userId: string, mealLogId: string): Promise<{ localDate: string }> {
  const { data, error } = await supabase
    .from("meal_logs")
    .delete()
    .eq("id", mealLogId)
    .eq("user_id", userId)
    .eq("meal_type", "custom")
    .select("local_date");
  if (error) throw new DiaryOpError("DB_ERROR", "No se pudo eliminar la comida.");
  if (!data?.length) throw new DiaryOpError("NOT_FOUND", "Esa comida ya no existe.");
  return { localDate: data[0]!.local_date };
}

/* -------------------------------------------------------------------------- */
/* Plantillas                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Guarda una comida como plantilla. Solo se guardan ítems con alimento o receta de la base
 * (`meal_template_items` exige uno de los dos); los manuales se informan como omitidos.
 */
export async function saveMealAsTemplate(
  supabase: Client,
  userId: string,
  input: { mealLogId: string; name: string },
): Promise<{ templateId: string; saved: number; skipped: number }> {
  const meal = await getOwnMeal(supabase, userId, input.mealLogId);
  const items = await getMealItems(supabase, userId, meal.id);
  const usable = items.filter((i) => (i.food_id && num(i.grams)) || (i.recipe_id && Number(i.quantity) > 0));
  if (!usable.length) {
    throw new DiaryOpError("VALIDATION", "Esta comida no tiene alimentos de la base para guardar como plantilla.");
  }
  const { data: tpl, error } = await supabase
    .from("meal_templates")
    .insert({ user_id: userId, name: input.name.trim(), meal_type: meal.meal_type })
    .select("id")
    .single();
  if (error || !tpl) throw new DiaryOpError("DB_ERROR", "No se pudo guardar la plantilla.");

  const rows: TablesInsert<"meal_template_items">[] = usable.map((i, position) =>
    i.food_id
      ? { template_id: tpl.id, user_id: userId, food_id: i.food_id, grams: num(i.grams), position }
      : { template_id: tpl.id, user_id: userId, recipe_id: i.recipe_id, servings: Number(i.quantity), position },
  );
  const { error: itemsError } = await supabase.from("meal_template_items").insert(rows);
  if (itemsError) {
    await supabase.from("meal_templates").delete().eq("id", tpl.id).eq("user_id", userId);
    throw new DiaryOpError("DB_ERROR", "No se pudo guardar la plantilla.");
  }
  return { templateId: tpl.id, saved: rows.length, skipped: items.length - rows.length };
}

/** Aplica una plantilla a una comida: registra sus ítems recalculados desde la base. */
export async function applyTemplate(
  supabase: Client,
  userId: string,
  input: { templateId: string } & MealTarget,
): Promise<{ added: number; skipped: number }> {
  const { data: tpl, error } = await supabase
    .from("meal_templates")
    .select("id, meal_template_items(food_id, recipe_id, grams, servings, position)")
    .eq("id", input.templateId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new DiaryOpError("DB_ERROR", "No se pudo leer la plantilla.");
  if (!tpl) throw new DiaryOpError("NOT_FOUND", "Esa plantilla ya no existe.");
  const rows = [...(tpl.meal_template_items ?? [])].sort((a, b) => a.position - b.position);

  const foods = await getFoodsByIds(supabase, rows.flatMap((r) => (r.food_id ? [r.food_id] : [])));
  const recipes = await recipeNutritionMap(supabase, rows.flatMap((r) => (r.recipe_id ? [r.recipe_id] : [])));
  const inputs: LogItemInput[] = [];
  for (const r of rows) {
    const grams = num(r.grams);
    const servings = num(r.servings);
    if (r.food_id && grams && grams <= 5000 && foods.has(r.food_id)) {
      inputs.push({ kind: "food", foodId: r.food_id, grams, source: "template" });
    } else if (r.recipe_id && servings && servings <= 20 && recipes.has(r.recipe_id)) {
      inputs.push({ kind: "recipe", recipeId: r.recipe_id, servings, source: "template" });
    }
  }
  if (!inputs.length) throw new DiaryOpError("NOT_FOUND", "Los alimentos de esta plantilla ya no están disponibles.");
  let added = 0;
  for (let i = 0; i < inputs.length; i += 30) {
    const res = await addItemsToMeal(supabase, userId, {
      localDate: input.localDate,
      mealType: input.mealType,
      customName: input.customName,
      items: inputs.slice(i, i + 30),
    });
    added += res.itemIds.length;
  }
  return { added, skipped: rows.length - inputs.length };
}

export async function deleteTemplate(supabase: Client, userId: string, templateId: string): Promise<void> {
  const { data, error } = await supabase.from("meal_templates").delete().eq("id", templateId).eq("user_id", userId).select("id");
  if (error) throw new DiaryOpError("DB_ERROR", "No se pudo eliminar la plantilla.");
  if (!data?.length) throw new DiaryOpError("NOT_FOUND", "Esa plantilla ya no existe.");
}

/* -------------------------------------------------------------------------- */
/* Favoritos                                                                    */
/* -------------------------------------------------------------------------- */

export async function setFavoriteFood(
  supabase: Client,
  userId: string,
  input: { foodId: string; favorite: boolean },
): Promise<{ favorite: boolean }> {
  if (!input.favorite) {
    const { error } = await supabase.from("user_favorites").delete().eq("user_id", userId).eq("food_id", input.foodId);
    if (error) throw new DiaryOpError("DB_ERROR", "No se pudo quitar de favoritos.");
    return { favorite: false };
  }
  const { data: food } = await supabase.from("foods").select("id").eq("id", input.foodId).maybeSingle();
  if (!food) throw new DiaryOpError("NOT_FOUND", "Ese alimento ya no está disponible.");
  const { error } = await supabase.from("user_favorites").insert({ user_id: userId, food_id: input.foodId });
  if (error && error.code !== "23505") throw new DiaryOpError("DB_ERROR", "No se pudo guardar en favoritos.");
  return { favorite: true };
}
