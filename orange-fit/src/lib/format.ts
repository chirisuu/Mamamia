import { DEFAULT_TIMEZONE } from "./dates";

/** Formato es-PE: punto decimal, separador de miles con coma, fechas cortas en español. */
const LOCALE = "es-PE";

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString(LOCALE, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export const formatKcal = (v: number | null | undefined) => `${formatNumber(v)} kcal`;
export const formatGrams = (v: number | null | undefined, decimals = 0) => `${formatNumber(v, decimals)} g`;
export const formatKg = (v: number | null | undefined) => `${formatNumber(v, 1)} kg`;
export const formatMl = (v: number | null | undefined) =>
  v != null && v >= 1000 ? `${formatNumber(v / 1000, 2)} L` : `${formatNumber(v)} ml`;

export function formatMoney(amount: number | null | undefined, currency = "PEN"): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  if (currency === "PEN") return `S/ ${formatNumber(amount, 2)}`;
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency }).format(amount);
}

export const formatCents = (cents: number | null | undefined, currency = "PEN") =>
  cents == null ? "—" : formatMoney(cents / 100, currency);

/** "lun 13 oct" a partir de una fecha ISO local. */
export function formatShortDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d
    .toLocaleDateString(LOCALE, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    .replace(/\./g, "")
    .replace(",", "");
}

/** "lunes, 13 de octubre" */
export function formatLongDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return d.toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

/**
 * "13 oct 2026" para un instante (timestamptz). La zona va explícita: sin ella el servidor (UTC) y
 * el navegador (Lima) pintan días distintos cerca de medianoche y React falla al hidratar.
 */
export function formatInstantDate(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return new Date(iso)
    .toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric", timeZone })
    .replace(/\./g, "");
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
