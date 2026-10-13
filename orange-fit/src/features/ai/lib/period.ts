/**
 * Mes de cupo en la zona horaria del perfil (igual que `consume_ai_quota`). Puro y probado.
 */
import { DEFAULT_TIMEZONE, localDateInTz } from "@/lib/dates";

/** Diferencia (ms) entre la hora local de `timeZone` y UTC en un instante. */
export function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Instante UTC de la medianoche local de una fecha (YYYY-MM-DD) en una zona horaria. */
export function zonedMidnightUtc(localDate: string, timeZone: string = DEFAULT_TIMEZONE): Date {
  const [y, m, d] = localDate.split("-").map(Number) as [number, number, number];
  const naive = Date.UTC(y, m - 1, d, 0, 0, 0);
  let guess = naive - timeZoneOffsetMs(new Date(naive), timeZone);
  // Segunda pasada por si el cambio de horario cae entre medio.
  guess = naive - timeZoneOffsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

/** Primer día del mes en curso (fecha local) y su instante UTC de inicio. */
export function quotaPeriodStart(now: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): { localDate: string; instant: Date } {
  const today = localDateInTz(now, timeZone);
  const localDate = `${today.slice(0, 7)}-01`;
  return { localDate, instant: zonedMidnightUtc(localDate, timeZone) };
}
