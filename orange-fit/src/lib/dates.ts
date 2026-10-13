/**
 * Fechas del diario. El "día" del usuario depende de su zona horaria (perfil),
 * no de la del servidor: a las 11 pm en Lima el servidor en UTC ya es mañana.
 * Las fechas locales viajan como texto ISO `YYYY-MM-DD`.
 */
export const DEFAULT_TIMEZONE = "America/Lima";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Fecha local (YYYY-MM-DD) de un instante en una zona horaria IANA. */
export function localDateInTz(instant: Date = new Date(), timeZone: string = DEFAULT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export const todayInTz = (timeZone: string = DEFAULT_TIMEZONE) => localDateInTz(new Date(), timeZone);

/** Suma días a una fecha ISO sin pasar por zonas horarias. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Días entre dos fechas ISO (b − a). */
export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Lunes de la semana de una fecha ISO. */
export function startOfWeek(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(isoDate, -dow);
}

/** Las n fechas que terminan en `end` (incluida), de la más antigua a la más reciente. */
export function dateRange(end: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));
}

/** Edad cumplida en años a una fecha dada. */
export function ageOn(birthDate: string, onDate: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number) as [number, number, number];
  const [y, m, d] = onDate.split("-").map(Number) as [number, number, number];
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age--;
  return age;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
