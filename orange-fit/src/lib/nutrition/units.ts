/**
 * Unidades y conversión a gramos (unidad canónica de masa). Los alimentos guardan sus
 * nutrientes por 100 g, así que todo registro termina convertido a gramos.
 *
 * - Masa: directa.
 * - Medida casera o unidad del alimento (taza, rebanada, unidad…): se usa la porción definida
 *   para ese alimento (`food_portions`), que es más fiel que una densidad genérica.
 * - Volumen (ml, l, taza, cda, cdta) sin porción definida: requiere la densidad del alimento.
 */
import { NutritionInputError } from "./errors";
import { assertFiniteNumber, fmt, normalizeKey } from "./math";

export type MassUnit = "g" | "kg" | "oz" | "lb";
export type VolumeUnit = "ml" | "l" | "cup" | "tbsp" | "tsp";

export const MASS_UNITS: Record<MassUnit, { grams: number; label: string }> = {
  g: { grams: 1, label: "g" },
  kg: { grams: 1000, label: "kg" },
  oz: { grams: 28.349523125, label: "oz" },
  lb: { grams: 453.59237, label: "lb" },
};

/** Taza de 240 ml (taza de etiquetado nutricional), cucharada 15 ml y cucharadita 5 ml. */
export const VOLUME_UNITS: Record<VolumeUnit, { ml: number; label: string }> = {
  ml: { ml: 1, label: "ml" },
  l: { ml: 1000, label: "L" },
  cup: { ml: 240, label: "taza" },
  tbsp: { ml: 15, label: "cda." },
  tsp: { ml: 5, label: "cdta." },
};

const ALIASES: Record<string, MassUnit | VolumeUnit> = {
  g: "g", gr: "g", grs: "g", gramo: "g", gramos: "g", gram: "g", grams: "g",
  kg: "kg", kgs: "kg", kilo: "kg", kilos: "kg", kilogramo: "kg", kilogramos: "kg",
  oz: "oz", onza: "oz", onzas: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", libra: "lb", libras: "lb", pound: "lb", pounds: "lb",
  ml: "ml", mililitro: "ml", mililitros: "ml", cc: "ml", cm3: "ml",
  l: "l", lt: "l", lts: "l", litro: "l", litros: "l", liter: "l", litre: "l", liters: "l",
  cup: "cup", cups: "cup", taza: "cup", tazas: "cup",
  tbsp: "tbsp", cda: "tbsp", "cda.": "tbsp", cdas: "tbsp", cucharada: "tbsp", cucharadas: "tbsp", tablespoon: "tbsp",
  tsp: "tsp", cdta: "tsp", "cdta.": "tsp", cdtas: "tsp", cucharadita: "tsp", cucharaditas: "tsp", teaspoon: "tsp",
};

/** Unidad canónica si es conocida; si no, la etiqueta normalizada (sin tildes, minúsculas). */
export function normalizeUnit(raw: string): string {
  const key = normalizeKey(raw);
  return ALIASES[key] ?? key;
}

export const isMassUnit = (unit: string): unit is MassUnit => Object.hasOwn(MASS_UNITS, unit);
export const isVolumeUnit = (unit: string): unit is VolumeUnit => Object.hasOwn(VOLUME_UNITS, unit);

/** Porción definida para un alimento (`food_portions`): `quantity` × `unit` pesan `gramWeight` g. */
export interface PortionDefinition {
  unit: string;
  gramWeight: number;
  quantity?: number;
  label?: string;
}

export interface ToGramsOptions {
  densityGPerMl?: number | null;
  portions?: readonly PortionDefinition[];
}

export class UnitConversionError extends NutritionInputError {
  constructor(code: NutritionInputError["code"], field: string, message: string) {
    super(code, field, message);
    this.name = "UnitConversionError";
  }
}

function assertQuantity(quantity: number): void {
  assertFiniteNumber(quantity, "quantity", "La cantidad");
  if (quantity < 0) throw new UnitConversionError("out_of_range", "quantity", "La cantidad no puede ser negativa.");
}

/** Gramos que pesa una unidad de la porción que coincide con `unit`, o null. */
export function gramsPerPortionUnit(unit: string, portions: readonly PortionDefinition[] = []): number | null {
  const target = normalizeUnit(unit);
  const match =
    portions.find((p) => normalizeUnit(p.unit) === target) ??
    portions.find((p) => p.label !== undefined && normalizeKey(p.label) === normalizeKey(unit));
  if (!match) return null;
  const quantity = match.quantity ?? 1;
  if (!(match.gramWeight > 0) || !(quantity > 0)) {
    throw new UnitConversionError("invalid_value", "portions", "La porción definida para este alimento no es válida.");
  }
  return match.gramWeight / quantity;
}

export function convertMass(value: number, from: MassUnit, to: MassUnit): number {
  assertFiniteNumber(value, "value", "La cantidad");
  return (value * MASS_UNITS[from].grams) / MASS_UNITS[to].grams;
}

export function convertVolume(value: number, from: VolumeUnit, to: VolumeUnit): number {
  assertFiniteNumber(value, "value", "La cantidad");
  return (value * VOLUME_UNITS[from].ml) / VOLUME_UNITS[to].ml;
}

/**
 * Convierte una cantidad a gramos. Lanza `UnitConversionError` con un mensaje en español cuando
 * la conversión no es posible (volumen sin densidad, medida casera sin porción definida).
 */
export function toGrams(quantity: number, unit: string, options: ToGramsOptions = {}): number {
  assertQuantity(quantity);
  const u = normalizeUnit(unit);
  if (u === "") throw new UnitConversionError("unknown_unit", "unit", "Indica una unidad.");
  if (isMassUnit(u)) return quantity * MASS_UNITS[u].grams;

  const perUnit = gramsPerPortionUnit(unit, options.portions);
  if (perUnit !== null) return quantity * perUnit;

  if (isVolumeUnit(u)) {
    const density = options.densityGPerMl;
    if (density == null) {
      throw new UnitConversionError(
        "missing_density",
        "unit",
        `No podemos convertir ${VOLUME_UNITS[u].label} a gramos: este alimento no tiene densidad registrada. Usa gramos o una porción del alimento.`,
      );
    }
    if (!(density > 0) || !Number.isFinite(density)) {
      throw new UnitConversionError("invalid_value", "densityGPerMl", "La densidad del alimento no es válida.");
    }
    return quantity * VOLUME_UNITS[u].ml * density;
  }

  throw new UnitConversionError(
    "missing_portion",
    "unit",
    `«${unit.trim()}» no tiene un peso definido para este alimento. Elige otra porción o escribe la cantidad en gramos.`,
  );
}

export type ToGramsResult =
  | { ok: true; grams: number }
  | { ok: false; error: { code: UnitConversionError["code"]; message: string } };

/** Igual que `toGrams` pero sin lanzar (útil en formularios). */
export function tryToGrams(quantity: number, unit: string, options: ToGramsOptions = {}): ToGramsResult {
  try {
    return { ok: true, grams: toGrams(quantity, unit, options) };
  } catch (e) {
    if (e instanceof NutritionInputError) return { ok: false, error: { code: e.code, message: e.message } };
    throw e;
  }
}

/** Inversa de `toGrams`: cuántas `unit` son `grams` gramos. */
export function fromGrams(grams: number, unit: string, options: ToGramsOptions = {}): number {
  assertFiniteNumber(grams, "grams", "Los gramos");
  // toGrams(1, …) siempre es > 0: las porciones y densidades válidas son positivas.
  return grams / toGrams(1, unit, options);
}

/** Etiqueta legible de una cantidad en su unidad ("1.5 taza", "200 g"). */
export function formatQuantity(quantity: number, unit: string, maxDecimals = 2): string {
  const u = normalizeUnit(unit);
  const label = isMassUnit(u) ? MASS_UNITS[u].label : isVolumeUnit(u) ? VOLUME_UNITS[u].label : unit.trim();
  return `${fmt(quantity, maxDecimals).replace("−", "-")} ${label}`;
}
