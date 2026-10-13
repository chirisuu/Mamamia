/**
 * Utilidades numéricas del motor: redondeos simétricos, formato de fórmulas y validación.
 */
import { NutritionInputError } from "./errors";

/** Decimales necesarios para representar un paso (0.25 → 2, 10 → 0). */
function stepDecimals(step: number): number {
  if (Number.isInteger(step)) return 0;
  const text = step.toString();
  const exp = /e-(\d+)$/.exec(text);
  if (exp) return Number(exp[1]) + (text.split("e")[0]!.split(".")[1]?.length ?? 0);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

/** Redondea al múltiplo de `step` más cercano; simétrico respecto de cero (−5 → −10 con paso 10). */
export function roundTo(value: number, step = 1): number {
  if (!(step > 0)) throw new RangeError("step debe ser mayor que 0");
  const sign = value < 0 ? -1 : 1;
  const rounded = sign * Math.round(Math.abs(value) / step + 1e-9) * step;
  const result = Number(rounded.toFixed(stepDecimals(step)));
  return Object.is(result, -0) ? 0 : result;
}

/** Redondea hacia arriba al múltiplo de `step` (para cantidades de compra). */
export function ceilTo(value: number, step = 1): number {
  if (!(step > 0)) throw new RangeError("step debe ser mayor que 0");
  const result = Number((Math.ceil(value / step - 1e-9) * step).toFixed(stepDecimals(step)));
  return Object.is(result, -0) ? 0 : result;
}

/** Redondeo a n decimales (simétrico). Escala con 10^n (exacto) en vez de usar 10^−n (inexacto). */
export function roundDecimals(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  const sign = value < 0 ? -1 : 1;
  const result = (sign * Math.round(Math.abs(value) * factor + 1e-9)) / factor;
  return Object.is(result, -0) ? 0 : result;
}

/** Energía: a la decena de kcal más cercana. */
export const roundKcal = (kcal: number): number => roundTo(kcal, 10);

/** Gramos: al gramo más cercano. */
export const roundGrams = (grams: number): number => roundTo(grams, 1);

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/**
 * Número para mostrar dentro de una fórmula: punto decimal, sin ceros sobrantes
 * y signo menos tipográfico (−).
 */
export function fmt(value: number, maxDecimals = 2): string {
  const n = Number(value.toFixed(maxDecimals));
  const text = (Object.is(n, -0) ? 0 : n).toString();
  return text.startsWith("-") ? `−${text.slice(1)}` : text;
}

/** Porcentaje legible a partir de una fracción (0.25 → "25 %"). */
export const fmtPct = (fraction: number, maxDecimals = 1): string => `${fmt(fraction * 100, maxDecimals)} %`;

export function assertFiniteNumber(value: unknown, field: string, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new NutritionInputError("invalid_number", field, `${label} debe ser un número válido.`);
  }
}

export function assertInRange(value: unknown, min: number, max: number, field: string, label: string, unit = ""): number {
  assertFiniteNumber(value, field, label);
  if (value < min || value > max) {
    const u = unit ? ` ${unit}` : "";
    throw new NutritionInputError("out_of_range", field, `${label} debe estar entre ${fmt(min)} y ${fmt(max)}${u}.`);
  }
  return value;
}

export function assertNonNegative(value: unknown, field: string, label: string): number {
  assertFiniteNumber(value, field, label);
  if (value < 0) throw new NutritionInputError("out_of_range", field, `${label} no puede ser negativo.`);
  return value;
}

export function assertPositive(value: unknown, field: string, label: string): number {
  assertFiniteNumber(value, field, label);
  if (value <= 0) throw new NutritionInputError("out_of_range", field, `${label} debe ser mayor que 0.`);
  return value;
}

export function assertInteger(value: unknown, min: number, max: number, field: string, label: string): number {
  assertInRange(value, min, max, field, label);
  if (!Number.isInteger(value)) {
    throw new NutritionInputError("invalid_number", field, `${label} debe ser un número entero.`);
  }
  return value as number;
}

/** Texto sin tildes, en minúsculas y con espacios colapsados (para comparar etiquetas). */
export function normalizeKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
