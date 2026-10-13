/**
 * Lectura del plan compartido (`get_shared_plan(token)`): solo comidas, sin datos personales.
 * Puro y tolerante a datos raros (el JSON viene de una función de la base).
 */
import { addDays, isIsoDate } from "@/lib/dates";
import { formatLongDate } from "@/lib/format";
import { roundDecimals } from "@/lib/nutrition";
import { slotFromPosition } from "./plan";

/** El token es hexadecimal (UUID sin guiones); se aceptan 16–128 caracteres seguros. */
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Desayuno",
  lunch: "Almuerzo",
  dinner: "Cena",
  snack: "Snack",
  custom: "Otra comida",
};

export interface SharedMeal {
  mealLabel: string;
  title: string;
  slug: string | null;
  amount: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface SharedDay {
  dayIndex: number;
  label: string;
  meals: SharedMeal[];
  totals: { kcal: number; proteinG: number; carbsG: number; fatG: number };
}

export interface SharedPlanView {
  name: string;
  startDate: string;
  days: number;
  sharedAt: string | null;
  dayList: SharedDay[];
}

const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function parseSharedPlan(raw: unknown): SharedPlanView | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const startDate = typeof o.start_date === "string" && isIsoDate(o.start_date) ? o.start_date : null;
  const days = Math.max(1, Math.min(14, Math.round(num(o.days))));
  if (!startDate || typeof o.name !== "string") return null;
  const items = Array.isArray(o.items) ? (o.items as Array<Record<string, unknown>>) : [];

  const dayList: SharedDay[] = Array.from({ length: days }, (_, dayIndex) => {
    const meals = items
      .filter((it) => num(it.day_index) === dayIndex)
      .sort((a, b) => slotFromPosition(num(a.position)) - slotFromPosition(num(b.position)) || num(a.position) - num(b.position))
      .map((it): SharedMeal => {
        const recipe = it.recipe && typeof it.recipe === "object" ? (it.recipe as Record<string, unknown>) : null;
        const food = it.food && typeof it.food === "object" ? (it.food as Record<string, unknown>) : null;
        const servings = it.servings == null ? null : num(it.servings);
        const grams = it.grams == null ? null : num(it.grams);
        return {
          mealLabel: MEAL_LABELS[String(it.meal_type)] ?? "Comida",
          title: typeof recipe?.title === "string" ? recipe.title : typeof food?.name === "string" ? food.name : "Comida no disponible",
          slug: typeof recipe?.slug === "string" ? recipe.slug : null,
          amount: servings != null ? `${servings} ${servings === 1 ? "porción" : "porciones"}` : grams != null ? `${grams} g` : "",
          kcal: num(it.energy_kcal),
          proteinG: num(it.protein_g),
          carbsG: num(it.carbs_g),
          fatG: num(it.fat_g),
        };
      });
    return {
      dayIndex,
      label: `Día ${dayIndex + 1} · ${formatLongDate(addDays(startDate, dayIndex))}`,
      meals,
      totals: {
        kcal: roundDecimals(meals.reduce((s, m) => s + m.kcal, 0), 0),
        proteinG: roundDecimals(meals.reduce((s, m) => s + m.proteinG, 0), 1),
        carbsG: roundDecimals(meals.reduce((s, m) => s + m.carbsG, 0), 1),
        fatG: roundDecimals(meals.reduce((s, m) => s + m.fatG, 0), 1),
      },
    };
  });
  return { name: o.name, startDate, days, sharedAt: typeof o.shared_at === "string" ? o.shared_at : null, dayList };
}
