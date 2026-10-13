import { describe, expect, it } from "vitest";
import { recipeFormSchema } from "../schemas";
import { amountFor, emptyEditorValues, newIngredientRow, parseTags, rowWithQuantity, toRecipeFormInput } from "./editor";

const portions = [
  { id: "p1", label: "1/2 taza", quantity: 0.5, unit: "taza", gramWeight: 80, isDefault: false },
  { id: "p2", label: "1 unidad mediana", quantity: 1, unit: "unidad", gramWeight: 150, isDefault: true },
];

describe("editor de recetas", () => {
  it("convierte porciones caseras a gramos y medida visible", () => {
    expect(amountFor(2, "p1", portions)).toEqual({ grams: 160, displayQuantity: 1, displayUnit: "taza" });
    expect(amountFor(1.5, "p2", portions)).toEqual({ grams: 225, displayQuantity: 1.5, displayUnit: "unidad" });
    expect(amountFor(120, "g", portions)).toEqual({ grams: 120, displayQuantity: null, displayUnit: null });
    expect(amountFor(0, "p1", portions).grams).toBe(0);
  });

  it("una fila nueva usa la porción por defecto o 100 g", () => {
    expect(newIngredientRow({ id: "f", name: "Papa", portions })).toMatchObject({ unit: "p2", quantity: 1, grams: 150 });
    expect(newIngredientRow({ id: "f", name: "Arroz", portions: [] })).toMatchObject({ unit: "g", quantity: 100, grams: 100 });
  });

  it("limpia etiquetas", () => {
    expect(parseTags(" Casero, rápida,casero ,, ")).toEqual(["casero", "rápida"]);
  });

  it("arma una entrada válida para el servidor", () => {
    const values = {
      ...emptyEditorValues(),
      title: "Ají de gallina ligero",
      description: "  ",
      servings: 4,
      prepMinutes: 20,
      cookMinutes: 30,
      difficulty: "medium" as const,
      mealTypes: ["lunch" as const],
      allergens: ["lactosa"],
      tagsText: "casero",
      steps: [{ text: "Sancocha el pollo." }, { text: " " }],
      ingredients: [{ ...newIngredientRow({ id: "7b0b8c2e-6f1a-4c55-9a51-0d1b7d1a2f10", name: "Pollo", portions: [] }), note: " deshilachado " }],
    };
    const input = toRecipeFormInput(values, "review");
    expect(input.description).toBeNull();
    expect(input.steps).toEqual(["Sancocha el pollo."]);
    expect(input.ingredients[0]!.note).toBe("deshilachado");
    expect(recipeFormSchema.safeParse(input).success).toBe(true);
  });

  it("el esquema exige ingredientes y al menos una comida", () => {
    const res = recipeFormSchema.safeParse(toRecipeFormInput(emptyEditorValues(), "draft"));
    expect(res.success).toBe(false);
    const paths = res.success ? [] : res.error.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["title", "mealTypes", "ingredients"]));
  });
});

describe("rowWithQuantity", () => {
  it("con la medida guardada escala los gramos en proporción", () => {
    const row = { foodId: "f", name: "Arroz", quantity: 1, unit: "display", grams: 160, displayQuantity: 1, displayUnit: "taza", gramsPerDisplayUnit: 160, note: "" };
    expect(rowWithQuantity(row, 1.5, [])).toMatchObject({ unit: "display", grams: 240, displayQuantity: 1.5, displayUnit: "taza" });
    expect(rowWithQuantity(row, null, [])).toMatchObject({ grams: 0, displayQuantity: null });
  });

  it("en gramos o porciones recalcula con la porción", () => {
    const row = { foodId: "f", name: "Papa", quantity: 1, unit: "p2", grams: 150, displayQuantity: 1, displayUnit: "unidad", note: "" };
    expect(rowWithQuantity(row, 2, portions)).toMatchObject({ grams: 300, displayQuantity: 2 });
  });
});
