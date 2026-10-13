import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { getActiveGoal, getActiveTargets } from "@/lib/data/targets";
import { provenanceLabel, toPer100g } from "@/lib/foods/types";
import type { NutrientsPer100g } from "@/lib/nutrition";
import {
  joinRecipeCards,
  RECIPE_CARD_COLUMNS,
  toRecipeCard,
  type RecipeCard,
  type RecipeCardRow,
  type RecipeNutritionRow,
} from "./lib/adapters";

type Client = SupabaseClient<Database>;

const CHUNK = 150;

async function nutritionFor(supabase: Client, ids: string[]): Promise<RecipeNutritionRow[]> {
  const out: RecipeNutritionRow[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase.from("recipe_nutrition").select("*").in("recipe_id", ids.slice(i, i + CHUNK));
    if (error) throw new Error(`recipe_nutrition: ${error.code ?? "error"}`);
    out.push(...(data ?? []));
  }
  return out;
}

/**
 * Recetas que la persona puede ver en el catálogo: publicadas y públicas + las propias.
 * Se filtra explícitamente (el staff ve más por RLS, pero el catálogo no muestra borradores ajenos).
 */
export async function listCatalogRecipes(supabase: Client, userId: string): Promise<RecipeCard[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select(RECIPE_CARD_COLUMNS)
    .or(`and(status.eq.published,is_public.eq.true),owner_id.eq.${userId}`)
    .order("title", { ascending: true })
    .limit(1000);
  if (error) throw new Error(`recipes: ${error.code ?? "error"}`);
  const rows = (data ?? []) as RecipeCardRow[];
  const nutrition = await nutritionFor(
    supabase,
    rows.map((r) => r.id),
  );
  return joinRecipeCards(rows, nutrition, userId);
}

/** Recetas publicadas (para el planificador) + las propias con ingredientes. */
export async function listPlannableRecipes(supabase: Client, userId: string): Promise<RecipeCard[]> {
  const cards = await listCatalogRecipes(supabase, userId);
  return cards.filter((c) => c.perServing && c.perServing.kcal > 0);
}

export async function getFavoriteRecipeIds(supabase: Client, userId: string): Promise<Set<string>> {
  const { data } = await supabase.from("user_favorites").select("recipe_id").eq("user_id", userId).not("recipe_id", "is", null);
  return new Set((data ?? []).flatMap((r) => (r.recipe_id ? [r.recipe_id] : [])));
}

export interface RecipeIngredientDetail {
  id: string;
  foodId: string;
  name: string;
  grams: number;
  displayQuantity: number | null;
  displayUnit: string | null;
  note: string | null;
  position: number;
  per100g: NutrientsPer100g | null;
  provenance: string | null;
  isPublicFood: boolean;
}

export interface RecipeDetail {
  card: RecipeCard;
  steps: string[];
  ingredients: RecipeIngredientDetail[];
  isFavorite: boolean;
  reviewed: boolean;
}

function parseSteps(steps: unknown): string[] {
  if (!Array.isArray(steps)) return [];
  return steps.filter((s): s is string => typeof s === "string" && s.trim().length > 0);
}

/** Detalle de una receta visible (publicada y pública, o propia). null si no existe o no se puede ver. */
export async function getRecipeDetail(supabase: Client, userId: string, slug: string): Promise<RecipeDetail | null> {
  const { data: row, error } = await supabase
    .from("recipes")
    .select(`${RECIPE_CARD_COLUMNS}, steps, reviewed_at`)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`recipes: ${error.code ?? "error"}`);
  if (!row) return null;
  const visible = (row.status === "published" && row.is_public) || row.owner_id === userId;
  if (!visible) return null;

  const [{ data: ings, error: ingError }, nutrition, { data: fav }] = await Promise.all([
    supabase
      .from("recipe_ingredients")
      .select("id, food_id, grams, display_quantity, display_unit, note, position, foods(*)")
      .eq("recipe_id", row.id)
      .order("position", { ascending: true }),
    nutritionFor(supabase, [row.id]),
    supabase.from("user_favorites").select("id").eq("user_id", userId).eq("recipe_id", row.id).maybeSingle(),
  ]);
  if (ingError) throw new Error(`recipe_ingredients: ${ingError.code ?? "error"}`);

  const ingredients: RecipeIngredientDetail[] = (ings ?? []).map((i) => {
    const food = (i as typeof i & { foods: Database["public"]["Tables"]["foods"]["Row"] | null }).foods;
    return {
      id: i.id,
      foodId: i.food_id,
      name: food?.name ?? "Alimento no disponible",
      grams: Number(i.grams),
      displayQuantity: i.display_quantity == null ? null : Number(i.display_quantity),
      displayUnit: i.display_unit,
      note: i.note,
      position: i.position,
      per100g: food ? toPer100g(food) : null,
      provenance: food ? provenanceLabel({ source: food.source, verificationStatus: food.verification_status }) : null,
      isPublicFood: Boolean(food?.is_public),
    };
  });

  return {
    card: toRecipeCard(row as RecipeCardRow, nutrition[0], userId),
    steps: parseSteps(row.steps),
    ingredients,
    isFavorite: Boolean(fav),
    reviewed: Boolean(row.reviewed_at),
  };
}

export interface RecipeEditData {
  id: string;
  slug: string;
  status: RecipeCard["status"];
  values: {
    title: string;
    description: string | null;
    servings: number;
    prepMinutes: number | null;
    cookMinutes: number | null;
    difficulty: "easy" | "medium" | "hard" | null;
    steps: string[];
    tags: string[];
    dietTags: Array<"vegetarian" | "vegan" | "pescatarian">;
    allergens: string[];
    mealTypes: Array<"breakfast" | "lunch" | "dinner" | "snack">;
  };
  ingredients: Array<{
    foodId: string;
    name: string;
    grams: number;
    displayQuantity: number | null;
    displayUnit: string | null;
    note: string | null;
    per100g: NutrientsPer100g | null;
  }>;
}

/** Receta propia para editar. null si no existe o no es de la persona. */
export async function getOwnRecipeForEdit(supabase: Client, userId: string, slug: string): Promise<RecipeEditData | null> {
  const detail = await getRecipeDetail(supabase, userId, slug);
  if (!detail || !detail.card.isOwn) return null;
  const c = detail.card;
  const declared = new Set(["vegetarian", "vegan", "pescatarian"]);
  return {
    id: c.id,
    slug: c.slug,
    status: c.status,
    values: {
      title: c.title,
      description: c.description,
      servings: c.servings,
      prepMinutes: c.prepMinutes,
      cookMinutes: c.cookMinutes,
      difficulty: (["easy", "medium", "hard"] as const).find((d) => d === c.difficulty) ?? null,
      steps: detail.steps,
      tags: c.tags,
      dietTags: c.dietTags.filter((t): t is "vegetarian" | "vegan" | "pescatarian" => declared.has(t)),
      allergens: c.allergens,
      mealTypes: c.mealTypes.filter((m): m is "breakfast" | "lunch" | "dinner" | "snack" => m !== "custom"),
    },
    ingredients: detail.ingredients.map((i) => ({
      foodId: i.foodId,
      name: i.name,
      grams: i.grams,
      displayQuantity: i.displayQuantity,
      displayUnit: i.displayUnit,
      note: i.note,
      per100g: i.per100g,
    })),
  };
}

/** Lo que falta hoy para la meta (para "Para tu meta de hoy"). */
export async function getTodayRemaining(supabase: Client, userId: string, today: string) {
  const [targets, goal, { data: totals }] = await Promise.all([
    getActiveTargets(supabase, userId, today),
    getActiveGoal(supabase, userId),
    supabase.from("daily_nutrition_totals").select("energy_kcal, protein_g").eq("user_id", userId).eq("local_date", today).maybeSingle(),
  ]);
  const consumedKcal = Number(totals?.energy_kcal ?? 0);
  const consumedProtein = Number(totals?.protein_g ?? 0);
  return {
    targets,
    goal,
    consumedKcal,
    consumedProtein,
    remainingKcal: targets ? targets.energy_kcal - consumedKcal : null,
    remainingProteinG: targets ? Math.max(0, targets.protein_g - consumedProtein) : null,
  };
}
