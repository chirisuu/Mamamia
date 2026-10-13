/**
 * Comidas y fechas válidas para registrar desde el escáner. Puro (cliente y servidor).
 */
import { addDays, isIsoDate } from "@/lib/dates";
import type { Database } from "@/lib/db/database.types";

export type MealType = Database["public"]["Enums"]["meal_type"];

export const STANDARD_MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

export const MEAL_LABELS: Record<(typeof STANDARD_MEAL_TYPES)[number], string> = {
  breakfast: "Desayuno",
  lunch: "Almuerzo",
  dinner: "Cena",
  snack: "Snacks",
};

export type MealChoice = { mealType: MealType; customName: string | null; label: string };

export function mealDisplayName(mealType: MealType, customName: string | null | undefined): string {
  if (mealType === "custom") return customName?.trim() || "Comida personalizada";
  return MEAL_LABELS[mealType];
}

/** Clave estable de una comida para un <select> ("lunch", "custom:Pre-entreno"). */
export const mealChoiceKey = (m: Pick<MealChoice, "mealType" | "customName">) =>
  m.mealType === "custom" ? `custom:${m.customName ?? ""}` : m.mealType;

/** Las 4 comidas estándar + las personalizadas que ya existen ese día. */
export function mealChoices(customNames: readonly string[] = []): MealChoice[] {
  const seen = new Set<string>();
  const custom = customNames
    .map((n) => n.trim())
    .filter((n) => n && !seen.has(n) && seen.add(n))
    .map((n) => ({ mealType: "custom" as const, customName: n, label: n }));
  return [...STANDARD_MEAL_TYPES.map((m) => ({ mealType: m, customName: null, label: MEAL_LABELS[m] })), ...custom];
}

/** Se registra el pasado (desde 2000) y hasta mañana, igual que el diario. */
export function isLoggableDate(date: string, today: string): boolean {
  return isIsoDate(date) && date >= "2000-01-01" && date <= addDays(today, 1);
}
