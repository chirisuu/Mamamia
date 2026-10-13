/**
 * Forma del formulario de receta (UI) y su conversión a la entrada del servidor. Puro.
 * Cada ingrediente se escribe en gramos o en una porción casera del alimento
 * (`food_portions`: `quantity × unit = gramWeight`).
 */
import { roundDecimals } from "@/lib/nutrition";
import type { RecipeFormInput } from "../schemas";
import type { FoodPortion } from "./food-api";

export const GRAMS_UNIT = "g";

export interface IngredientRow {
  foodId: string;
  name: string;
  /** Cantidad escrita por la persona en la unidad elegida. */
  quantity: number | null;
  /** "g" o el id de una porción del alimento; "display" = medida guardada antes (solo edición). */
  unit: string;
  grams: number;
  displayQuantity: number | null;
  displayUnit: string | null;
  /** Gramos por unidad de la medida guardada (solo `unit = "display"`). */
  gramsPerDisplayUnit?: number | null;
  note: string;
}

export interface RecipeEditorValues {
  title: string;
  description: string;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  difficulty: "" | "easy" | "medium" | "hard";
  mealTypes: Array<"breakfast" | "lunch" | "dinner" | "snack">;
  dietTags: Array<"vegetarian" | "vegan" | "pescatarian">;
  allergens: string[];
  tagsText: string;
  steps: Array<{ text: string }>;
  ingredients: IngredientRow[];
}

/** Gramos y medida visible de una cantidad en gramos o en una porción casera. */
export function amountFor(quantity: number, unit: string, portions: readonly FoodPortion[]): { grams: number; displayQuantity: number | null; displayUnit: string | null } {
  if (!(quantity > 0)) return { grams: 0, displayQuantity: null, displayUnit: null };
  if (unit === GRAMS_UNIT) return { grams: roundDecimals(quantity, 2), displayQuantity: null, displayUnit: null };
  const p = portions.find((x) => x.id === unit);
  if (!p || !(p.gramWeight > 0)) return { grams: roundDecimals(quantity, 2), displayQuantity: null, displayUnit: null };
  const perOne = p.quantity > 0 ? p.quantity : 1;
  return {
    grams: roundDecimals(quantity * p.gramWeight, 2),
    displayQuantity: roundDecimals(quantity * perOne, 2),
    displayUnit: p.unit || p.label,
  };
}

/** Cambia la cantidad de una fila y recalcula gramos y medida visible. */
export function rowWithQuantity(row: IngredientRow, quantity: number | null, portions: readonly FoodPortion[]): IngredientRow {
  if (row.unit === "display" && row.gramsPerDisplayUnit && row.gramsPerDisplayUnit > 0) {
    const q = quantity ?? 0;
    return { ...row, quantity, grams: roundDecimals(q * row.gramsPerDisplayUnit, 2), displayQuantity: q > 0 ? roundDecimals(q, 2) : null };
  }
  const unit = row.unit === "display" ? GRAMS_UNIT : row.unit;
  return { ...row, quantity, unit, ...amountFor(quantity ?? 0, unit, portions) };
}

/** Fila nueva al elegir un alimento: usa su porción por defecto si tiene, si no 100 g. */
export function newIngredientRow(food: { id: string; name: string; portions: readonly FoodPortion[] }): IngredientRow {
  const def = food.portions.find((p) => p.isDefault) ?? null;
  const unit = def ? def.id : GRAMS_UNIT;
  const quantity = def ? 1 : 100;
  return { foodId: food.id, name: food.name, quantity, unit, note: "", ...amountFor(quantity, unit, food.portions) };
}

export function parseTags(text: string): string[] {
  return [
    ...new Set(
      text
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0)
        .map((t) => t.slice(0, 40)),
    ),
  ].slice(0, 15);
}

export function toRecipeFormInput(values: RecipeEditorValues, intent: "draft" | "review"): RecipeFormInput {
  return {
    title: values.title,
    description: values.description.trim() || null,
    servings: values.servings ?? 0,
    prepMinutes: values.prepMinutes,
    cookMinutes: values.cookMinutes,
    difficulty: values.difficulty || null,
    steps: values.steps.map((s) => s.text.trim()).filter(Boolean),
    tags: parseTags(values.tagsText),
    dietTags: values.dietTags,
    allergens: values.allergens as RecipeFormInput["allergens"],
    mealTypes: values.mealTypes,
    ingredients: values.ingredients.map((i) => ({
      foodId: i.foodId,
      grams: i.grams,
      displayQuantity: i.displayQuantity,
      displayUnit: i.displayUnit,
      note: i.note.trim() || null,
    })),
    intent,
  };
}

export function emptyEditorValues(): RecipeEditorValues {
  return {
    title: "",
    description: "",
    servings: 2,
    prepMinutes: null,
    cookMinutes: null,
    difficulty: "",
    mealTypes: [],
    dietTags: [],
    allergens: [],
    tagsText: "",
    steps: [{ text: "" }],
    ingredients: [],
  };
}
