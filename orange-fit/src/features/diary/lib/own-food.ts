/**
 * Conversión de un alimento propio a valores por 100 g (unidad canónica de `foods`) y
 * validación contra los mismos límites que la base (kcal ≤ 900, cada macro ≤ 100 g por 100 g).
 */
import type { OwnFoodData } from "../schemas";

export type Per100gValues = {
  energy_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  sugar_g: number | null;
  saturated_fat_g: number | null;
  sodium_mg: number | null;
};

export type Per100gResult =
  | { ok: true; values: Per100gValues }
  | { ok: false; field: string; message: string };

const round2 = (v: number) => Math.round(v * 100) / 100;

type NutrientFields = Pick<
  OwnFoodData,
  "basis" | "basisGrams" | "energyKcal" | "proteinG" | "carbsG" | "fatG" | "fiberG" | "sugarG" | "saturatedFatG" | "sodiumMg"
>;

export function toPer100g(input: NutrientFields): Per100gResult {
  const factor = input.basis === "per100g" ? 1 : 100 / (input.basisGrams ?? 0);
  if (!Number.isFinite(factor) || factor <= 0) {
    return { ok: false, field: "basisGrams", message: "Indica cuántos gramos pesa la porción." };
  }
  const scale = (v: number | null | undefined) => (v == null ? null : round2(v * factor));
  const values: Per100gValues = {
    energy_kcal: round2(input.energyKcal * factor),
    protein_g: round2(input.proteinG * factor),
    carbs_g: round2(input.carbsG * factor),
    fat_g: round2(input.fatG * factor),
    fiber_g: scale(input.fiberG),
    sugar_g: scale(input.sugarG),
    saturated_fat_g: scale(input.saturatedFatG),
    sodium_mg: scale(input.sodiumMg),
  };
  const per = input.basis === "per100g" ? "en 100 g" : "al convertir a 100 g";
  if (values.energy_kcal > 900) {
    return { ok: false, field: "energyKcal", message: `Da más de 900 kcal ${per}: revisa las calorías o el peso de la porción.` };
  }
  const grams: Array<[keyof Per100gValues, string, string]> = [
    ["protein_g", "proteinG", "La proteína"],
    ["carbs_g", "carbsG", "Los carbohidratos"],
    ["fat_g", "fatG", "La grasa"],
    ["fiber_g", "fiberG", "La fibra"],
    ["sugar_g", "sugarG", "El azúcar"],
    ["saturated_fat_g", "saturatedFatG", "La grasa saturada"],
  ];
  for (const [key, field, label] of grams) {
    const v = values[key];
    if (v != null && v > 100) return { ok: false, field, message: `${label} supera 100 g ${per}: revisa el valor.` };
  }
  if (values.protein_g + values.carbs_g + values.fat_g > 105) {
    return { ok: false, field: "proteinG", message: `Proteína, carbohidratos y grasa suman más de 100 g ${per}: revisa los valores.` };
  }
  if (values.sodium_mg != null && values.sodium_mg > 100000) {
    return { ok: false, field: "sodiumMg", message: "El sodio no es válido." };
  }
  return { ok: true, values };
}
