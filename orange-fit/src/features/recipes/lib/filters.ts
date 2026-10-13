/**
 * Filtros del catálogo de recetas: lectura desde la URL, aplicación y orden. Puro.
 *
 * Parámetros de URL: `q`, `comida`, `dieta` (lista), `sin` (alérgenos a excluir, lista), `tiempo`
 * (minutos máx.), `costo` (costo máx. por porción), `favoritas=1`, `mias=1`, `orden`.
 * Si `sin` NO viene en la URL se usan los alérgenos del objetivo activo; `sin=` (vacío) significa
 * "no excluir ninguno" (la persona lo quitó a propósito).
 */
import { normalizeKey } from "@/lib/nutrition";
import type { RecipeCard } from "./adapters";
import { proteinDensity } from "./adapters";
import { isAllergen, isDietTag, isRecipeMealType, type Allergen, type DietTag, type RecipeMealType } from "./labels";

export const RECIPE_SORTS = ["nombre", "proteina", "tiempo", "costo", "kcal"] as const;
export type RecipeSort = (typeof RECIPE_SORTS)[number];

export const RECIPE_SORT_LABELS: Record<RecipeSort, string> = {
  nombre: "Nombre",
  proteina: "Más proteína por kcal",
  tiempo: "Más rápidas",
  costo: "Más económicas",
  kcal: "Menos kcal por porción",
};

export interface RecipeFilters {
  q: string;
  mealType: RecipeMealType | null;
  diet: DietTag[];
  excludeAllergens: Allergen[];
  /** true si los alérgenos excluidos vienen del objetivo (no de la URL). */
  allergensFromGoal: boolean;
  maxMinutes: number | null;
  maxCost: number | null;
  favorites: boolean;
  mine: boolean;
  sort: RecipeSort;
}

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function get(params: Params, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

function has(params: Params, key: string): boolean {
  if (params instanceof URLSearchParams) return params.has(key);
  return params[key] !== undefined;
}

const list = (raw: string | undefined) =>
  (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

function positive(raw: string | undefined, max: number): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(n, max);
}

export function parseRecipeFilters(params: Params, goalAllergens: readonly string[] = []): RecipeFilters {
  const comida = get(params, "comida");
  const orden = get(params, "orden");
  const fromUrl = has(params, "sin");
  const allergenSource = fromUrl ? list(get(params, "sin")) : [...goalAllergens];
  return {
    q: (get(params, "q") ?? "").trim().slice(0, 80),
    mealType: comida && isRecipeMealType(comida) ? comida : null,
    diet: [...new Set(list(get(params, "dieta")).filter(isDietTag))],
    excludeAllergens: [...new Set(allergenSource.map((a) => normalizeKey(a).replace(/\s+/g, "_")).filter(isAllergen))],
    allergensFromGoal: !fromUrl && goalAllergens.length > 0,
    maxMinutes: positive(get(params, "tiempo"), 1440),
    maxCost: positive(get(params, "costo"), 10000),
    favorites: get(params, "favoritas") === "1",
    mine: get(params, "mias") === "1",
    sort: orden && (RECIPE_SORTS as readonly string[]).includes(orden) ? (orden as RecipeSort) : "nombre",
  };
}

/** Pasa los filtros a parámetros de URL (lo que coincide con el valor por defecto se omite). */
export function filtersToSearchParams(f: RecipeFilters, opts: { keepAllergens?: boolean } = {}): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.mealType) p.set("comida", f.mealType);
  if (f.diet.length) p.set("dieta", f.diet.join(","));
  // Los alérgenos del objetivo son el valor por defecto: solo se escriben si la persona los cambió.
  if (!f.allergensFromGoal || opts.keepAllergens) p.set("sin", f.excludeAllergens.join(","));
  if (f.maxMinutes) p.set("tiempo", String(f.maxMinutes));
  if (f.maxCost) p.set("costo", String(f.maxCost));
  if (f.favorites) p.set("favoritas", "1");
  if (f.mine) p.set("mias", "1");
  if (f.sort !== "nombre") p.set("orden", f.sort);
  return p;
}

/** Un filtro de dieta acepta también las etiquetas más estrictas (una receta vegana es vegetariana). */
const DIET_ACCEPTS: Partial<Record<DietTag, readonly string[]>> = {
  vegetarian: ["vegetarian", "vegan"],
  pescatarian: ["pescatarian", "vegetarian", "vegan"],
  low_carb: ["low_carb", "keto"],
};

export function matchesDiet(card: Pick<RecipeCard, "dietTags">, tag: DietTag): boolean {
  const accepted = DIET_ACCEPTS[tag] ?? [tag];
  return card.dietTags.some((t) => accepted.includes(t));
}

export function hasAllergen(card: Pick<RecipeCard, "allergens">, avoid: readonly string[]): boolean {
  if (avoid.length === 0) return false;
  const set = new Set(avoid.map((a) => normalizeKey(a).replace(/\s+/g, "_")));
  return card.allergens.some((a) => set.has(normalizeKey(a).replace(/\s+/g, "_")));
}

function searchText(card: RecipeCard): string {
  return normalizeKey([card.title, card.description ?? "", ...card.tags].join(" "));
}

export function filterRecipes(cards: readonly RecipeCard[], f: RecipeFilters, favoriteIds: ReadonlySet<string> = new Set()): RecipeCard[] {
  const words = normalizeKey(f.q).split(" ").filter(Boolean);
  const out = cards.filter((c) => {
    if (words.length && !words.every((w) => searchText(c).includes(w))) return false;
    if (f.mealType && !c.mealTypes.includes(f.mealType)) return false;
    if (f.diet.some((t) => !matchesDiet(c, t))) return false;
    if (hasAllergen(c, f.excludeAllergens)) return false;
    if (f.maxMinutes != null && (c.totalMinutes == null || c.totalMinutes > f.maxMinutes)) return false;
    if (f.maxCost != null && (c.costPerServing == null || c.costPerServing > f.maxCost)) return false;
    if (f.favorites && !favoriteIds.has(c.id)) return false;
    if (f.mine && !c.isOwn) return false;
    return true;
  });
  return sortRecipes(out, f.sort);
}

const byTitle = (a: RecipeCard, b: RecipeCard) => a.title.localeCompare(b.title, "es");
const nullLast = (a: number | null, b: number | null) => (a == null ? (b == null ? 0 : 1) : b == null ? -1 : a - b);

export function sortRecipes(cards: readonly RecipeCard[], sort: RecipeSort): RecipeCard[] {
  const list = [...cards];
  switch (sort) {
    case "proteina":
      return list.sort((a, b) => proteinDensity(b) - proteinDensity(a) || byTitle(a, b));
    case "tiempo":
      return list.sort((a, b) => nullLast(a.totalMinutes, b.totalMinutes) || byTitle(a, b));
    case "costo":
      return list.sort((a, b) => nullLast(a.costPerServing, b.costPerServing) || byTitle(a, b));
    case "kcal":
      return list.sort((a, b) => nullLast(a.perServing?.kcal ?? null, b.perServing?.kcal ?? null) || byTitle(a, b));
    default:
      return list.sort(byTitle);
  }
}

/** Cuántos filtros (además de la búsqueda) están activos, para el botón "Filtros (n)". */
export function activeFilterCount(f: RecipeFilters): number {
  return (
    (f.mealType ? 1 : 0) +
    f.diet.length +
    (f.excludeAllergens.length ? 1 : 0) +
    (f.maxMinutes ? 1 : 0) +
    (f.maxCost ? 1 : 0) +
    (f.favorites ? 1 : 0) +
    (f.mine ? 1 : 0)
  );
}
