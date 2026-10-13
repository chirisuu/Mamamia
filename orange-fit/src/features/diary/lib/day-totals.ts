/**
 * Totales del día y armado de las secciones del diario. Puro y probado.
 * Fibra, azúcar y sodio pueden faltar en algunos ítems: el total es entonces un mínimo y se
 * marca como incompleto (mismo criterio que `sumNutrients`).
 */
import { sumNutrients } from "@/lib/nutrition";
import { MEAL_SECTION_LABELS, STANDARD_MEALS } from "./meal-time";
import type { DiaryItem, DiaryMeal, MealOption, MealType } from "../types";

export type ItemNutrients = Pick<DiaryItem, "energyKcal" | "proteinG" | "carbsG" | "fatG" | "fiberG" | "sugarG" | "sodiumMg">;

export type DayTotals = {
  itemsCount: number;
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** null si ningún ítem tiene el dato. */
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  /** Nutrientes que faltan en algún ítem: su total es un mínimo. */
  incomplete: Array<"fiberG" | "sugarG" | "sodiumMg">;
};

const round1 = (v: number) => Math.round(v * 10) / 10;

export function summarizeItems(items: readonly ItemNutrients[]): DayTotals {
  if (items.length === 0) {
    return { itemsCount: 0, energyKcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: null, sugarG: null, sodiumMg: null, incomplete: [] };
  }
  const t = sumNutrients(
    items.map((i) => ({
      energyKcal: i.energyKcal,
      proteinG: i.proteinG,
      carbsG: i.carbsG,
      fatG: i.fatG,
      fiberG: i.fiberG,
      sugarG: i.sugarG,
      saturatedFatG: null,
      sodiumMg: i.sodiumMg,
      micronutrients: {},
    })),
  );
  return {
    itemsCount: items.length,
    energyKcal: round1(t.energyKcal),
    proteinG: round1(t.proteinG),
    carbsG: round1(t.carbsG),
    fatG: round1(t.fatG),
    fiberG: t.fiberG == null ? null : round1(t.fiberG),
    sugarG: t.sugarG == null ? null : round1(t.sugarG),
    sodiumMg: t.sodiumMg == null ? null : Math.round(t.sodiumMg),
    incomplete: t.incomplete.filter((k): k is "fiberG" | "sugarG" | "sodiumMg" => k !== "saturatedFatG"),
  };
}

export type MealLogLike = { id: string; mealType: MealType; customName: string | null; createdAt: string };

export function mealLabel(mealType: MealType, customName: string | null): string {
  if (mealType === "custom") return customName ?? "Otra comida";
  return MEAL_SECTION_LABELS[mealType];
}

/**
 * Secciones del día: siempre Desayuno, Almuerzo, Cena y Snacks (aunque estén vacías) y luego
 * las comidas personalizadas en el orden en que se crearon.
 */
export function buildMealSections(mealLogs: readonly MealLogLike[], items: readonly DiaryItem[]): DiaryMeal[] {
  const byMeal = new Map<string, DiaryItem[]>();
  for (const item of items) {
    const list = byMeal.get(item.mealLogId) ?? [];
    list.push(item);
    byMeal.set(item.mealLogId, list);
  }
  const make = (log: MealLogLike | undefined, mealType: MealType, customName: string | null): DiaryMeal => {
    const list = log ? (byMeal.get(log.id) ?? []) : [];
    const t = summarizeItems(list);
    return {
      id: log?.id ?? null,
      mealType,
      customName,
      label: mealLabel(mealType, customName),
      items: list,
      kcal: t.energyKcal,
      proteinG: t.proteinG,
      carbsG: t.carbsG,
      fatG: t.fatG,
    };
  };
  const standard = STANDARD_MEALS.map((type) => make(mealLogs.find((m) => m.mealType === type && !m.customName), type, null));
  const custom = mealLogs
    .filter((m) => m.mealType === "custom")
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
    .map((m) => make(m, "custom", m.customName));
  return [...standard, ...custom];
}

export function mealOptionsFrom(meals: readonly Pick<DiaryMeal, "mealType" | "customName" | "label">[]): MealOption[] {
  return meals.map((m) => ({ mealType: m.mealType, customName: m.customName, label: m.label }));
}

/** Clave estable de una comida (para selects): "lunch" o "custom:Media mañana". */
export function mealKey(m: { mealType: MealType; customName: string | null }): string {
  return m.mealType === "custom" ? `custom:${m.customName ?? ""}` : m.mealType;
}

export function parseMealKey(key: string): { mealType: MealType; customName: string | null } | null {
  if (key.startsWith("custom:")) {
    const name = key.slice(7).trim();
    return name ? { mealType: "custom", customName: name } : null;
  }
  return (STANDARD_MEALS as readonly string[]).includes(key) ? { mealType: key as MealType, customName: null } : null;
}
