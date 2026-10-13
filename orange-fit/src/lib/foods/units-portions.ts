/**
 * Porciones y conversión cantidad + unidad → gramos para un alimento concreto (sus porciones de
 * `food_portions` y su densidad). Se apoya en `src/lib/nutrition/units.ts`; puro (cliente y servidor).
 */
import { MASS_UNITS, tryToGrams, type PortionDefinition } from "@/lib/nutrition";
import type { FoodPortionDto } from "./api-types";

export type PortionFood = {
  densityGPerMl: number | null;
  portions: readonly FoodPortionDto[];
};

/** Porciones del alimento en el formato del motor (`quantity` × `unit` = `gramWeight`). */
export function toPortionDefinitions(portions: readonly FoodPortionDto[]): PortionDefinition[] {
  return portions.map((p) => ({ unit: p.unit, gramWeight: p.gramWeight, quantity: p.quantity, label: p.label }));
}

export type GramsResult = { ok: true; grams: number } | { ok: false; message: string };

/** Gramos de `quantity` `unit` de este alimento (masa directa, porción propia o volumen con densidad). */
export function gramsFor(quantity: number, unit: string, food: PortionFood): GramsResult {
  const result = tryToGrams(quantity, unit, { densityGPerMl: food.densityGPerMl, portions: toPortionDefinitions(food.portions) });
  if (!result.ok) return { ok: false, message: result.error.message };
  return { ok: true, grams: Math.round(result.grams * 100) / 100 };
}

/** Opción de cantidad para el selector: gramos libres o una porción del alimento. */
export type AmountOption =
  | { kind: "grams"; key: "g"; label: string }
  | { kind: "portion"; key: string; label: string; portion: FoodPortionDto; gramsPerUnit: number };

/** Gramos + porciones válidas (la porción por defecto primero). */
export function amountOptions(food: PortionFood): AmountOption[] {
  const portions = [...food.portions]
    .filter((p) => p.gramWeight > 0 && p.quantity > 0)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.gramWeight - b.gramWeight);
  return [
    { kind: "grams", key: "g", label: "Gramos" },
    ...portions.map((p) => ({
      kind: "portion" as const,
      key: `p:${p.id}`,
      label: p.label,
      portion: p,
      gramsPerUnit: p.gramWeight / p.quantity,
    })),
  ];
}

/** Opción inicial: la porción por defecto si existe; si no, gramos. */
export function defaultAmountOption(options: AmountOption[]): AmountOption {
  return options.find((o) => o.kind === "portion" && o.portion.isDefault) ?? options[0];
}

/**
 * Gramos y lo que se guarda como cantidad visible en el diario. Para una porción se guarda la
 * cantidad en la unidad de la porción ("2 porción" → 2 × 30 g).
 */
export function resolveAmount(option: AmountOption, amount: number): { grams: number; quantity: number; unit: string } {
  if (option.kind === "grams") return { grams: round2(amount), quantity: round2(amount), unit: "g" };
  const quantity = amount * option.portion.quantity;
  return { grams: round2(amount * option.portion.gramWeight), quantity: round2(quantity), unit: option.portion.unit };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`;
const GRAMS_RE = new RegExp(String.raw`${NUMBER}\s*(?:g|gr|grs|gramos?|grams?)(?![a-z])`, "i");
const KG_RE = new RegExp(String.raw`${NUMBER}\s*(?:kg|kilos?|kilogramos?)(?![a-z])`, "i");
const OZ_RE = new RegExp(String.raw`${NUMBER}\s*(?:oz|onzas?|ounces?)(?![a-z])`, "i");

const toNumber = (raw: string) => Number(raw.replace(",", "."));

/**
 * Gramos de un texto de etiqueta ("30 g", "2 galletas (25 g)", "1 oz (28g)", "0,5 kg"). Devuelve
 * null si solo hay volumen ("250 ml"): sin densidad no se asume que 1 ml pese 1 g.
 */
export function parseGramsFromLabel(text: string | null | undefined): number | null {
  if (!text) return null;
  const t = text.trim();
  if (!t) return null;
  let grams: number | null = null;
  const g = GRAMS_RE.exec(t);
  if (g) grams = toNumber(g[1]);
  else {
    const kg = KG_RE.exec(t);
    if (kg) grams = toNumber(kg[1]) * 1000;
    else {
      const oz = OZ_RE.exec(t);
      if (oz) grams = toNumber(oz[1]) * MASS_UNITS.oz.grams;
    }
  }
  if (grams == null || !Number.isFinite(grams) || grams <= 0 || grams > 5000) return null;
  return round2(grams);
}
