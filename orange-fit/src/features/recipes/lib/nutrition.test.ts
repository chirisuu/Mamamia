import { describe, expect, it } from "vitest";
import { computedDietTags, liveRecipeNutrition, nutritionForServings, scaleIngredients } from "./nutrition";
import { isValidSlug, recipeSlug, slugify } from "./slug";

describe("escalado de recetas", () => {
  const ingredients = [
    { id: "a", grams: 200, displayQuantity: 1, displayUnit: "taza" },
    { id: "b", grams: 30, displayQuantity: null, displayUnit: null },
  ];

  it("reescala gramos y cantidades visibles sin mutar", () => {
    const scaled = scaleIngredients(ingredients, 4, 6);
    expect(scaled).toEqual([
      { id: "a", grams: 300, displayQuantity: 1.5, displayUnit: "taza" },
      { id: "b", grams: 45, displayQuantity: null, displayUnit: null },
    ]);
    expect(ingredients[0]!.grams).toBe(200);
    expect(scaleIngredients(ingredients, 4, 0)).toEqual(ingredients);
  });

  it("multiplica la nutrición por porción", () => {
    const n = nutritionForServings({ kcal: 410.5, proteinG: 20.25, carbsG: 50, fatG: 12, fiberG: 4, fiberIncomplete: true, grams: 310 }, 1.5);
    expect(n).toEqual({ servings: 1.5, kcal: 615.8, proteinG: 30.4, carbsG: 75, fatG: 18, fiberG: 6, fiberIncomplete: true, grams: 465 });
  });

  it("calcula en vivo desde ingredientes y marca la fibra incompleta", () => {
    const live = liveRecipeNutrition(
      [
        { grams: 200, per100g: { energyKcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, fiberG: 0.4 } },
        { grams: 100, per100g: { energyKcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: null } },
        { grams: 50, per100g: null },
      ],
      2,
    );
    expect(live.missing).toBe(1);
    expect(live.perServing?.kcal).toBeCloseTo((260 + 165) / 2, 5);
    expect(live.perServing?.proteinG).toBeCloseTo((5.4 + 31) / 2, 5);
    expect(live.perServing?.fiberIncomplete).toBe(true);
    expect(live.perServing?.grams).toBe(150);
    expect(liveRecipeNutrition([], 2).perServing).toBeNull();
  });

  it("calcula etiquetas automáticas con las reglas del seed", () => {
    expect(computedDietTags({ kcal: 300, proteinG: 25, carbsG: 10 }, 15)).toEqual(["high_protein", "low_carb", "quick"]);
    // 20 g de proteína en 400 kcal = 20 % de la energía: no es alta en proteína.
    expect(computedDietTags({ kcal: 400, proteinG: 20, carbsG: 45 }, 40)).toEqual([]);
    expect(computedDietTags(null, null)).toEqual([]);
  });
});

describe("slugs", () => {
  it("quita tildes y ñ y cumple el patrón de la base", () => {
    expect(slugify("  Ají de Gallina con Ñoquis!! ")).toBe("aji-de-gallina-con-noquis");
    expect(slugify("¿¿??")).toBe("receta");
    const slug = recipeSlug("Pollo a la brasa", () => 0.5);
    expect(slug).toBe("pollo-a-la-brasa-iiiiii");
    expect(isValidSlug(slug)).toBe(true);
    expect(isValidSlug("nueva")).toBe(false);
    expect(isValidSlug("Con-Mayus")).toBe(false);
  });
});
