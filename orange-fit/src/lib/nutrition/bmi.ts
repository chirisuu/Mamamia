/**
 * Índice de masa corporal (IMC) y categorías de la OMS para adultos.
 * IMC = peso (kg) / talla (m)².
 */
import { assertInRange, roundDecimals } from "./math";

export const BODY_LIMITS = {
  weightKg: { min: 20, max: 400 },
  heightCm: { min: 100, max: 250 },
} as const;

export type BmiCategory = "underweight" | "normal" | "overweight" | "obesity_1" | "obesity_2" | "obesity_3";

/** Cortes de la OMS (adultos). `max` es exclusivo y se compara con el IMC redondeado a 1 decimal. */
export const BMI_CATEGORIES: Record<BmiCategory, { label: string; min: number; max: number }> = {
  underweight: { label: "Bajo peso", min: 0, max: 18.5 },
  normal: { label: "Peso normal", min: 18.5, max: 25 },
  overweight: { label: "Sobrepeso", min: 25, max: 30 },
  obesity_1: { label: "Obesidad grado I", min: 30, max: 35 },
  obesity_2: { label: "Obesidad grado II", min: 35, max: 40 },
  obesity_3: { label: "Obesidad grado III", min: 40, max: Number.POSITIVE_INFINITY },
};

const ORDER: BmiCategory[] = ["underweight", "normal", "overweight", "obesity_1", "obesity_2", "obesity_3"];

export function assertWeightKg(weightKg: unknown, field = "weightKg"): number {
  return assertInRange(weightKg, BODY_LIMITS.weightKg.min, BODY_LIMITS.weightKg.max, field, "El peso", "kg");
}

export function assertHeightCm(heightCm: unknown, field = "heightCm"): number {
  return assertInRange(heightCm, BODY_LIMITS.heightCm.min, BODY_LIMITS.heightCm.max, field, "La talla", "cm");
}

/** IMC sin redondear. */
export function computeBmi(weightKg: number, heightCm: number): number {
  assertWeightKg(weightKg);
  assertHeightCm(heightCm);
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** Categoría OMS. Se clasifica con el IMC redondeado a 1 decimal (24.96 → 25.0 → sobrepeso). */
export function classifyBmi(bmi: number): BmiCategory {
  const value = roundDecimals(bmi, 1);
  return ORDER.find((c) => value < BMI_CATEGORIES[c].max) ?? "obesity_3";
}

/** Peso que corresponde a un IMC dado para una talla. */
export function weightForBmi(bmi: number, heightCm: number): number {
  assertHeightCm(heightCm);
  assertInRange(bmi, 10, 60, "bmi", "El IMC");
  const m = heightCm / 100;
  return bmi * m * m;
}

export interface BmiReport {
  /** IMC redondeado a 1 decimal. */
  bmi: number;
  category: BmiCategory;
  label: string;
  /** Rango de peso con IMC 18.5–24.9 para la talla, en kg con 1 decimal. */
  normalRangeKg: { min: number; max: number };
  notes: string[];
}

export function bmiReport(weightKg: number, heightCm: number, ageYears?: number): BmiReport {
  const raw = computeBmi(weightKg, heightCm);
  const category = classifyBmi(raw);
  const notes = [
    "El IMC es una referencia poblacional: no distingue músculo de grasa ni dónde se acumula.",
  ];
  if (ageYears !== undefined && ageYears < 18) {
    notes.push(
      "En menores de 18 años el IMC se interpreta con tablas por edad y sexo (OMS); esta clasificación es para adultos.",
    );
  }
  return {
    bmi: roundDecimals(raw, 1),
    category,
    label: BMI_CATEGORIES[category].label,
    normalRangeKg: {
      min: roundDecimals(weightForBmi(18.5, heightCm), 1),
      max: roundDecimals(weightForBmi(24.9, heightCm), 1),
    },
    notes,
  };
}
