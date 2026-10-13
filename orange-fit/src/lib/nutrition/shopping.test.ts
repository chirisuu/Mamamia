import { describe, expect, it } from "vitest";
import { NutritionInputError } from "./errors";
import type { ReferencePrice, ShoppingFood } from "./shopping";
import {
  buildShoppingList,
  consolidateIngredients,
  ingredientsFromPlan,
  normalizeShoppingCategory,
  purchaseQuantity,
  SHOPPING_CATEGORIES,
} from "./shopping";

describe("normalizeShoppingCategory", () => {
  it.each([
    ["Lácteos", "dairy"],
    ["cereales y tubérculos", "grains_tubers"],
    ["grains_tubers", "grains_tubers"],
    ["Menestras", "legumes"],
    ["Frutos secos", "fats"],
    ["Pescados", "protein"],
    ["Verduras", "vegetables"],
    ["frutas", "fruits"],
    ["xyz", "other"],
    [null, "other"],
    ["", "other"],
  ] as const)("%s → %s", (raw, code) => {
    expect(normalizeShoppingCategory(raw)).toBe(code);
  });

  it("8 categorías en orden, con etiqueta en español", () => {
    expect(SHOPPING_CATEGORIES.map((c) => c.label)).toEqual([
      "Proteínas",
      "Lácteos",
      "Cereales y tubérculos",
      "Menestras",
      "Frutas",
      "Verduras",
      "Grasas",
      "Otros",
    ]);
  });
});

describe("ingredientsFromPlan y consolidateIngredients", () => {
  const recipes = {
    lomo: { servings: 4, ingredients: [{ foodId: "res", grams: 600 }, { foodId: "papa", grams: 800 }] },
    ensalada: { servings: 2, ingredients: [{ foodId: "papa", grams: 200 }] },
  };

  it("escala cada receta por porciones del plan / porciones de la receta y suma alimentos sueltos", () => {
    const { lines, missingRecipes } = ingredientsFromPlan(
      [
        { recipeId: "lomo", servings: 2 },
        { recipeId: "ensalada", servings: null },
        { foodId: "platano", grams: 120 },
        { recipeId: "no-existe", servings: 1 },
        { recipeId: "toString", servings: 1 },
        {},
      ],
      recipes,
    );
    expect(lines).toEqual([
      { foodId: "res", grams: 300 },
      { foodId: "papa", grams: 400 },
      { foodId: "papa", grams: 100 },
      { foodId: "platano", grams: 120 },
    ]);
    expect(missingRecipes).toEqual(["no-existe", "toString"]);
    expect(consolidateIngredients(lines)).toEqual([
      { foodId: "res", grams: 300 },
      { foodId: "papa", grams: 500 },
      { foodId: "platano", grams: 120 },
    ]);
  });

  it("acepta un Map y valida porciones", () => {
    const map = new Map(Object.entries(recipes));
    expect(ingredientsFromPlan([{ recipeId: "ensalada", servings: 4 }], map).lines).toEqual([{ foodId: "papa", grams: 400 }]);
    expect(ingredientsFromPlan([{ foodId: "x" }], map).lines).toEqual([{ foodId: "x", grams: 0 }]);
    expect(() => ingredientsFromPlan([{ recipeId: "r" }], { r: { servings: 0, ingredients: [] } })).toThrow(NutritionInputError);
    expect(() => ingredientsFromPlan([{ recipeId: "lomo", servings: -1 }], recipes)).toThrow(NutritionInputError);
    expect(() => consolidateIngredients([{ foodId: "a", grams: -1 }])).toThrow(NutritionInputError);
  });
});

describe("purchaseQuantity", () => {
  it("masa: decenas de gramos o décimas de kilo, hacia arriba", () => {
    expect(purchaseQuantity(250, {})).toEqual({ quantity: 250, unit: "g", label: "250 g" });
    expect(purchaseQuantity(251, {})).toEqual({ quantity: 260, unit: "g", label: "260 g" });
    expect(purchaseQuantity(3, {})).toEqual({ quantity: 10, unit: "g", label: "10 g" });
    expect(purchaseQuantity(1250, {})).toEqual({ quantity: 1.3, unit: "kg", label: "1.3 kg" });
    expect(purchaseQuantity(1000, {})).toEqual({ quantity: 1, unit: "kg", label: "1 kg" });
  });

  it("unidades enteras si hay peso por unidad", () => {
    expect(purchaseQuantity(120, { unitWeightG: 50 })).toEqual({ quantity: 3, unit: "unit", label: "3 unidades" });
    expect(purchaseQuantity(40, { unitWeightG: 50 })).toEqual({ quantity: 1, unit: "unit", label: "1 unidad" });
    expect(purchaseQuantity(100, { unitWeightG: 50 }).quantity).toBe(2);
    expect(purchaseQuantity(120, { unitWeightG: 50, buyAs: "mass" }).unit).toBe("g");
  });

  it("volumen con densidad (ml o L)", () => {
    expect(purchaseQuantity(500, { buyAs: "volume", densityGPerMl: 1.03 })).toEqual({ quantity: 490, unit: "ml", label: "490 ml" });
    expect(purchaseQuantity(2100, { buyAs: "volume", densityGPerMl: 1 })).toEqual({ quantity: 2.1, unit: "l", label: "2.1 L" });
    expect(purchaseQuantity(1, { buyAs: "volume", densityGPerMl: 1 }).quantity).toBe(10);
    // Sin densidad no inventa: vuelve a peso.
    expect(purchaseQuantity(500, { buyAs: "volume" }).unit).toBe("g");
  });

  it("valida gramos", () => {
    expect(() => purchaseQuantity(-1, {})).toThrow(NutritionInputError);
  });
});

describe("buildShoppingList", () => {
  const foods: ShoppingFood[] = [
    { foodId: "arroz", name: "Arroz", category: "cereales" },
    { foodId: "leche", name: "Leche", category: "lácteos", densityGPerMl: 1.03, buyAs: "volume" },
    { foodId: "huevo", name: "Huevo", category: "proteinas", unitWeightG: 50 },
    { foodId: "pollo", name: "Pollo", category: "proteinas" },
    { foodId: "aceite", name: "Aceite", category: "grasas" },
    { foodId: "palta", name: "Palta", category: "frutas", unitWeightG: 200, buyAs: "mass" },
    { foodId: "pan", name: "Pan", category: "cereales" },
    { foodId: "sal", name: "Sal", category: null },
    { foodId: "queso", name: "Queso", category: "lácteos" },
  ];
  const prices: ReferencePrice[] = [
    { foodId: "arroz", price: 4.5, perQuantity: 1, perUnit: "kg", currencyCode: "PEN", observedOn: "2026-09-01", source: "Mercado" },
    { foodId: "arroz", price: 5, perQuantity: 1, perUnit: "kg", currencyCode: "PEN", observedOn: "2026-08-01" },
    { foodId: "leche", price: 4.2, perQuantity: 1, perUnit: "l", currencyCode: "PEN" },
    { foodId: "huevo", price: 7.5, perQuantity: 15, perUnit: "unit", currencyCode: "PEN" },
    { foodId: "pollo", price: 3, perQuantity: 1, perUnit: "kg", currencyCode: "USD" },
    { foodId: "aceite", price: 9, perQuantity: 1, perUnit: "l", currencyCode: "PEN" },
    { foodId: "palta", price: 1.5, perQuantity: 1, perUnit: "unit", currencyCode: "PEN" },
    { foodId: "pan", price: 0.2, perQuantity: 1, perUnit: "unit", currencyCode: "PEN" },
    { foodId: "queso", price: 30, perQuantity: 0, perUnit: "kg", currencyCode: "PEN" },
  ];
  const lines = [
    { foodId: "arroz", grams: 700 },
    { foodId: "arroz", grams: 550 },
    { foodId: "leche", grams: 1030 },
    { foodId: "huevo", grams: 280 },
    { foodId: "pollo", grams: 900 },
    { foodId: "aceite", grams: 60 },
    { foodId: "palta", grams: 450 },
    { foodId: "pan", grams: 200 },
    { foodId: "sal", grams: 5 },
    { foodId: "queso", grams: 100 },
    { foodId: "desconocido", grams: 100 },
    { foodId: "nada", grams: 0 },
  ];
  const list = buildShoppingList({ lines, foods, prices, currencyCode: "PEN" });
  const item = (id: string) => list.categories.flatMap((c) => c.items).find((i) => i.foodId === id)!;

  it("agrupa por categoría en orden y ordena por nombre", () => {
    expect(list.categories.map((c) => c.code)).toEqual(["protein", "dairy", "grains_tubers", "fruits", "fats", "other"]);
    expect(list.categories[0]!.items.map((i) => i.name)).toEqual(["Huevo", "Pollo"]);
    expect(list.itemsCount).toBe(9);
    expect(list.missingFoods).toEqual(["desconocido"]);
  });

  it("consolida repetidos y convierte a unidades de compra", () => {
    expect(item("arroz")).toMatchObject({ grams: 1250, quantity: 1.3, unit: "kg", label: "1.3 kg" });
    expect(item("leche")).toMatchObject({ quantity: 1, unit: "l", label: "1 L" });
    expect(item("huevo")).toMatchObject({ quantity: 6, unit: "unit", label: "6 unidades" });
  });

  it("estima precios referenciales (el más reciente, en la moneda pedida)", () => {
    expect(item("arroz")).toMatchObject({ estimatedPrice: 5.63, priceStatus: "priced", priceSource: "Mercado" });
    expect(item("leche")).toMatchObject({ estimatedPrice: 4.2, priceStatus: "priced" });
    expect(item("huevo").estimatedPrice).toBe(3); // 6 unidades × 0.50
    expect(item("palta").estimatedPrice).toBe(4.5); // 3 unidades × 1.50 aunque se compra por peso
  });

  it("marca qué ítems no tienen precio y por qué", () => {
    expect(item("pollo")).toMatchObject({ estimatedPrice: null, priceStatus: "other_currency" });
    expect(item("aceite")).toMatchObject({ estimatedPrice: null, priceStatus: "needs_density" });
    expect(item("pan")).toMatchObject({ estimatedPrice: null, priceStatus: "needs_unit_weight" });
    expect(item("sal")).toMatchObject({ estimatedPrice: null, priceStatus: "no_price", category: "other" });
    expect(item("queso").priceStatus).toBe("no_price");
    expect(list.unpriced.map((u) => u.foodId).sort()).toEqual(["aceite", "pan", "pollo", "queso", "sal"]);
    expect(list.pricedCount).toBe(4);
    expect(list.estimatedTotal).toBe(17.33);
    expect(list.notes[0]).toContain("referenciales");
    expect(list.notes[1]).toContain("5 ítem(s)");
  });

  it("presupuesto: excedido, dentro o desconocido si el total es parcial", () => {
    expect(buildShoppingList({ lines, foods, prices, budget: 10 }).overBudget).toBe(true);
    expect(buildShoppingList({ lines, foods, prices, budget: 100 }).overBudget).toBeNull();
    const allPriced = buildShoppingList({ lines: [{ foodId: "arroz", grams: 1000 }], foods, prices, budget: 100 });
    expect(allPriced).toMatchObject({ overBudget: false, estimatedTotal: 4.5, budget: 100, currencyCode: "PEN" });
    expect(allPriced.notes).toHaveLength(1);
    expect(list.overBudget).toBeNull();
    expect(() => buildShoppingList({ lines, foods, budget: -1 })).toThrow(NutritionInputError);
  });

  it("sin precios: total null; prefiere la moneda pedida aunque haya otra más reciente", () => {
    expect(buildShoppingList({ lines, foods }).estimatedTotal).toBeNull();
    const mixed = buildShoppingList({
      lines: [{ foodId: "pollo", grams: 1000 }],
      foods,
      prices: [
        { foodId: "pollo", price: 11, perQuantity: 1, perUnit: "kg", currencyCode: "PEN", observedOn: "2026-01-01" },
        { foodId: "pollo", price: 3, perQuantity: 1, perUnit: "kg", currencyCode: "USD", observedOn: "2026-09-01" },
      ],
    });
    expect(mixed.estimatedTotal).toBe(11);
  });
});
