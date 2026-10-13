/**
 * Nutrientes de una porción a partir de valores por 100 g, y sumas.
 * Los 8 núcleo viven en `foods`; energía, proteína, carbohidratos y grasa son obligatorios.
 * Fibra, azúcar, grasa saturada y sodio pueden faltar (null): si falta en algún ítem, la suma
 * es un mínimo y se marca en `incomplete`.
 */
import { NutritionInputError } from "./errors";
import { assertNonNegative, roundDecimals } from "./math";

export const REQUIRED_NUTRIENT_KEYS = ["energyKcal", "proteinG", "carbsG", "fatG"] as const;
export const OPTIONAL_NUTRIENT_KEYS = ["fiberG", "sugarG", "saturatedFatG", "sodiumMg"] as const;
export const CORE_NUTRIENT_KEYS = [...REQUIRED_NUTRIENT_KEYS, ...OPTIONAL_NUTRIENT_KEYS] as const;

export type RequiredNutrientKey = (typeof REQUIRED_NUTRIENT_KEYS)[number];
export type OptionalNutrientKey = (typeof OPTIONAL_NUTRIENT_KEYS)[number];

/** Valores por 100 g tal como vienen de `foods` (+ micronutrientes de `food_nutrients`, por código). */
export interface NutrientsPer100g {
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number | null;
  sugarG?: number | null;
  saturatedFatG?: number | null;
  sodiumMg?: number | null;
  micronutrients?: Readonly<Record<string, number>> | null;
}

export interface NutrientAmounts {
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarG: number | null;
  saturatedFatG: number | null;
  sodiumMg: number | null;
  micronutrients: Record<string, number>;
}

export interface NutrientTotals extends NutrientAmounts {
  /** Nutrientes opcionales que faltaban en algún ítem: el total es un mínimo. */
  incomplete: OptionalNutrientKey[];
  /** Micronutrientes que no estaban en todos los ítems. */
  incompleteMicronutrients: string[];
}

export function emptyNutrients(): NutrientTotals {
  return {
    energyKcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
    sugarG: 0,
    saturatedFatG: 0,
    sodiumMg: 0,
    micronutrients: {},
    incomplete: [],
    incompleteMicronutrients: [],
  };
}

const LABELS: Record<RequiredNutrientKey | OptionalNutrientKey, string> = {
  energyKcal: "La energía",
  proteinG: "La proteína",
  carbsG: "Los carbohidratos",
  fatG: "La grasa",
  fiberG: "La fibra",
  sugarG: "El azúcar",
  saturatedFatG: "La grasa saturada",
  sodiumMg: "El sodio",
};

/** Nutrientes de `grams` gramos de un alimento. No redondea (usa `roundNutrients` para mostrar o guardar). */
export function scaleNutrients(per100g: NutrientsPer100g, grams: number): NutrientAmounts {
  assertNonNegative(grams, "grams", "Los gramos");
  const factor = grams / 100;
  const out = { micronutrients: {} } as NutrientAmounts;
  for (const key of REQUIRED_NUTRIENT_KEYS) {
    out[key] = assertNonNegative(per100g[key], key, LABELS[key]) * factor;
  }
  for (const key of OPTIONAL_NUTRIENT_KEYS) {
    const value = per100g[key];
    out[key] = value == null ? null : assertNonNegative(value, key, LABELS[key]) * factor;
  }
  for (const [code, value] of Object.entries(per100g.micronutrients ?? {})) {
    out.micronutrients[code] = assertNonNegative(value, `micronutrients.${code}`, `El micronutriente ${code}`) * factor;
  }
  return out;
}

type Summable = NutrientAmounts & Partial<Pick<NutrientTotals, "incomplete" | "incompleteMicronutrients">>;

/** Suma ítems. Un nutriente opcional queda null solo si falta en todos; si falta en algunos, se marca incompleto. */
export function sumNutrients(items: readonly Summable[]): NutrientTotals {
  if (items.length === 0) return emptyNutrients();
  const total = emptyNutrients();
  const incomplete = new Set<OptionalNutrientKey>();
  const microIncomplete = new Set<string>();
  const known: Record<OptionalNutrientKey, number> = { fiberG: 0, sugarG: 0, saturatedFatG: 0, sodiumMg: 0 };

  const allMicroCodes = new Set(items.flatMap((i) => Object.keys(i.micronutrients ?? {})));
  for (const item of items) {
    for (const key of REQUIRED_NUTRIENT_KEYS) {
      const v = item[key];
      if (typeof v !== "number" || !Number.isFinite(v)) {
        throw new NutritionInputError("invalid_number", key, `${LABELS[key]} debe ser un número válido.`);
      }
      total[key] += v;
    }
    for (const key of OPTIONAL_NUTRIENT_KEYS) {
      const v = item[key];
      if (v == null) incomplete.add(key);
      else {
        total[key] = (total[key] ?? 0) + v;
        known[key]++;
      }
    }
    for (const key of item.incomplete ?? []) incomplete.add(key);
    for (const code of item.incompleteMicronutrients ?? []) microIncomplete.add(code);
    for (const code of allMicroCodes) {
      const v = item.micronutrients?.[code];
      if (v == null) microIncomplete.add(code);
      else total.micronutrients[code] = (total.micronutrients[code] ?? 0) + v;
    }
  }
  for (const key of OPTIONAL_NUTRIENT_KEYS) {
    if (known[key] === 0) total[key] = null;
  }
  total.incomplete = OPTIONAL_NUTRIENT_KEYS.filter((k) => incomplete.has(k));
  total.incompleteMicronutrients = [...microIncomplete].sort();
  return total;
}

/** Copia redondeada (por defecto a 2 decimales, como `meal_log_items`). */
export function roundNutrients<T extends NutrientAmounts>(n: T, decimals = 2): T {
  const r = (v: number) => roundDecimals(v, decimals);
  const micronutrients: Record<string, number> = {};
  for (const [code, v] of Object.entries(n.micronutrients)) micronutrients[code] = r(v);
  return {
    ...n,
    energyKcal: r(n.energyKcal),
    proteinG: r(n.proteinG),
    carbsG: r(n.carbsG),
    fatG: r(n.fatG),
    fiberG: n.fiberG == null ? null : r(n.fiberG),
    sugarG: n.sugarG == null ? null : r(n.sugarG),
    saturatedFatG: n.saturatedFatG == null ? null : r(n.saturatedFatG),
    sodiumMg: n.sodiumMg == null ? null : r(n.sodiumMg),
    micronutrients,
  };
}

/** Divide unos totales entre n (p. ej. porciones de una receta), conservando las marcas. */
export function divideNutrients(totals: NutrientTotals, divisor: number): NutrientTotals {
  if (!(divisor > 0) || !Number.isFinite(divisor)) {
    throw new NutritionInputError("out_of_range", "divisor", "El divisor debe ser mayor que 0.");
  }
  const d = (v: number) => v / divisor;
  const micronutrients: Record<string, number> = {};
  for (const [code, v] of Object.entries(totals.micronutrients)) micronutrients[code] = d(v);
  return {
    ...totals,
    energyKcal: d(totals.energyKcal),
    proteinG: d(totals.proteinG),
    carbsG: d(totals.carbsG),
    fatG: d(totals.fatG),
    fiberG: totals.fiberG == null ? null : d(totals.fiberG),
    sugarG: totals.sugarG == null ? null : d(totals.sugarG),
    saturatedFatG: totals.saturatedFatG == null ? null : d(totals.saturatedFatG),
    sodiumMg: totals.sodiumMg == null ? null : d(totals.sodiumMg),
    micronutrients,
    incomplete: [...totals.incomplete],
    incompleteMicronutrients: [...totals.incompleteMicronutrients],
  };
}
