/**
 * Comida por defecto según la hora LOCAL del usuario (zona del perfil) y límites de fechas del
 * diario. Puro: sin I/O, probado en meal-time.test.ts.
 */
import { addDays, DEFAULT_TIMEZONE, isIsoDate } from "@/lib/dates";
import { formatShortDate } from "@/lib/format";

export const STANDARD_MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type StandardMeal = (typeof STANDARD_MEALS)[number];

export const MEAL_SECTION_LABELS: Record<StandardMeal, string> = {
  breakfast: "Desayuno",
  lunch: "Almuerzo",
  dinner: "Cena",
  snack: "Snacks",
};

/** Hora local (0–23) de un instante en una zona IANA. */
export function localHourInTz(instant: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).formatToParts(instant);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return Number.isFinite(hour) ? hour % 24 : 0;
}

/**
 * Horarios habituales en Perú: desayuno 4–10 h, almuerzo 11–15 h (se almuerza tarde),
 * media tarde 16–18 h, cena 19–22 h; de madrugada, snack.
 */
export function defaultMealForHour(hour: number): StandardMeal {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 4 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  if (h >= 16 && h < 19) return "snack";
  if (h >= 19 && h < 23) return "dinner";
  return "snack";
}

export function defaultMealNow(timeZone: string = DEFAULT_TIMEZONE, now: Date = new Date()): StandardMeal {
  return defaultMealForHour(localHourInTz(now, timeZone));
}

/** Fecha mínima aceptada en el diario (evita fechas absurdas por error de tipeo). */
export const MIN_DIARY_DATE = "2000-01-01";

/** Se permite registrar el pasado y hasta mañana (planificar el desayuno), nunca más allá. */
export function maxDiaryDate(today: string): string {
  return addDays(today, 1);
}

export function isAllowedDiaryDate(date: string, today: string): boolean {
  return isIsoDate(date) && date >= MIN_DIARY_DATE && date <= maxDiaryDate(today);
}

/** Saludo según la hora local. */
export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** "Hoy", "Ayer", "Mañana" o "lun 13 oct". */
export function dayLabel(date: string, today: string): string {
  if (date === today) return "Hoy";
  if (date === addDays(today, -1)) return "Ayer";
  if (date === addDays(today, 1)) return "Mañana";
  return formatShortDate(date);
}

/** Las 4 comidas estándar como destinos elegibles. */
export const STANDARD_MEAL_OPTIONS: ReadonlyArray<{ mealType: StandardMeal; customName: null; label: string }> = STANDARD_MEALS.map(
  (m) => ({ mealType: m, customName: null, label: MEAL_SECTION_LABELS[m] }),
);
