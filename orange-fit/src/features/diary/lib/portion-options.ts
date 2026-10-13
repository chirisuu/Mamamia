/**
 * Opciones de cantidad del selector de porciones: gramos, porciones caseras del alimento
 * (`food_portions`) y mililitros si el alimento tiene densidad. Todo termina en gramos, que es
 * lo único que el servidor usa para calcular nutrientes (ver units.ts: nunca se asume densidad 1).
 */
import { formatNumber } from "@/lib/format";
import type { FoodPortion } from "../types";

export const MAX_LOG_GRAMS = 5000;

export type AmountOption = {
  /** "g" | "ml" | `p:<id de la porción>` */
  key: string;
  /** Texto del selector ("1/2 taza · 95 g"). */
  label: string;
  /** Unidad que se guarda junto a la cantidad ("g", "taza", "unidad grande"). */
  unitLabel: string;
  gramsPerUnit: number;
  defaultAmount: number;
  step: number;
  decimals: number;
  min: number;
  max: number;
};

function decimalsOf(step: number): number {
  const text = String(step);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** "1 unidad grande" → "unidad grande"; "1/2 taza" → "taza"; "10 unidades" → "unidades". */
export function portionUnitLabel(portion: Pick<FoodPortion, "label" | "unit">): string {
  const stripped = portion.label
    .replace(/^\s*\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?\s*(?:de\s+)?/i, "")
    .trim();
  const text = stripped || portion.unit.trim() || "porción";
  return text.slice(0, 30);
}

export function buildAmountOptions(food: { portions: readonly FoodPortion[]; densityGPerMl: number | null }): AmountOption[] {
  const options: AmountOption[] = [];
  const portions = [...food.portions].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  for (const p of portions) {
    if (!(p.gramWeight > 0) || !(p.quantity > 0)) continue;
    const gramsPerUnit = p.gramWeight / p.quantity;
    const step = p.quantity < 1 ? p.quantity : p.quantity >= 5 ? 1 : 0.5;
    options.push({
      key: `p:${p.id}`,
      label: `${p.label} · ${formatNumber(p.gramWeight)} g`,
      unitLabel: portionUnitLabel(p),
      gramsPerUnit,
      defaultAmount: p.quantity,
      step,
      decimals: Math.max(1, Math.min(3, decimalsOf(step))),
      min: step,
      max: Math.max(step, Math.floor((MAX_LOG_GRAMS / gramsPerUnit) * 100) / 100),
    });
  }
  options.push({
    key: "g",
    label: "Gramos (g)",
    unitLabel: "g",
    gramsPerUnit: 1,
    defaultAmount: 100,
    step: 5,
    decimals: 0,
    min: 1,
    max: MAX_LOG_GRAMS,
  });
  if (food.densityGPerMl != null && food.densityGPerMl > 0) {
    options.push({
      key: "ml",
      label: "Mililitros (ml)",
      unitLabel: "ml",
      gramsPerUnit: food.densityGPerMl,
      defaultAmount: 250,
      step: 10,
      decimals: 0,
      min: 1,
      max: Math.floor(MAX_LOG_GRAMS / food.densityGPerMl),
    });
  }
  return options;
}

/** Opción inicial: la porción por defecto del alimento si existe; si no, gramos. */
export function defaultAmountOption(options: readonly AmountOption[], portions: readonly FoodPortion[]): AmountOption {
  const def = portions.find((p) => p.isDefault);
  return (def && options.find((o) => o.key === `p:${def.id}`)) || options.find((o) => o.key === "g") || options[0]!;
}

/** Gramos para `amount` unidades de la opción (2 decimales). */
export function gramsForAmount(option: Pick<AmountOption, "gramsPerUnit">, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return round2(amount * option.gramsPerUnit);
}

/** Cantidad y unidad que se guardan con el registro. En gramos, la cantidad son los gramos. */
export function storedQuantity(option: AmountOption, amount: number): { quantity: number; unit: string } {
  return { quantity: round2(amount), unit: option.unitLabel };
}

/**
 * Para editar un ítem ya registrado: reconoce la porción con la que se guardó (misma unidad y
 * mismos gramos) o vuelve a gramos.
 */
export function matchItemAmount(
  options: readonly AmountOption[],
  item: { quantity: number; unit: string; grams: number | null },
): { option: AmountOption; amount: number } {
  const grams = item.grams ?? 0;
  const g = options.find((o) => o.key === "g")!;
  if (item.unit !== "g") {
    const match = options.find(
      (o) => o.key !== "g" && o.unitLabel === item.unit && Math.abs(o.gramsPerUnit * item.quantity - grams) < 0.6,
    );
    if (match) return { option: match, amount: item.quantity };
  }
  return { option: g, amount: grams > 0 ? round2(grams) : g.defaultAmount };
}
