/**
 * Normaliza la salida estructurada del modelo (snake_case) al formato de la app (camelCase),
 * ordenando rangos, recortando textos y descartando ítems vacíos. Puro y probado.
 */
import { MAX_PHOTO_ITEMS, MAX_TEXT_ITEMS, type PhotoAnalysisOutput, type TextParseOutput } from "./schemas";

export type GramsRange = { min: number; best: number; max: number };

export type PhotoCandidate = {
  nameEs: string;
  preparation: string | null;
  estimatedGrams: GramsRange;
  /** 0–1: seguridad de la identificación (no de los gramos). */
  confidence: number;
  visibleEvidence: string | null;
};

export type PhotoAnalysis = {
  isFoodImage: boolean;
  items: PhotoCandidate[];
  uncertaintyNote: string | null;
};

export type TextCandidate = {
  foodQuery: string;
  quantity: number;
  unit: string;
  gramsIfStated: number | null;
  needsClarification: boolean;
  clarificationQuestion: string | null;
};

export type TextParse = { items: TextCandidate[] };

const MAX_GRAMS = 5000;

function cleanText(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Rango ordenado (min ≤ best ≤ max), en gramos enteros, entre 1 y 5000. */
export function normalizeGramsRange(range: { min: number; best: number; max: number }): GramsRange {
  const values = [range.min, range.best, range.max].map((v) => (Number.isFinite(v) ? v : 0));
  const sorted = [...values].sort((a, b) => a - b);
  const best = clamp(Math.round(Number.isFinite(range.best) ? clamp(range.best, sorted[0], sorted[2]) : sorted[1]), 1, MAX_GRAMS);
  const min = clamp(Math.round(sorted[0]), 1, best);
  const max = clamp(Math.round(sorted[2]), best, MAX_GRAMS);
  return { min, best, max };
}

export function normalizePhotoAnalysis(output: PhotoAnalysisOutput): PhotoAnalysis {
  const uncertaintyNote = cleanText(output.uncertainty_note, 400);
  if (!output.is_food_image) return { isFoodImage: false, items: [], uncertaintyNote };
  const items: PhotoCandidate[] = [];
  for (const item of output.items) {
    const nameEs = cleanText(item.name_es, 80);
    if (!nameEs) continue;
    const range = normalizeGramsRange(item.estimated_grams);
    const preparation = cleanText(item.preparation, 60);
    items.push({
      nameEs,
      preparation: preparation && !/^no se distingue\.?$/i.test(preparation) ? preparation : null,
      estimatedGrams: range,
      confidence: Math.round(clamp(Number.isFinite(item.confidence) ? item.confidence : 0, 0, 1) * 100) / 100,
      visibleEvidence: cleanText(item.visible_evidence, 200),
    });
    if (items.length >= MAX_PHOTO_ITEMS) break;
  }
  return { isFoodImage: true, items, uncertaintyNote };
}

export function normalizeTextParse(output: TextParseOutput): TextParse {
  const items: TextCandidate[] = [];
  for (const item of output.items) {
    const foodQuery = cleanText(item.food_query, 80);
    if (!foodQuery) continue;
    const hasQuantity = Number.isFinite(item.quantity) && item.quantity > 0;
    const quantity = hasQuantity ? Math.round(item.quantity * 1000) / 1000 : 1;
    const unit = cleanText(item.unit, 40)?.toLowerCase() ?? "unidad";
    const gramsIfStated =
      item.grams_if_stated != null && Number.isFinite(item.grams_if_stated) && item.grams_if_stated > 0
        ? Math.min(MAX_GRAMS, Math.round(item.grams_if_stated * 10) / 10)
        : null;
    let question = cleanText(item.clarification_question, 200);
    const needsClarification = Boolean(item.needs_clarification) || Boolean(question) || !hasQuantity;
    if (needsClarification && !question) question = `¿Cuánto comiste de ${foodQuery}?`;
    items.push({
      foodQuery,
      quantity,
      unit,
      gramsIfStated,
      needsClarification,
      clarificationQuestion: needsClarification ? question : null,
    });
    if (items.length >= MAX_TEXT_ITEMS) break;
  }
  return { items };
}
