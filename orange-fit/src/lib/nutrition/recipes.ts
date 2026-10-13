/**
 * Nutrición de recetas calculada desde sus ingredientes (gramos × valores por 100 g del alimento),
 * igual que la vista `recipe_nutrition`, y escalado de porciones.
 */
import { NutritionInputError } from "./errors";
import { assertNonNegative, assertPositive, roundDecimals } from "./math";
import type { NutrientsPer100g, NutrientTotals } from "./portions";
import { divideNutrients, scaleNutrients, sumNutrients } from "./portions";

export interface RecipeIngredientInput {
  grams: number;
  food: NutrientsPer100g;
}

export interface RecipeNutrition {
  servings: number;
  total: NutrientTotals;
  perServing: NutrientTotals;
  totalGrams: number;
  perServingGrams: number;
  ingredientsCount: number;
}

export function assertServings(servings: unknown, field = "servings"): number {
  const s = assertPositive(servings, field, "Las porciones");
  if (s > 1000) throw new NutritionInputError("out_of_range", field, "Las porciones deben ser como máximo 1000.");
  return s;
}

export function recipeNutrition(ingredients: readonly RecipeIngredientInput[], servings: number): RecipeNutrition {
  assertServings(servings);
  const items = ingredients.map((ing, i) => {
    assertNonNegative(ing.grams, `ingredients.${i}.grams`, "Los gramos del ingrediente");
    return scaleNutrients(ing.food, ing.grams);
  });
  const total = sumNutrients(items);
  const totalGrams = ingredients.reduce((acc, ing) => acc + ing.grams, 0);
  return {
    servings,
    total,
    perServing: divideNutrients(total, servings),
    totalGrams,
    perServingGrams: totalGrams / servings,
    ingredientsCount: ingredients.length,
  };
}

/** Factor para pasar de `fromServings` a `toServings` porciones. */
export function servingsFactor(fromServings: number, toServings: number): number {
  return assertServings(toServings, "toServings") / assertServings(fromServings, "fromServings");
}

/**
 * Escala los ingredientes de una receta a otro número de porciones. Conserva los demás campos;
 * escala también `displayQuantity` si existe. Redondea a 0.01 para evitar ruido de coma flotante.
 */
export function scaleRecipe<T extends { grams: number; displayQuantity?: number | null }>(
  ingredients: readonly T[],
  fromServings: number,
  toServings: number,
): T[] {
  const factor = servingsFactor(fromServings, toServings);
  return ingredients.map((ing, i) => {
    assertNonNegative(ing.grams, `ingredients.${i}.grams`, "Los gramos del ingrediente");
    const scaled: T = { ...ing, grams: roundDecimals(ing.grams * factor, 2) };
    if (typeof ing.displayQuantity === "number") {
      scaled.displayQuantity = roundDecimals(ing.displayQuantity * factor, 2);
    }
    return scaled;
  });
}
