import {
  Award,
  CalendarCheck,
  CalendarDays,
  Carrot,
  ChefHat,
  Droplets,
  Drumstick,
  Medal,
  Scale,
  ScanBarcode,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { formatNumber, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BadgeView } from "../server/sync";

/** Iconos de `badges.icon` (nombre lucide). Un nombre desconocido usa una medalla genérica. */
const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  "calendar-check": CalendarCheck,
  medal: Medal,
  droplets: Droplets,
  drumstick: Drumstick,
  "chef-hat": ChefHat,
  scale: Scale,
  "scan-barcode": ScanBarcode,
  "calendar-days": CalendarDays,
  carrot: Carrot,
  trophy: Trophy,
};

export function badgeIcon(name: string): LucideIcon {
  return ICONS[name] ?? Award;
}

/** Insignias ganadas primero (más recientes arriba) y luego las que están en camino. */
export function BadgeGrid({ badges, earnedDateOf }: { badges: BadgeView[]; earnedDateOf: (iso: string) => string }) {
  const earned = badges.filter((b) => b.earned).sort((a, b) => (b.earnedAt ?? "").localeCompare(a.earnedAt ?? ""));
  const pending = badges.filter((b) => !b.earned).sort((a, b) => b.progress - a.progress);
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {[...earned, ...pending].map((b) => {
        const Icon = badgeIcon(b.icon);
        const pct = Math.round(b.progress * 100);
        return (
          <li
            key={b.id}
            className={cn("grid content-start gap-2 rounded-2xl border p-4", b.earned ? "border-primary/40 bg-accent" : "border-border bg-card")}
          >
            <span
              className={cn(
                "flex size-11 items-center justify-center rounded-xl",
                b.earned ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <p className="leading-snug font-semibold">{b.name}</p>
            {b.description ? <p className="text-xs text-muted-foreground">{b.description}</p> : null}
            {b.earned ? (
              <p className="text-xs font-medium text-primary-strong">
                Ganada{b.earnedAt ? ` el ${formatShortDate(earnedDateOf(b.earnedAt))}` : ""}
              </p>
            ) : (
              <div className="grid gap-1">
                <div
                  role="progressbar"
                  aria-label={`Avance de ${b.name}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  aria-valuetext={`${formatNumber(Math.min(b.current, b.target))} de ${formatNumber(b.target)}`}
                  className="h-2 overflow-hidden rounded-full bg-muted"
                >
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatNumber(Math.min(b.current, b.target))} de {formatNumber(b.target)}
                </p>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
