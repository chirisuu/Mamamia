import { describe, expect, it } from "vitest";
import { generatePlan } from "@/lib/nutrition";
import { costPerServing, joinRecipeCards, toPlannerRecipe, toRecipeCard, totalMinutes } from "./adapters";
import { nutritionRow, recipeRow } from "./test-fixtures";
import { recipeImageUrl } from "./image";

describe("recipe adapters", () => {
  it("divide el costo TOTAL entre las porciones", () => {
    expect(costPerServing(5, 2)).toBe(2.5);
    expect(costPerServing(10, 3)).toBe(3.33);
    expect(costPerServing(null, 2)).toBeNull();
    expect(costPerServing(5, 0)).toBeNull();
  });

  it("suma preparación y cocción", () => {
    expect(totalMinutes(5, 10)).toBe(15);
    expect(totalMinutes(null, 10)).toBe(10);
    expect(totalMinutes(null, null)).toBeNull();
  });

  it("arma la tarjeta con nutrición por porción, costo por porción y dueño", () => {
    const card = toRecipeCard(recipeRow({ owner_id: "u1", estimated_cost: 6 }), nutritionRow(), "u1");
    expect(card.isOwn).toBe(true);
    expect(card.isOfficial).toBe(false);
    expect(card.costPerServing).toBe(3);
    expect(card.perServing).toEqual({ kcal: 400, proteinG: 15, carbsG: 60, fatG: 10, fiberG: 6, fiberIncomplete: false, grams: 300 });
    expect(card.totalMinutes).toBe(15);
    expect(card.imageUrl).toBeNull();
  });

  it("acepta numéricos como texto (PostgREST) y sin ingredientes deja la nutrición en null", () => {
    const card = toRecipeCard(
      recipeRow({ servings: "4" as unknown as number, estimated_cost: "8.00" as unknown as number }),
      nutritionRow({ ingredients_count: 0 }),
      null,
    );
    expect(card.servings).toBe(4);
    expect(card.costPerServing).toBe(2);
    expect(card.perServing).toBeNull();
  });

  it("une recetas con su nutrición por id", () => {
    const cards = joinRecipeCards([recipeRow(), recipeRow({ id: "r2", slug: "otra" })], [nutritionRow()], null);
    expect(cards[0]!.perServing?.kcal).toBe(400);
    expect(cards[1]!.perServing).toBeNull();
  });

  it("convierte a entrada del planificador con tiempo total y costo solo en la misma moneda", () => {
    const card = toRecipeCard(recipeRow(), nutritionRow(), null);
    const pen = toPlannerRecipe(card, "PEN");
    expect(pen).toMatchObject({
      id: "r1",
      title: "Avena con plátano",
      mealTypes: ["breakfast"],
      perServing: { kcal: 400, p: 15, c: 60, g: 10, fiber: 6 },
      allergens: ["gluten"],
      dietTags: ["vegetarian"],
      prepMinutes: 15,
      costPerServing: 2.5,
    });
    expect(toPlannerRecipe(card, "USD")?.costPerServing).toBeNull();
    expect(toPlannerRecipe(toRecipeCard(recipeRow(), nutritionRow({ ingredients_count: 0 }), null), "PEN")).toBeNull();
  });

  it("las recetas adaptadas sirven para generar un plan determinista", () => {
    const rows = (["breakfast", "lunch", "dinner"] as const).flatMap((m, i) =>
      [0, 1, 2].map((j) =>
        toPlannerRecipe(
          toRecipeCard(recipeRow({ id: `${m}-${j}`, slug: `${m}-${j}`, meal_types: [m] }), nutritionRow({ recipe_id: `${m}-${j}`, per_serving_energy_kcal: 450 + 50 * i + 20 * j, per_serving_protein_g: 25 }), null),
          "PEN",
        )!,
      ),
    );
    const input = { targetKcal: 1800, proteinG: 100, days: 2, mealsPerDay: 3, recipes: rows, seed: "abc" };
    const a = generatePlan(input);
    const b = generatePlan(input);
    expect(a).toEqual(b);
    expect(a.meals).toHaveLength(6);
    expect(a.diagnostics.withinTolerance).toBe(true);
  });
});

describe("recipeImageUrl", () => {
  it("arma la URL pública del bucket y escapa la ruta", () => {
    expect(recipeImageUrl("official/ají de gallina.webp", null, "http://127.0.0.1:54321/")).toBe(
      "http://127.0.0.1:54321/storage/v1/object/public/recipe-images/official/aj%C3%AD%20de%20gallina.webp",
    );
    expect(recipeImageUrl("official/a.webp", "2026", "https://x.supabase.co")).toBe(
      "https://x.supabase.co/storage/v1/object/public/recipe-images/official/a.webp?v=2026",
    );
  });

  it("sin ruta o con rutas raras no inventa imagen", () => {
    expect(recipeImageUrl(null, null, "http://x")).toBeNull();
    expect(recipeImageUrl("../secreto", null, "http://x")).toBeNull();
    expect(recipeImageUrl("a.webp", null, undefined)).toBeNull();
  });
});
