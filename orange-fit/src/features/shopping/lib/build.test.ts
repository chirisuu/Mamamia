import { describe, expect, it } from "vitest";
import { buildPlanShoppingList, pickPrices, quantityLabel, shoppingListText, toShoppingFood, unitWeightFromPrice, type FoodInfo, type PriceRow } from "./build";
import { categorizeFood } from "./categorize";

describe("categorizeFood", () => {
  it.each([
    ["Pechuga de pollo sin piel, cruda", "protein"],
    ["Clara de huevo", "protein"],
    ["Atún en agua, escurrido", "protein"],
    ["Tofu", "protein"],
    ["Leche evaporada descremada", "dairy"],
    ["Yogurt griego natural sin grasa", "dairy"],
    ["Mantequilla de maní", "fats"],
    ["Aceite de oliva", "fats"],
    ["Aceituna de botija", "fats"],
    ["Chía", "fats"],
    ["Arroz blanco crudo", "grains_tubers"],
    ["Pan de molde integral", "grains_tubers"],
    ["Papa amarilla sancochada", "grains_tubers"],
    ["Fideos secos", "grains_tubers"],
    ["Lentejas secas", "legumes"],
    ["Frejol canario cocido", "legumes"],
    ["Garbanzos cocidos", "legumes"],
    ["Plátano de seda", "fruits"],
    ["Limón, jugo", "fruits"],
    ["Piña", "fruits"],
    ["Ají panca seco", "vegetables"],
    ["Cebolla china", "vegetables"],
    ["Champiñones", "vegetables"],
    ["Kion (jengibre)", "vegetables"],
    ["Arvejas verdes cocidas", "vegetables"],
    ["Sillao (salsa de soya)", "other"],
    ["Sal de mesa", "other"],
    ["Miel de abeja", "other"],
    ["Algo raro", "other"],
  ])("%s → %s", (name, cat) => {
    expect(categorizeFood(name)).toBe(cat);
  });
});

describe("unitWeightFromPrice", () => {
  const lata = [{ label: "1 lata", quantity: 1, unit: "lata", gramWeight: 400 }];
  it("usa los gramos del nombre, luego el envase y luego la porción unidad", () => {
    expect(unitWeightFromPrice("Pan de molde integral (bolsa 600 g)", [{ label: "1 tajada", quantity: 1, unit: "tajada", gramWeight: 28 }])).toBe(600);
    expect(unitWeightFromPrice("Yogurt griego natural (envase 500 g)", [{ label: "1 envase individual", quantity: 1, unit: "envase", gramWeight: 170 }])).toBe(500);
    expect(unitWeightFromPrice("Leche evaporada (lata)", lata)).toBe(400);
    expect(unitWeightFromPrice("Pan francés (unidad)", [{ label: "1 unidad", quantity: 1, unit: "unidad", gramWeight: 30 }])).toBe(30);
    expect(unitWeightFromPrice("Bolsa grande 1.5 kg", [])).toBe(1500);
    expect(unitWeightFromPrice("Lechuga (unidad)", [{ label: "1 taza picada", quantity: 1, unit: "taza", gramWeight: 40 }])).toBeNull();
  });
});

const price = (over: Partial<PriceRow>): PriceRow => ({
  foodId: "arroz",
  itemName: "Arroz",
  price: 4,
  perQuantity: 1,
  perUnit: "kg",
  currencyCode: "PEN",
  observedOn: "2026-10-01",
  source: "Referencial",
  ...over,
});

describe("precios y forma de compra", () => {
  it("elige el precio más reciente en la moneda pedida", () => {
    const picked = pickPrices([price({ observedOn: "2026-09-01", price: 3 }), price({ price: 4 }), price({ currencyCode: "USD", observedOn: "2026-12-01", price: 1 })], "PEN");
    expect(picked.get("arroz")?.price).toBe(4);
  });

  it("compra por unidad, por litro con densidad o por peso", () => {
    const food: FoodInfo = { id: "pan", name: "Pan francés", densityGPerMl: null, portions: [{ label: "1 unidad", quantity: 1, unit: "unidad", gramWeight: 30 }] };
    expect(toShoppingFood(food, price({ foodId: "pan", itemName: "Pan francés (unidad)", perUnit: "unit" }))).toMatchObject({ buyAs: "unit", unitWeightG: 30, category: "grains_tubers" });
    const aceite: FoodInfo = { id: "aceite", name: "Aceite vegetal", densityGPerMl: 0.92, portions: [] };
    expect(toShoppingFood(aceite, price({ foodId: "aceite", perUnit: "l" })).buyAs).toBe("volume");
    expect(toShoppingFood(aceite, undefined).buyAs).toBe("mass");
  });
});

describe("buildPlanShoppingList", () => {
  const foods: FoodInfo[] = [
    { id: "arroz", name: "Arroz blanco crudo", densityGPerMl: null, portions: [] },
    { id: "pollo", name: "Pechuga de pollo", densityGPerMl: null, portions: [] },
    { id: "pan", name: "Pan francés", densityGPerMl: null, portions: [{ label: "1 unidad", quantity: 1, unit: "unidad", gramWeight: 30 }] },
    { id: "lechuga", name: "Lechuga", densityGPerMl: null, portions: [] },
  ];
  const recipes = new Map([
    ["r1", { servings: 2, ingredients: [{ foodId: "arroz", grams: 200 }, { foodId: "pollo", grams: 300 }] }],
  ]);

  it("consolida recetas y alimentos sueltos, categoriza y estima con precios referenciales", () => {
    const list = buildPlanShoppingList({
      items: [
        { recipeId: "r1", servings: 2 },
        { recipeId: "r1", servings: 1 },
        { foodId: "pan", grams: 70 },
        { foodId: "lechuga", grams: 50 },
        { recipeId: "otra", servings: 1 },
      ],
      recipes,
      foods,
      prices: [price({ price: 4.2 }), price({ foodId: "pan", itemName: "Pan francés (unidad)", perUnit: "unit", price: 0.3 }), price({ foodId: "lechuga", itemName: "Lechuga (unidad)", perUnit: "unit", price: 1.5 })],
      currency: "PEN",
      budget: 10,
    });
    expect(list.missingRecipes).toEqual(["otra"]);
    const all = list.categories.flatMap((c) => c.items);
    const arroz = all.find((i) => i.foodId === "arroz")!;
    // 200 g × (2 + 1) / 2 = 300 g → S/ 4.20 × 0.3 kg.
    expect(arroz).toMatchObject({ grams: 300, quantity: 300, unit: "g", estimatedPrice: 1.26, priceStatus: "priced", category: "grains_tubers" });
    expect(all.find((i) => i.foodId === "pan")).toMatchObject({ quantity: 3, unit: "unit", estimatedPrice: 0.9 });
    expect(all.find((i) => i.foodId === "lechuga")).toMatchObject({ estimatedPrice: null, priceStatus: "needs_unit_weight" });
    expect(all.find((i) => i.foodId === "pollo")).toMatchObject({ estimatedPrice: null, priceStatus: "no_price", category: "protein" });
    expect(list.estimatedTotal).toBe(2.16);
    expect(list.overBudget).toBeNull();
    expect(list.notes[0]).toMatch(/referenciales/);
  });
});

describe("texto para compartir", () => {
  it("lista por categoría con marca de comprado y aclara que los precios son referenciales", () => {
    const text = shoppingListText({
      name: "Compras · Semana",
      currency: "PEN",
      categories: [{ label: "Proteínas", items: [{ name: "Pollo", category: "protein", quantity: 600, unit: "g", checked: true, estimatedPrice: 12 }] }],
      total: 12,
      partial: true,
    });
    expect(text).toContain("PROTEÍNAS");
    expect(text).toContain("[x] Pollo — 600 g · S/ 12.00");
    expect(text).toContain("Total referencial: S/ 12.00 (parcial");
    expect(text).toContain("no en tiempo real");
    expect(quantityLabel(1, "unidad")).toBe("1 unidad");
    expect(quantityLabel(1.2, "kg")).toBe("1.2 kg");
  });
});
