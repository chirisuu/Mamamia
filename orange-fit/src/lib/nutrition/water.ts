/**
 * Agua: ingestas adecuadas de EFSA (2010) para adultos, que se refieren al agua TOTAL
 * (bebidas + agua de los alimentos, que aporta ~20–30 %).
 */
import { assertNonNegative, assertPositive, clamp, roundTo } from "./math";
import type { HealthFlag, Sex } from "./types";

export const EFSA_WATER_ML: Record<Sex, number> = { female: 2000, male: 2500 };
export const EFSA_PREGNANCY_EXTRA_ML = 300;
export const EFSA_LACTATION_EXTRA_ML = 700;

/** Botones de registro rápido (ml). */
export const WATER_PRESETS_ML = [
  { ml: 250, label: "Vaso" },
  { ml: 500, label: "Botella chica" },
  { ml: 750, label: "Botella mediana" },
  { ml: 1000, label: "1 litro" },
] as const;

export interface WaterTarget {
  waterMl: number;
  formula: string;
  notes: string[];
}

export function waterTarget(input: { sex: Sex; healthFlags?: readonly HealthFlag[] }): WaterTarget {
  const flags = new Set(input.healthFlags ?? []);
  const base = EFSA_WATER_ML[input.sex];
  const extra = flags.has("lactating") ? EFSA_LACTATION_EXTRA_ML : flags.has("pregnant") ? EFSA_PREGNANCY_EXTRA_ML : 0;
  const who = input.sex === "female" ? "mujer adulta" : "hombre adulto";
  const extraText = flags.has("lactating")
    ? ` + ${EFSA_LACTATION_EXTRA_ML} ml (lactancia)`
    : flags.has("pregnant")
      ? ` + ${EFSA_PREGNANCY_EXTRA_ML} ml (embarazo)`
      : "";
  const notes = [
    "Es la ingesta adecuada de agua total de EFSA (2010): incluye el agua de los alimentos, que aporta cerca de un 20 %.",
    "Con calor, mucha sudoración o ejercicio largo necesitarás más.",
  ];
  if (flags.has("kidney_disease")) {
    notes.push("Con una enfermedad renal, la cantidad de líquidos debe indicarla tu médico: toma esta meta solo como referencia.");
  }
  return {
    waterMl: base + extra,
    formula: `EFSA, ${who}: ${base} ml${extraText}`,
    notes,
  };
}

export interface WaterProgress {
  consumedMl: number;
  targetMl: number;
  remainingMl: number;
  /** 0–1, tope en 1. */
  progress: number;
  reached: boolean;
}

export function waterProgress(consumedMl: number, targetMl: number): WaterProgress {
  assertNonNegative(consumedMl, "consumedMl", "El agua consumida");
  assertPositive(targetMl, "targetMl", "La meta de agua");
  return {
    consumedMl,
    targetMl,
    remainingMl: Math.max(0, targetMl - consumedMl),
    progress: roundTo(clamp(consumedMl / targetMl, 0, 1), 0.001),
    reached: consumedMl >= targetMl,
  };
}

export function sumWaterMl(logs: readonly { amountMl: number }[]): number {
  return logs.reduce((acc, log, i) => acc + assertNonNegative(log.amountMl, `logs.${i}.amountMl`, "La cantidad de agua"), 0);
}
