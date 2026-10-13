/**
 * Metabolismo basal con la ecuación de Mifflin-St Jeor (Mifflin et al., 1990):
 *   TMB = 10 × peso(kg) + 6.25 × talla(cm) − 5 × edad(años) + s
 *   s = +5 en hombres, −161 en mujeres.
 */
import { assertHeightCm, assertWeightKg } from "./bmi";
import { assertInRange, fmt } from "./math";
import type { Sex } from "./types";
import { isSex } from "./types";
import { NutritionInputError } from "./errors";

export const AGE_LIMITS = { min: 13, max: 100 } as const;

export const MIFFLIN_SEX_CONSTANT: Record<Sex, number> = { male: 5, female: -161 };

export interface BmrInput {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: Sex;
}

export function assertAgeYears(ageYears: unknown, field = "ageYears"): number {
  return assertInRange(ageYears, AGE_LIMITS.min, AGE_LIMITS.max, field, "La edad", "años");
}

export function assertSex(sex: unknown, field = "sex"): Sex {
  if (typeof sex !== "string" || !isSex(sex)) {
    throw new NutritionInputError("invalid_value", field, "El sexo para el cálculo debe ser hombre o mujer.");
  }
  return sex;
}

export function validateBmrInput(input: BmrInput): void {
  assertWeightKg(input.weightKg);
  assertHeightCm(input.heightCm);
  assertAgeYears(input.ageYears);
  assertSex(input.sex);
}

/** TMB en kcal/día, sin redondear. Lanza `NutritionInputError` si un dato está fuera de rango. */
export function mifflinStJeor(input: BmrInput): number {
  validateBmrInput(input);
  return 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears + MIFFLIN_SEX_CONSTANT[input.sex];
}

/** Fórmula con los valores del usuario, para mostrarla en la explicación. */
export function mifflinFormula(input: BmrInput): string {
  const s = MIFFLIN_SEX_CONSTANT[input.sex];
  const sexPart = s >= 0 ? `+ ${fmt(s)}` : `− ${fmt(-s)}`;
  return `10 × ${fmt(input.weightKg, 1)} kg + 6.25 × ${fmt(input.heightCm, 1)} cm − 5 × ${fmt(input.ageYears, 0)} años ${sexPart}`;
}

/** Avisos sobre la validez de la fórmula para este perfil. */
export function bmrWarnings(input: Pick<BmrInput, "ageYears">): string[] {
  const warnings: string[] = [];
  if (input.ageYears < 18) {
    warnings.push("La ecuación de Mifflin-St Jeor se desarrolló con adultos: en menores de 18 años el resultado es solo referencial.");
  }
  if (input.ageYears > 78) {
    warnings.push("La ecuación se validó en personas de 19 a 78 años: a tu edad el resultado es menos preciso.");
  }
  return warnings;
}
