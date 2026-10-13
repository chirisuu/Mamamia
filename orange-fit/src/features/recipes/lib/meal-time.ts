/** Comida sugerida según la hora LOCAL del usuario (mismos horarios que el diario). Puro. */
import { DEFAULT_TIMEZONE } from "@/lib/dates";
import type { RecipeMealType } from "./labels";

export function localHourInTz(instant: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).formatToParts(instant);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return Number.isFinite(hour) ? hour % 24 : 0;
}

/** Desayuno 4–10 h, almuerzo 11–15 h, media tarde 16–18 h, cena 19–22 h; de madrugada, snack. */
export function mealForHour(hour: number): RecipeMealType {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= 4 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  if (h >= 16 && h < 19) return "snack";
  if (h >= 19 && h < 23) return "dinner";
  return "snack";
}
