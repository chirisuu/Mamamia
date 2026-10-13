import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/lib/db/database.types";
import { getFoodsByIds } from "@/lib/foods/search";
import { roundNutrients, scaleNutrients } from "@/lib/nutrition";
import { addToMealSchema, type AddToMealInput } from "../schemas";

type Client = SupabaseClient<Database>;
type ItemInsert = TablesInsert<"meal_log_items">;

export class LogItemsError extends Error {
  constructor(
    public code: "NOT_FOUND" | "DB_ERROR" | "VALIDATION",
    message: string,
  ) {
    super(message);
  }
}

/** Busca o crea la comida del día (único por usuario + fecha + tipo + nombre personalizado). */
export async function getOrCreateMealLog(
  supabase: Client,
  userId: string,
  localDate: string,
  mealType: Database["public"]["Enums"]["meal_type"],
  customName: string | null,
): Promise<string> {
  let query = supabase.from("meal_logs").select("id").eq("user_id", userId).eq("local_date", localDate).eq("meal_type", mealType);
  query = customName ? query.eq("custom_name", customName) : query.is("custom_name", null);
  const { data: existing } = await query.maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from("meal_logs")
    .insert({ user_id: userId, local_date: localDate, meal_type: mealType, custom_name: customName })
    .select("id")
    .single();
  if (error) {
    // Carrera con otra pestaña: si ya existe, leerla.
    const { data: again } = await query.maybeSingle();
    if (again) return again.id;
    throw new LogItemsError("DB_ERROR", "No se pudo crear la comida.");
  }
  return data.id;
}

/**
 * Registra ítems en una comida. Única puerta de entrada al diario para búsqueda,
 * código de barras, IA, recetas y planes: calcula nutrientes en el servidor desde
 * `foods`/`recipe_nutrition`, guarda una copia con su procedencia y respeta RLS.
 */
export async function addItemsToMeal(supabase: Client, userId: string, rawInput: AddToMealInput) {
  const parsed = addToMealSchema.safeParse(rawInput);
  if (!parsed.success) throw new LogItemsError("VALIDATION", "Datos inválidos para registrar.");
  const input = parsed.data;

  const foodIds = input.items.flatMap((i) => (i.kind === "food" ? [i.foodId] : []));
  const recipeIds = input.items.flatMap((i) => (i.kind === "recipe" ? [i.recipeId] : []));
  const foods = await getFoodsByIds(supabase, foodIds);

  const recipes = new Map<string, { title: string; perServing: Database["public"]["Views"]["recipe_nutrition"]["Row"] }>();
  if (recipeIds.length) {
    const [{ data: rs }, { data: ns }] = await Promise.all([
      supabase.from("recipes").select("id, title").in("id", recipeIds),
      supabase.from("recipe_nutrition").select("*").in("recipe_id", recipeIds),
    ]);
    for (const r of rs ?? []) {
      const n = ns?.find((x) => x.recipe_id === r.id);
      if (n) recipes.set(r.id, { title: r.title, perServing: n });
    }
  }

  const mealLogId = await getOrCreateMealLog(supabase, userId, input.localDate, input.mealType, input.customName ?? null);

  const rows: ItemInsert[] = input.items.map((item) => {
    if (item.kind === "food") {
      const food = foods.get(item.foodId);
      if (!food) throw new LogItemsError("NOT_FOUND", "Uno de los alimentos ya no está disponible.");
      const n = roundNutrients(scaleNutrients(food.per100g, item.grams));
      return {
        meal_log_id: mealLogId,
        user_id: userId,
        food_id: food.id,
        name: food.name,
        brand_name: food.brandName,
        quantity: item.quantity ?? item.grams,
        unit: item.unit ?? "g",
        grams: item.grams,
        energy_kcal: n.energyKcal,
        protein_g: n.proteinG,
        carbs_g: n.carbsG,
        fat_g: n.fatG,
        fiber_g: n.fiberG,
        sugar_g: n.sugarG,
        sodium_mg: n.sodiumMg,
        source: item.source,
        data_provenance: `${food.source}:${food.verificationStatus}${food.sourceRef ? ` · ${food.sourceRef.slice(0, 160)}` : ""}`,
        ai_request_id: item.aiRequestId ?? null,
        confidence: item.confidence ?? null,
        is_estimate: item.isEstimate ?? false,
      };
    }
    if (item.kind === "recipe") {
      const recipe = recipes.get(item.recipeId);
      const ps = recipe?.perServing;
      if (!recipe || !ps || ps.per_serving_energy_kcal == null) {
        throw new LogItemsError("NOT_FOUND", "La receta no está disponible o no tiene ingredientes.");
      }
      const k = item.servings;
      const r2 = (v: number | null) => (v == null ? null : Math.round(v * k * 100) / 100);
      return {
        meal_log_id: mealLogId,
        user_id: userId,
        recipe_id: item.recipeId,
        name: recipe.title,
        quantity: item.servings,
        unit: item.servings === 1 ? "porción" : "porciones",
        grams: r2(ps.per_serving_grams),
        energy_kcal: r2(ps.per_serving_energy_kcal) ?? 0,
        protein_g: r2(ps.per_serving_protein_g) ?? 0,
        carbs_g: r2(ps.per_serving_carbs_g) ?? 0,
        fat_g: r2(ps.per_serving_fat_g) ?? 0,
        fiber_g: ps.fiber_incomplete ? null : r2(ps.per_serving_fiber_g),
        source: item.source,
        data_provenance: "recipe:calculated_from_ingredients",
        ai_request_id: item.aiRequestId ?? null,
        confidence: item.confidence ?? null,
        is_estimate: item.isEstimate ?? false,
      };
    }
    return {
      meal_log_id: mealLogId,
      user_id: userId,
      name: item.name,
      quantity: item.grams ?? 1,
      unit: item.grams ? "g" : "porción",
      grams: item.grams ?? null,
      energy_kcal: item.energyKcal,
      protein_g: item.proteinG,
      carbs_g: item.carbsG,
      fat_g: item.fatG,
      fiber_g: item.fiberG ?? null,
      source: "manual",
      data_provenance: "user_entered",
      is_estimate: true,
    };
  });

  const { data, error } = await supabase.from("meal_log_items").insert(rows).select("id");
  if (error) throw new LogItemsError("DB_ERROR", "No se pudo guardar el registro.");
  return { mealLogId, itemIds: (data ?? []).map((r) => r.id) };
}
