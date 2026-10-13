/**
 * Nutrición de recetas para la UI: escalado de porciones (detalle) y cálculo en vivo desde los
 * ingredientes (formulario). Usa el motor (`scaleRecipe`, `recipeNutrition`); puro.
 */
import { recipeNutrition, roundDecimals, scaleRecipe, type NutrientsPer100g } from "@/lib/nutrition";
import type { RecipeServingNutrition } from "./adapters";

export interface DetailIngredient {
  id: string;
  foodId: string;
  name: string;
  grams: number;
  displayQuantity: number | null;
  displayUnit: string | null;
  note: string | null;
}

/** Ingredientes reescalados de `baseServings` a `servings` (gramos y cantidad visible). */
export function scaleIngredients<T extends { grams: number; displayQuantity?: number | null }>(
  ingredients: readonly T[],
  baseServings: number,
  servings: number,
): T[] {
  if (!(servings > 0) || !(baseServings > 0)) return [...ingredients];
  return scaleRecipe(ingredients, baseServings, servings);
}

export interface ScaledNutrition {
  servings: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  fiberIncomplete: boolean;
  grams: number;
}

/** Nutrientes de `servings` porciones a partir de los valores por porción. */
export function nutritionForServings(perServing: RecipeServingNutrition, servings: number): ScaledNutrition {
  const k = servings > 0 ? servings : 0;
  return {
    servings: k,
    kcal: roundDecimals(perServing.kcal * k, 1),
    proteinG: roundDecimals(perServing.proteinG * k, 1),
    carbsG: roundDecimals(perServing.carbsG * k, 1),
    fatG: roundDecimals(perServing.fatG * k, 1),
    fiberG: roundDecimals(perServing.fiberG * k, 1),
    fiberIncomplete: perServing.fiberIncomplete,
    grams: roundDecimals(perServing.grams * k, 0),
  };
}

export interface LiveIngredient {
  grams: number;
  per100g: NutrientsPer100g | null;
}

/**
 * Nutrición en vivo del formulario: total y por porción. Los ingredientes sin datos (aún
 * cargando) se ignoran y se informan en `missing`.
 */
export function liveRecipeNutrition(ingredients: readonly LiveIngredient[], servings: number) {
  const usable = ingredients.filter((i) => i.per100g && Number.isFinite(i.grams) && i.grams > 0);
  const missing = ingredients.length - usable.length;
  if (usable.length === 0 || !(servings > 0)) return { perServing: null, total: null, missing } as const;
  const n = recipeNutrition(
    usable.map((i) => ({ grams: i.grams, food: i.per100g as NutrientsPer100g })),
    servings,
  );
  const perServing: RecipeServingNutrition = {
    kcal: n.perServing.energyKcal,
    proteinG: n.perServing.proteinG,
    carbsG: n.perServing.carbsG,
    fatG: n.perServing.fatG,
    fiberG: n.perServing.fiberG ?? 0,
    fiberIncomplete: n.perServing.incomplete.includes("fiberG"),
    grams: n.perServingGrams,
  };
  return { perServing, total: n.total, missing } as const;
}

/**
 * Etiquetas que se calculan solas (reglas de docs/DATA_SOURCES.md, por porción):
 * high_protein ≥ 20 g de proteína y ≥ 25 % de la energía; low_carb ≤ 20 g de carbohidratos;
 * quick: preparación + cocción ≤ 20 min.
 */
export function computedDietTags(
  perServing: Pick<RecipeServingNutrition, "kcal" | "proteinG" | "carbsG"> | null,
  totalMinutes: number | null,
): string[] {
  const tags: string[] = [];
  if (perServing && perServing.kcal > 0) {
    if (perServing.proteinG >= 20 && (perServing.proteinG * 4) / perServing.kcal >= 0.25) tags.push("high_protein");
    if (perServing.carbsG <= 20) tags.push("low_carb");
  }
  if (totalMinutes != null && totalMinutes <= 20) tags.push("quick");
  return tags;
}
