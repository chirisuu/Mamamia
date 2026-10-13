import { describe, expect, it } from "vitest";
import { NutritionInputError } from "./errors";
import type { RecipeIngredientInput } from "./recipes";
import { recipeNutrition, scaleRecipe, servingsFactor } from "./recipes";

const ingredients: RecipeIngredientInput[] = [
  { grams: 200, food: { energyKcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, fiberG: 0.4 } },
  { grams: 150, food: { energyKcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: null } },
];

describe("recipeNutrition", () => {
  it("calcula totales y por porción desde los ingredientes", () => {
    const r = recipeNutrition(ingredients, 2);
    expect(r.total.energyKcal).toBeCloseTo(507.5, 10);
    expect(r.total.proteinG).toBeCloseTo(51.9, 10);
    expect(r.total.fiberG).toBeCloseTo(0.8, 10);
    expect(r.total.incomplete).toContain("fiberG");
    expect(r.perServing.energyKcal).toBeCloseTo(253.75, 10);
    expect(r.perServing.incomplete).toContain("fiberG");
    expect(r.totalGrams).toBe(350);
    expect(r.perServingGrams).toBe(175);
    expect(r.ingredientsCount).toBe(2);
    expect(r.servings).toBe(2);
  });

  it("sin ingredientes → ceros", () => {
    const r = recipeNutrition([], 1);
    expect(r.total.energyKcal).toBe(0);
    expect(r.totalGrams).toBe(0);
  });

  it("valida porciones y gramos", () => {
    expect(() => recipeNutrition(ingredients, 0)).toThrow("Las porciones debe ser mayor que 0.");
    expect(() => recipeNutrition(ingredients, 1001)).toThrow("Las porciones deben ser como máximo 1000.");
    expect(() => recipeNutrition([{ ...ingredients[0]!, grams: -1 }], 1)).toThrow(NutritionInputError);
  });
});

describe("scaleRecipe", () => {
  it("escala gramos y cantidades visibles, conservando los demás campos", () => {
    const scaled = scaleRecipe(
      [
        { foodId: "a", grams: 200, displayQuantity: 1, displayUnit: "taza" },
        { foodId: "b", grams: 50, displayQuantity: null },
        { foodId: "c", grams: 10 },
      ],
      4,
      2,
    );
    expect(scaled).toEqual([
      { foodId: "a", grams: 100, displayQuantity: 0.5, displayUnit: "taza" },
      { foodId: "b", grams: 25, displayQuantity: null },
      { foodId: "c", grams: 5 },
    ]);
  });

  it("redondea a 2 decimales", () => {
    expect(scaleRecipe([{ grams: 100 }], 3, 1)[0]!.grams).toBe(33.33);
  });

  it("no muta la entrada y valida", () => {
    const input = [{ grams: 100 }];
    scaleRecipe(input, 1, 2);
    expect(input[0]!.grams).toBe(100);
    expect(() => scaleRecipe(input, 0, 2)).toThrow(NutritionInputError);
    expect(() => scaleRecipe([{ grams: -5 }], 1, 2)).toThrow(NutritionInputError);
  });

  it("servingsFactor", () => {
    expect(servingsFactor(2, 6)).toBe(3);
    expect(() => servingsFactor(2, -1)).toThrow(NutritionInputError);
  });
});
