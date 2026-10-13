/**
 * Adaptadores puros: filas de la base (`recipes` + vista `recipe_nutrition`) → modelos de la UI
 * y del planificador. Sin I/O; probados en adapters.test.ts.
 */
import type { Database } from "@/lib/db/database.types";
import { roundDecimals, type MealType, type PlannerRecipe } from "@/lib/nutrition";
import { recipeImageUrl } from "./image";

export type RecipeRow = Database["public"]["Tables"]["recipes"]["Row"];
export type RecipeNutritionRow = Database["public"]["Views"]["recipe_nutrition"]["Row"];

/** Columnas de `recipes` que usan las tarjetas y el planificador. */
export const RECIPE_CARD_COLUMNS =
  "id, slug, title, description, servings, prep_minutes, cook_minutes, difficulty, image_path, tags, diet_tags, allergens, meal_types, estimated_cost, cost_currency, status, is_public, owner_id, updated_at" as const;

export type RecipeCardRow = Pick<
  RecipeRow,
  | "id"
  | "slug"
  | "title"
  | "description"
  | "servings"
  | "prep_minutes"
  | "cook_minutes"
  | "difficulty"
  | "image_path"
  | "tags"
  | "diet_tags"
  | "allergens"
  | "meal_types"
  | "estimated_cost"
  | "cost_currency"
  | "status"
  | "is_public"
  | "owner_id"
  | "updated_at"
>;

/** Nutrición por porción, calculada desde los ingredientes (vista `recipe_nutrition`). */
export interface RecipeServingNutrition {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  /** Algún ingrediente no tiene fibra registrada: la fibra es un mínimo. */
  fiberIncomplete: boolean;
  grams: number;
}

export interface RecipeCard {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  difficulty: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  tags: string[];
  dietTags: string[];
  allergens: string[];
  mealTypes: MealType[];
  status: RecipeRow["status"];
  isPublic: boolean;
  isOfficial: boolean;
  isOwn: boolean;
  ingredientsCount: number;
  /** null si la receta no tiene ingredientes (no se puede calcular). */
  perServing: RecipeServingNutrition | null;
  /** Costo referencial por porción (`estimated_cost` es el total de la receta). */
  costPerServing: number | null;
  costCurrency: string | null;
}

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Tiempo total (preparación + cocción). null si no hay ninguno de los dos. */
export function totalMinutes(prep: number | null, cook: number | null): number | null {
  if (prep == null && cook == null) return null;
  return (prep ?? 0) + (cook ?? 0);
}

/** `estimated_cost` es el costo TOTAL de la receta: se divide entre las porciones. */
export function costPerServing(estimatedCost: number | null, servings: number): number | null {
  const cost = num(estimatedCost);
  const s = num(servings);
  if (cost == null || s == null || s <= 0) return null;
  return roundDecimals(cost / s, 2);
}

export function toServingNutrition(n: RecipeNutritionRow | null | undefined): RecipeServingNutrition | null {
  if (!n) return null;
  const count = num(n.ingredients_count) ?? 0;
  const kcal = num(n.per_serving_energy_kcal);
  if (count <= 0 || kcal == null) return null;
  return {
    kcal,
    proteinG: num(n.per_serving_protein_g) ?? 0,
    carbsG: num(n.per_serving_carbs_g) ?? 0,
    fatG: num(n.per_serving_fat_g) ?? 0,
    fiberG: num(n.per_serving_fiber_g) ?? 0,
    fiberIncomplete: Boolean(n.fiber_incomplete),
    grams: num(n.per_serving_grams) ?? 0,
  };
}

export function toRecipeCard(row: RecipeCardRow, nutrition: RecipeNutritionRow | null | undefined, userId: string | null): RecipeCard {
  const servings = num(row.servings) ?? 1;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    servings,
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    totalMinutes: totalMinutes(row.prep_minutes, row.cook_minutes),
    difficulty: row.difficulty,
    imagePath: row.image_path,
    imageUrl: recipeImageUrl(row.image_path, row.updated_at),
    tags: row.tags ?? [],
    dietTags: row.diet_tags ?? [],
    allergens: row.allergens ?? [],
    mealTypes: (row.meal_types ?? []) as MealType[],
    status: row.status,
    isPublic: row.is_public,
    isOfficial: row.owner_id === null,
    isOwn: Boolean(userId && row.owner_id === userId),
    ingredientsCount: num(nutrition?.ingredients_count) ?? 0,
    perServing: toServingNutrition(nutrition),
    costPerServing: costPerServing(row.estimated_cost, servings),
    costCurrency: row.cost_currency,
  };
}

/** Une filas de recetas con su nutrición (por `recipe_id`). */
export function joinRecipeCards(rows: readonly RecipeCardRow[], nutrition: readonly RecipeNutritionRow[], userId: string | null): RecipeCard[] {
  const byId = new Map(nutrition.filter((n) => n.recipe_id).map((n) => [n.recipe_id as string, n]));
  return rows.map((r) => toRecipeCard(r, byId.get(r.id), userId));
}

/**
 * Receta → entrada del planificador. Devuelve null si no se puede planificar (sin ingredientes o
 * sin kcal). El costo solo cuenta si está en la misma moneda que el presupuesto.
 * `prepMinutes` lleva el tiempo TOTAL (preparación + cocción), que es lo que la persona espera
 * al poner un tiempo máximo.
 */
export function toPlannerRecipe(card: RecipeCard, currency: string | null): PlannerRecipe | null {
  const ps = card.perServing;
  if (!ps || !(ps.kcal > 0)) return null;
  return {
    id: card.id,
    title: card.title,
    mealTypes: card.mealTypes,
    perServing: { kcal: ps.kcal, p: ps.proteinG, c: ps.carbsG, g: ps.fatG, fiber: ps.fiberG },
    allergens: card.allergens,
    dietTags: card.dietTags,
    prepMinutes: card.totalMinutes,
    costPerServing: card.costPerServing != null && currency != null && card.costCurrency === currency ? card.costPerServing : null,
  };
}

/** Proteína por cada 100 kcal (densidad proteica), para ordenar. */
export function proteinDensity(card: Pick<RecipeCard, "perServing">): number {
  const ps = card.perServing;
  if (!ps || ps.kcal <= 0) return 0;
  return (ps.proteinG / ps.kcal) * 100;
}
