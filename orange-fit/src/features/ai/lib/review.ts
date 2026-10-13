/**
 * Estado de revisión de lo que propuso la IA antes de registrar. Cada ítem tiene el alimento
 * ELEGIDO de la base (o ninguno), la cantidad y si se incluye. Las vistas previas de nutrientes se
 * calculan con los valores por 100 g de la base (`scaleNutrients`); al confirmar, el servidor los
 * vuelve a calcular. Nada se registra hasta que la persona confirma. Puro y probado.
 */
import { buildAmountOptions, gramsForAmount, storedQuantity } from "@/features/diary/lib/portion-options";
import type { GramsRange } from "@/lib/ai/normalize";
import type { FoodWithPortions } from "@/lib/foods/api-types";
import { roundNutrients, scaleNutrients, sumNutrients, type NutrientAmounts, type NutrientTotals } from "@/lib/nutrition";
import { formatNumber } from "@/lib/format";
import type { PhotoCandidateDto, TextCandidateDto } from "../schemas";
import { resolveSpokenAmount } from "./resolve-amount";

export type ReviewItem = {
  key: string;
  origin: "ai" | "added";
  /** Lo que propuso la IA ("arroz blanco cocido") o el alimento agregado a mano. */
  title: string;
  /** Preparación (foto) o cantidad dicha (texto/voz). */
  detail: string | null;
  confidence: number | null;
  evidence: string | null;
  clarification: string | null;
  /** Rango de gramos estimado (solo foto). */
  range: GramsRange | null;
  /** Lo que dijo la persona (texto/voz), para recalcular al cambiar de alimento. */
  spoken: { quantity: number; unit: string; gramsIfStated: number | null } | null;
  matches: FoodWithPortions[];
  food: FoodWithPortions | null;
  optionKey: string;
  amount: number | null;
  included: boolean;
  note: string | null;
};

export const MAX_ITEM_GRAMS = 5000;

const fmtQty = (q: number) => formatNumber(q, Number.isInteger(q) ? 0 : Math.round(q * 10) === q * 10 ? 1 : 2);

export function confidenceLevel(confidence: number): { label: "alta" | "media" | "baja"; percent: number } {
  const percent = Math.round(Math.min(1, Math.max(0, confidence)) * 100);
  return { label: confidence >= 0.75 ? "alta" : confidence >= 0.45 ? "media" : "baja", percent };
}

export function photoReviewItems(candidates: readonly PhotoCandidateDto[]): ReviewItem[] {
  return candidates.map((c) => {
    const food = c.matches[0] ?? null;
    return {
      key: c.key,
      origin: "ai",
      title: c.nameEs,
      detail: c.preparation,
      confidence: c.confidence,
      evidence: c.visibleEvidence,
      clarification: null,
      range: c.estimatedGrams,
      spoken: null,
      matches: c.matches,
      food,
      optionKey: "g",
      amount: c.estimatedGrams.best,
      included: food !== null,
      note: null,
    };
  });
}

function withResolvedAmount(item: ReviewItem, food: FoodWithPortions | null): ReviewItem {
  if (!food) return { ...item, food: null, included: false, note: null };
  if (item.spoken) {
    const resolved = resolveSpokenAmount(item.spoken, food);
    return {
      ...item,
      food,
      optionKey: resolved.optionKey,
      amount: resolved.amount,
      note: resolved.note,
      included: item.origin === "added" ? true : resolved.amount !== null || item.included,
    };
  }
  // Foto o agregado a mano: se conservan los gramos.
  const grams = itemGrams(item);
  return { ...item, food, optionKey: "g", amount: grams ?? item.amount, note: null };
}

export function textReviewItems(candidates: readonly TextCandidateDto[]): ReviewItem[] {
  return candidates.map((c) => {
    const base: ReviewItem = {
      key: c.key,
      origin: "ai",
      title: c.foodQuery,
      detail: c.gramsIfStated != null ? `${fmtQty(c.gramsIfStated)} g` : `${fmtQty(c.quantity)} ${c.unit}`,
      confidence: null,
      evidence: null,
      clarification: c.needsClarification ? c.clarificationQuestion : null,
      range: null,
      spoken: { quantity: c.quantity, unit: c.unit, gramsIfStated: c.gramsIfStated },
      matches: c.matches,
      food: null,
      optionKey: "g",
      amount: null,
      included: false,
      note: null,
    };
    const resolved = withResolvedAmount(base, c.matches[0] ?? null);
    return { ...resolved, included: resolved.food !== null && resolved.amount !== null };
  });
}

/** Cambia el alimento elegido (recalcula la cantidad dicha con las porciones del nuevo alimento). */
export function selectFood(item: ReviewItem, food: FoodWithPortions | null): ReviewItem {
  const next = withResolvedAmount(item, food);
  const matches = food && !item.matches.some((m) => m.id === food.id) ? [...item.matches, food] : item.matches;
  return { ...next, matches, included: food ? (next.amount !== null ? true : next.included) : false };
}

/** Ítem agregado a mano desde la búsqueda (sin IA): porción por defecto o 100 g. */
export function addedReviewItem(food: FoodWithPortions, key: string): ReviewItem {
  const options = buildAmountOptions(food);
  const def = food.portions.find((p) => p.isDefault);
  const option = (def && options.find((o) => o.key === `p:${def.id}`)) || options.find((o) => o.key === "g")!;
  return {
    key,
    origin: "added",
    title: food.name,
    detail: null,
    confidence: null,
    evidence: null,
    clarification: null,
    range: null,
    spoken: null,
    matches: [food],
    food,
    optionKey: option.key,
    amount: option.defaultAmount,
    included: true,
    note: null,
  };
}

/** Gramos del ítem según la opción elegida (null si falta alimento o cantidad). */
export function itemGrams(item: Pick<ReviewItem, "food" | "optionKey" | "amount">): number | null {
  if (!item.food || item.amount == null || !(item.amount > 0)) return null;
  const options = buildAmountOptions(item.food);
  const option = options.find((o) => o.key === item.optionKey) ?? options.find((o) => o.key === "g")!;
  const grams = gramsForAmount(option, item.amount);
  return grams > 0 ? grams : null;
}

export function itemNutrients(item: ReviewItem): NutrientAmounts | null {
  const grams = itemGrams(item);
  if (!item.food || grams == null) return null;
  return roundNutrients(scaleNutrients(item.food.per100g, grams), 1);
}

export type ItemProblem = "no_food" | "no_amount" | "too_much";

export function itemProblem(item: ReviewItem): ItemProblem | null {
  if (!item.food) return "no_food";
  const grams = itemGrams(item);
  if (grams == null) return "no_amount";
  if (grams > MAX_ITEM_GRAMS) return "too_much";
  return null;
}

export function reviewTotals(items: readonly ReviewItem[]): { count: number; nutrients: NutrientTotals | null } {
  const list = items.filter((i) => i.included && itemProblem(i) === null).flatMap((i) => {
    const n = itemNutrients(i);
    return n ? [n] : [];
  });
  if (!list.length) return { count: 0, nutrients: null };
  return { count: list.length, nutrients: roundNutrients(sumNutrients(list), 1) };
}

export type ConfirmItem = {
  foodId: string;
  grams: number;
  quantity?: number;
  unit?: string;
  confidence?: number | null;
  origin: "ai" | "added";
};

/** Ítems listos para `confirmAiItemsAction` (solo los incluidos y válidos). */
export function toConfirmItems(items: readonly ReviewItem[]): { items: ConfirmItem[]; blocked: ReviewItem[] } {
  const out: ConfirmItem[] = [];
  const blocked: ReviewItem[] = [];
  for (const item of items) {
    if (!item.included) continue;
    const problem = itemProblem(item);
    if (problem || !item.food || item.amount == null) {
      blocked.push(item);
      continue;
    }
    const grams = itemGrams(item)!;
    const options = buildAmountOptions(item.food);
    const option = options.find((o) => o.key === item.optionKey) ?? options.find((o) => o.key === "g")!;
    const { quantity, unit } = storedQuantity(option, item.amount);
    out.push({ foodId: item.food.id, grams, quantity, unit, confidence: item.origin === "ai" ? item.confidence : null, origin: item.origin });
  }
  return { items: out, blocked };
}
