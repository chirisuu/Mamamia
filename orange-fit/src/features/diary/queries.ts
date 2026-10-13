import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/db/database.types";
import { getActiveTargets, type NutritionTargetRow } from "@/lib/data/targets";
import { getFoodsByIds } from "@/lib/foods/search";
import { toFoodSummary, type FoodSummary } from "@/lib/foods/types";
import { toPickerFood } from "./lib/picker-food";
import { buildMealSections, summarizeItems, type DayTotals } from "./lib/day-totals";
import { itemProvenance } from "./lib/provenance";
import type { DiaryItem, DiaryMeal, FoodPortion, PickerFood, TemplateSummary } from "./types";

/**
 * Lecturas del diario (Server Components). Reciben el cliente con la sesión del usuario: RLS
 * aplica y además se filtra por `user_id`.
 */

type Client = SupabaseClient<Database>;
type ItemRow = Tables<"meal_log_items">;

export class DiaryQueryError extends Error {
  constructor(message = "No pudimos cargar tus datos.") {
    super(message);
    this.name = "DiaryQueryError";
  }
}

export async function getPortionsByFoodIds(supabase: Client, ids: readonly string[]): Promise<Map<string, FoodPortion[]>> {
  const map = new Map<string, FoodPortion[]>();
  const unique = [...new Set(ids)];
  if (!unique.length) return map;
  const { data, error } = await supabase
    .from("food_portions")
    .select("id, food_id, label, quantity, unit, gram_weight, is_default")
    .in("food_id", unique)
    .order("is_default", { ascending: false })
    .order("gram_weight", { ascending: true });
  if (error) throw new DiaryQueryError();
  for (const p of data ?? []) {
    const list = map.get(p.food_id) ?? [];
    list.push({
      id: p.id,
      label: p.label,
      quantity: Number(p.quantity),
      unit: p.unit,
      gramWeight: Number(p.gram_weight),
      isDefault: p.is_default,
    });
    map.set(p.food_id, list);
  }
  return map;
}

export async function getFavoriteFoodIds(supabase: Client, userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("user_favorites").select("food_id").eq("user_id", userId).not("food_id", "is", null);
  if (error) throw new DiaryQueryError();
  return new Set((data ?? []).flatMap((r) => (r.food_id ? [r.food_id] : [])));
}

async function pickerFoods(supabase: Client, userId: string, ids: string[], favorites?: Set<string>): Promise<Map<string, PickerFood>> {
  const [foods, portions, favs] = await Promise.all([
    getFoodsByIds(supabase, ids),
    getPortionsByFoodIds(supabase, ids),
    favorites ? Promise.resolve(favorites) : getFavoriteFoodIds(supabase, userId),
  ]);
  const out = new Map<string, PickerFood>();
  for (const [id, food] of foods) out.set(id, toPickerFood(food, portions.get(id) ?? [], favs.has(id)));
  return out;
}

function toDiaryItem(row: ItemRow, foods: Map<string, PickerFood>, foodSummaries: Map<string, FoodSummary>, slugs: Map<string, string>): DiaryItem {
  const food = row.food_id ? (foods.get(row.food_id) ?? null) : null;
  const summary = row.food_id ? (foodSummaries.get(row.food_id) ?? null) : null;
  const prov = itemProvenance(
    {
      source: row.source,
      dataProvenance: row.data_provenance,
      isEstimate: row.is_estimate,
      confidence: row.confidence == null ? null : Number(row.confidence),
    },
    summary,
  );
  return {
    id: row.id,
    mealLogId: row.meal_log_id,
    kind: row.food_id ? "food" : row.recipe_id ? "recipe" : "manual",
    foodId: row.food_id,
    recipeId: row.recipe_id,
    recipeSlug: row.recipe_id ? (slugs.get(row.recipe_id) ?? null) : null,
    name: row.name,
    brandName: row.brand_name,
    quantity: Number(row.quantity),
    unit: row.unit,
    grams: row.grams == null ? null : Number(row.grams),
    energyKcal: Number(row.energy_kcal),
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
    fiberG: row.fiber_g == null ? null : Number(row.fiber_g),
    sugarG: row.sugar_g == null ? null : Number(row.sugar_g),
    sodiumMg: row.sodium_mg == null ? null : Number(row.sodium_mg),
    source: row.source,
    provenance: prov.label,
    isEstimate: prov.isEstimate,
    isAi: prov.isAi,
    food,
  };
}

/** Meta vigente en una fecha; si la fecha es anterior a la primera meta, se usa la primera. */
export async function getTargetForDate(supabase: Client, userId: string, date: string): Promise<NutritionTargetRow | null> {
  const active = await getActiveTargets(supabase, userId, date);
  if (active) return active;
  const { data } = await supabase
    .from("nutrition_targets")
    .select("*")
    .eq("user_id", userId)
    .order("effective_from", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}

export type DiaryDay = {
  date: string;
  meals: DiaryMeal[];
  totals: DayTotals;
  target: NutritionTargetRow | null;
};

export async function getDiaryDay(supabase: Client, userId: string, date: string): Promise<DiaryDay> {
  const { data: logs, error } = await supabase
    .from("meal_logs")
    .select("id, meal_type, custom_name, created_at, meal_log_items(*)")
    .eq("user_id", userId)
    .eq("local_date", date);
  if (error) throw new DiaryQueryError();
  const rows: ItemRow[] = (logs ?? [])
    .flatMap((l) => l.meal_log_items ?? [])
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));

  const foodIds = rows.flatMap((r) => (r.food_id ? [r.food_id] : []));
  const recipeIds = [...new Set(rows.flatMap((r) => (r.recipe_id ? [r.recipe_id] : [])))];
  const [summaries, portions, favorites, recipes, target] = await Promise.all([
    getFoodsByIds(supabase, foodIds),
    getPortionsByFoodIds(supabase, foodIds),
    getFavoriteFoodIds(supabase, userId),
    recipeIds.length
      ? supabase.from("recipes").select("id, slug").in("id", recipeIds)
      : Promise.resolve({ data: [] as { id: string; slug: string }[] }),
    getTargetForDate(supabase, userId, date),
  ]);
  const foods = new Map<string, PickerFood>();
  for (const [id, f] of summaries) foods.set(id, toPickerFood(f, portions.get(id) ?? [], favorites.has(id)));
  const slugs = new Map((recipes.data ?? []).map((r) => [r.id, r.slug] as const));
  const items = rows.map((r) => toDiaryItem(r, foods, summaries, slugs));
  const meals = buildMealSections(
    (logs ?? []).map((l) => ({ id: l.id, mealType: l.meal_type, customName: l.custom_name, createdAt: l.created_at })),
    items,
  );
  return { date, meals, totals: summarizeItems(items), target };
}

export type RecentFood = PickerFood & { lastGrams: number | null; lastQuantity: number | null; lastUnit: string | null };

/** Últimos alimentos distintos que registró el usuario (de la base, todavía visibles). */
export async function getRecentFoods(supabase: Client, userId: string, limit = 12): Promise<RecentFood[]> {
  const { data, error } = await supabase
    .from("meal_log_items")
    .select("food_id, grams, quantity, unit, created_at")
    .eq("user_id", userId)
    .not("food_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(150);
  if (error) throw new DiaryQueryError();
  const last = new Map<string, { grams: number | null; quantity: number; unit: string }>();
  for (const row of data ?? []) {
    if (!row.food_id || last.has(row.food_id)) continue;
    last.set(row.food_id, { grams: row.grams == null ? null : Number(row.grams), quantity: Number(row.quantity), unit: row.unit });
    if (last.size >= limit) break;
  }
  const ids = [...last.keys()];
  const foods = await pickerFoods(supabase, userId, ids);
  return ids.flatMap((id) => {
    const f = foods.get(id);
    const l = last.get(id)!;
    return f ? [{ ...f, lastGrams: l.grams, lastQuantity: l.quantity, lastUnit: l.unit }] : [];
  });
}

export async function getFavoriteFoods(supabase: Client, userId: string): Promise<PickerFood[]> {
  const { data, error } = await supabase
    .from("user_favorites")
    .select("food_id, created_at")
    .eq("user_id", userId)
    .not("food_id", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw new DiaryQueryError();
  const ids = (data ?? []).flatMap((r) => (r.food_id ? [r.food_id] : []));
  const foods = await pickerFoods(supabase, userId, ids, new Set(ids));
  return ids.flatMap((id) => (foods.has(id) ? [foods.get(id)!] : []));
}

export type FavoriteRecipe = { id: string; title: string; slug: string };

export async function getFavoriteRecipes(supabase: Client, userId: string): Promise<FavoriteRecipe[]> {
  const { data, error } = await supabase
    .from("user_favorites")
    .select("recipe_id, recipes(id, title, slug)")
    .eq("user_id", userId)
    .not("recipe_id", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw new DiaryQueryError();
  return (data ?? []).flatMap((r) => {
    const rec = r.recipes as { id: string; title: string; slug: string } | null;
    return rec ? [{ id: rec.id, title: rec.title, slug: rec.slug }] : [];
  });
}

export async function getTemplates(supabase: Client, userId: string): Promise<TemplateSummary[]> {
  const { data, error } = await supabase
    .from("meal_templates")
    .select("id, name, meal_type, meal_template_items(count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new DiaryQueryError();
  return (data ?? []).map((t) => {
    const agg = t.meal_template_items as unknown as Array<{ count: number }> | null;
    return { id: t.id, name: t.name, mealType: t.meal_type, itemsCount: agg?.[0]?.count ?? 0 };
  });
}

export type OwnFoodListItem = PickerFood & { barcode: string | null; updatedAt: string };

export async function getOwnFoods(supabase: Client, userId: string): Promise<OwnFoodListItem[]> {
  const { data, error } = await supabase
    .from("foods")
    .select("*, brands(name)")
    .eq("created_by", userId)
    .eq("is_public", false)
    .order("updated_at", { ascending: false });
  if (error) throw new DiaryQueryError();
  const rows = data ?? [];
  const ids = rows.map((r) => r.id);
  const [portions, favorites] = await Promise.all([getPortionsByFoodIds(supabase, ids), getFavoriteFoodIds(supabase, userId)]);
  return rows.map((row) => {
    const { brands, ...food } = row as typeof row & { brands: { name: string } | null };
    const summary = toFoodSummary(food, userId, brands?.name ?? null);
    return {
      ...toPickerFood(summary, portions.get(food.id) ?? [], favorites.has(food.id)),
      barcode: food.barcode,
      updatedAt: food.updated_at,
    };
  });
}

export type OwnFoodForEdit = {
  id: string;
  name: string;
  brandName: string | null;
  barcode: string | null;
  per100g: FoodSummary["per100g"];
  portions: FoodPortion[];
};

export async function getOwnFoodForEdit(supabase: Client, userId: string, foodId: string): Promise<OwnFoodForEdit | null> {
  const { data, error } = await supabase
    .from("foods")
    .select("*, brands(name)")
    .eq("id", foodId)
    .eq("created_by", userId)
    .eq("is_public", false)
    .maybeSingle();
  if (error) throw new DiaryQueryError();
  if (!data) return null;
  const { brands, ...food } = data as typeof data & { brands: { name: string } | null };
  const summary = toFoodSummary(food, userId, brands?.name ?? null);
  const portions = await getPortionsByFoodIds(supabase, [food.id]);
  return {
    id: food.id,
    name: food.name,
    brandName: summary.brandName,
    barcode: food.barcode,
    per100g: summary.per100g,
    portions: portions.get(food.id) ?? [],
  };
}
