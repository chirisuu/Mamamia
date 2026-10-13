/**
 * Candidatos a duplicado en el catálogo público: nombre normalizado parecido (trigramas, como
 * pg_trgm), misma marca (o sin marca) y macros cercanos. Solo propone pares para que el staff
 * los revise en /admin; nunca fusiona ni borra nada por su cuenta.
 *
 * Las funciones de texto y puntaje son puras (sirven en cliente y servidor); solo
 * `findDuplicateCandidates` lee la base.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { toFoodSummary, type FoodRow, type FoodSummary } from "./types";

/** Sin tildes, minúsculas y espacios colapsados (equivale a `public.normalize_text`). */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Nombre de alimento comparable: además de `normalizeText`, quita signos de puntuación y unifica
 * unidades frecuentes en etiquetas ("500gr" → "500 g"). Reutilizable para búsquedas y deduplicación.
 */
export function normalizeFoodName(name: string): string {
  return normalizeText(name)
    .replace(/[%]/g, " % ")
    .replace(/[^a-z0-9% ]+/g, " ")
    .replace(/(\d)\s*(gr|grs|gramos|g)\b/g, "$1 g")
    .replace(/(\d)\s*(ml|cc)\b/g, "$1 ml")
    .replace(/(\d)\s*(kg|kilos?)\b/g, "$1 kg")
    .replace(/(\d)\s*(l|lt|lts|litros?)\b/g, "$1 l")
    .replace(/\s+/g, " ")
    .trim();
}

/** Trigramas de un texto al estilo de pg_trgm (cada palabra con dos espacios delante y uno detrás). */
export function trigrams(text: string): Set<string> {
  const out = new Set<string>();
  for (const word of normalizeFoodName(text).split(" ")) {
    if (!word) continue;
    const padded = `  ${word} `;
    for (let i = 0; i + 3 <= padded.length; i++) out.add(padded.slice(i, i + 3));
  }
  return out;
}

/** Similitud de Jaccard entre conjuntos de trigramas (0–1), igual que `similarity()` de pg_trgm. */
export function trigramSimilarity(a: string | Set<string>, b: string | Set<string>): number {
  const ta = typeof a === "string" ? trigrams(a) : a;
  const tb = typeof b === "string" ? trigrams(b) : b;
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  const [small, large] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  for (const t of small) if (large.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

type MacroFood = Pick<FoodSummary, "per100g">;

/**
 * Cercanía de macros por 100 g (0–1). Compara energía, proteína, carbohidratos y grasa con un
 * margen mínimo (20 kcal, 2 g) para que valores pequeños no exageren la diferencia relativa.
 */
export function macroCloseness(a: MacroFood, b: MacroFood): number {
  const pairs: Array<[number, number, number]> = [
    [a.per100g.energyKcal, b.per100g.energyKcal, 20],
    [a.per100g.proteinG, b.per100g.proteinG, 2],
    [a.per100g.carbsG, b.per100g.carbsG, 2],
    [a.per100g.fatG, b.per100g.fatG, 2],
  ];
  let total = 0;
  for (const [x, y, floor] of pairs) {
    const diff = Math.abs(x - y) / Math.max(Math.abs(x), Math.abs(y), floor);
    total += Math.min(1, diff);
  }
  return 1 - total / pairs.length;
}

export type DuplicateFood = Pick<FoodSummary, "name" | "brandName" | "barcode" | "per100g">;

export type DuplicateScore = {
  /** Puntaje combinado (0–1). */
  similarity: number;
  name: number;
  macros: number;
  brand: "same" | "different" | "unknown";
};

/**
 * Puntaje de "probable duplicado": 60 % nombre + 40 % macros. Marcas distintas o códigos de
 * barras distintos indican productos distintos (se penaliza fuerte); misma marca suma un poco.
 */
export function scoreDuplicate(a: DuplicateFood, b: DuplicateFood, nameSimilarity?: number): DuplicateScore {
  const name = nameSimilarity ?? trigramSimilarity(a.name, b.name);
  const macros = macroCloseness(a, b);
  const brandA = a.brandName ? normalizeText(a.brandName) : "";
  const brandB = b.brandName ? normalizeText(b.brandName) : "";
  const brand: DuplicateScore["brand"] = brandA && brandB ? (brandA === brandB ? "same" : "different") : "unknown";
  let similarity = 0.6 * name + 0.4 * macros;
  if (brand === "same") similarity += 0.05;
  if (brand === "different") similarity -= 0.3;
  if (a.barcode && b.barcode) similarity = a.barcode === b.barcode ? 1 : similarity - 0.3;
  return { similarity: Math.max(0, Math.min(1, Number(similarity.toFixed(4)))), name, macros, brand };
}

export type DuplicatePair<T> = { a: T; b: T; similarity: number };

export type DuplicateOptions = {
  /** Máximo de pares devueltos (por defecto 50, máx. 500). */
  limit?: number;
  /** Puntaje combinado mínimo (por defecto 0.8). */
  threshold?: number;
  /** Similitud mínima de nombre para considerar un par (por defecto 0.45). */
  minNameSimilarity?: number;
};

/**
 * Pares candidatos en una lista ya cargada. Usa un índice invertido de trigramas para no comparar
 * todos contra todos: solo se puntúan pares que comparten trigramas.
 */
export function findDuplicatePairs<T extends DuplicateFood>(foods: readonly T[], opts: DuplicateOptions = {}): Array<DuplicatePair<T>> {
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? 50), 1), 500);
  const threshold = opts.threshold ?? 0.8;
  const minName = opts.minNameSimilarity ?? 0.45;

  const grams = foods.map((f) => trigrams(f.name));
  const index = new Map<string, number[]>();
  grams.forEach((set, i) => {
    for (const t of set) {
      const list = index.get(t);
      if (list) list.push(i);
      else index.set(t, [i]);
    }
  });

  const pairs: Array<DuplicatePair<T>> = [];
  for (let i = 0; i < foods.length; i++) {
    const shared = new Map<number, number>();
    for (const t of grams[i]) {
      for (const j of index.get(t) ?? []) {
        if (j > i) shared.set(j, (shared.get(j) ?? 0) + 1);
      }
    }
    for (const [j, count] of shared) {
      const name = count / (grams[i].size + grams[j].size - count);
      if (name < minName) continue;
      const score = scoreDuplicate(foods[i], foods[j], name);
      if (score.similarity >= threshold) pairs.push({ a: foods[i], b: foods[j], similarity: score.similarity });
    }
  }
  pairs.sort((x, y) => y.similarity - x.similarity || x.a.name.localeCompare(y.a.name, "es"));
  return pairs.slice(0, limit);
}

const PAGE = 1000;
const MAX_FOODS = 20_000;

/**
 * CONTRATO 4. Candidatos a duplicado entre alimentos públicos (no rechazados). Pensado para el
 * panel admin con la sesión del staff (RLS) o el cliente admin ya autorizado.
 */
export async function findDuplicateCandidates(
  supabase: SupabaseClient<Database>,
  opts: { limit?: number; threshold?: number } = {},
): Promise<Array<{ a: FoodSummary; b: FoodSummary; similarity: number }>> {
  const foods: FoodSummary[] = [];
  for (let from = 0; from < MAX_FOODS; from += PAGE) {
    const { data, error } = await supabase
      .from("foods")
      .select("*, brands(name)")
      .eq("is_public", true)
      .neq("verification_status", "rejected")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`foods: ${error.code ?? "error"}`);
    for (const row of data ?? []) {
      const { brands, ...food } = row as FoodRow & { brands: { name: string } | null };
      foods.push(toFoodSummary(food, null, brands?.name ?? null));
    }
    if (!data || data.length < PAGE) break;
  }
  return findDuplicatePairs(foods, opts);
}
