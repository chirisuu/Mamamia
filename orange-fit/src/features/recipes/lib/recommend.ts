/**
 * "Para tu meta de hoy" (Premium, feature `smart_recipes`): recetas que encajan con las kcal y la
 * proteína que aún quedan en el día. Reglas simples y explicables, sin IA. Nunca empuja a comer
 * menos de lo necesario ni regaña: si la meta ya está cubierta, solo lo informa.
 */
import { roundDecimals, roundTo, type DietPattern } from "@/lib/nutrition";
import type { RecipeCard } from "./adapters";
import { hasAllergen, matchesDiet } from "./filters";
import type { DietTag, RecipeMealType } from "./labels";

export interface TodayContext {
  /** kcal que faltan para la meta (puede ser negativo). null si no hay meta. */
  remainingKcal: number | null;
  /** Proteína que falta (g, ≥ 0). null si no hay meta de proteína. */
  remainingProteinG: number | null;
  avoidAllergens?: readonly string[];
  dietPattern?: DietPattern | string | null;
  /** Comida sugerida por la hora (se prefiere, no excluye). */
  mealType?: RecipeMealType | null;
}

export interface RecipeSuggestion {
  card: RecipeCard;
  servings: number;
  kcal: number;
  proteinG: number;
  reason: string;
}

export type SuggestionResult =
  | { status: "no_target"; items: [] }
  | { status: "met"; items: [] }
  | { status: "none"; items: [] }
  | { status: "ok"; items: RecipeSuggestion[] };

/** Por debajo de esto ya no se sugiere una comida completa. */
export const MIN_REMAINING_KCAL = 150;
const MIN_SERVINGS = 0.5;
const MAX_SERVINGS = 2;

/** Patrones de dieta que son filtro duro (igual que el planificador). */
const PATTERN_TAG: Partial<Record<string, DietTag>> = {
  vegetarian: "vegetarian",
  vegan: "vegan",
  pescatarian: "pescatarian",
  low_carb: "low_carb",
  keto: "keto",
};

/** Mayor porción (en pasos de 0.25, 0.5–2) que no se pasa de las kcal restantes. */
export function fittingServings(kcalPerServing: number, remainingKcal: number): number | null {
  if (!(kcalPerServing > 0) || !(remainingKcal > 0)) return null;
  const raw = Math.floor((remainingKcal / kcalPerServing) * 4) / 4;
  const s = Math.min(MAX_SERVINGS, raw);
  return s >= MIN_SERVINGS ? roundTo(s, 0.25) : null;
}

export function recommendForToday(cards: readonly RecipeCard[], ctx: TodayContext, limit = 4): SuggestionResult {
  if (ctx.remainingKcal == null) return { status: "no_target", items: [] };
  if (ctx.remainingKcal < MIN_REMAINING_KCAL) return { status: "met", items: [] };
  const remaining = ctx.remainingKcal;
  const proteinLeft = Math.max(0, ctx.remainingProteinG ?? 0);
  const patternTag = ctx.dietPattern ? PATTERN_TAG[ctx.dietPattern] : undefined;

  const scored: Array<RecipeSuggestion & { score: number }> = [];
  for (const card of cards) {
    const ps = card.perServing;
    if (!ps || ps.kcal <= 0) continue;
    if (hasAllergen(card, ctx.avoidAllergens ?? [])) continue;
    if (patternTag && !matchesDiet(card, patternTag)) continue;
    // Una comida no debería ocupar todo lo que queda si es mucho: se apunta a ~60 % (máx. 900 kcal).
    const aim = Math.min(remaining, Math.max(MIN_REMAINING_KCAL, Math.min(remaining * 0.6, 900)));
    // Si ni media porción entra en el objetivo, se acepta media porción mientras quepa en lo restante.
    const servings = fittingServings(ps.kcal, aim) ?? (ps.kcal * MIN_SERVINGS <= remaining ? MIN_SERVINGS : null);
    if (servings == null) continue;
    const kcal = ps.kcal * servings;
    const protein = ps.proteinG * servings;
    const proteinCover = proteinLeft > 0 ? Math.min(protein, proteinLeft) / proteinLeft : 0;
    const fit = 1 - Math.min(1, Math.abs(kcal - aim) / aim);
    const mealBonus = ctx.mealType && card.mealTypes.includes(ctx.mealType) ? 0.25 : 0;
    const score = (proteinLeft > 0 ? 1.2 * proteinCover : 0) + fit + mealBonus + 0.002 * ((ps.proteinG / ps.kcal) * 100);
    const reason =
      proteinLeft > 0
        ? `Aporta ${Math.round(protein)} g de proteína (${Math.round(proteinCover * 100)} % de lo que te falta) en ${Math.round(kcal)} kcal.`
        : `Son ${Math.round(kcal)} kcal y entran en lo que te queda hoy.`;
    scored.push({ card, servings, kcal: roundDecimals(kcal, 0), proteinG: roundDecimals(protein, 1), reason, score });
  }
  if (scored.length === 0) return { status: "none", items: [] };
  scored.sort((a, b) => b.score - a.score || a.card.title.localeCompare(b.card.title, "es"));
  return { status: "ok", items: scored.slice(0, limit).map((s) => ({ card: s.card, servings: s.servings, kcal: s.kcal, proteinG: s.proteinG, reason: s.reason })) };
}
