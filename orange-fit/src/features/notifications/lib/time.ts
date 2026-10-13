/** "hace 5 min", "hace 3 h", "ayer", "lun 13 oct" (zona del usuario). Puro. */
import { localDateInTz, diffDays } from "@/lib/dates";
import { formatShortDate } from "@/lib/format";

export function relativeTime(iso: string, now: Date, timeZone: string): string {
  const then = new Date(iso);
  const ms = now.getTime() - then.getTime();
  if (!Number.isFinite(ms)) return "";
  if (ms < 60_000) return "hace un momento";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  const days = diffDays(localDateInTz(then, timeZone), localDateInTz(now, timeZone));
  if (days === 0) return `hace ${h} h`;
  if (days === 1) return "ayer";
  return formatShortDate(localDateInTz(then, timeZone));
}

/** "14:05" en la zona del usuario. */
export function timeOfDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("es-PE", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}
