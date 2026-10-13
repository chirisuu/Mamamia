import Link from "next/link";
import { CalendarCheck, Flame, Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatTile } from "@/components/ui/stat-tile";
import { formatNumber, formatShortDate } from "@/lib/format";
import type { Streaks, WeeklyAdherence } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

const DAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];

function Row({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="font-medium" data-numeric="">
          {value} de {total} {total === 1 ? "día" : "días"}
        </span>
      </div>
      <Progress value={pct} aria-label={label} aria-valuetext={`${value} de ${total} días`} className="h-2" />
    </div>
  );
}

/**
 * Indicadores de adherencia de la semana (lunes a domingo, hasta hoy) con los criterios de
 * src/lib/nutrition/adherence.ts. Sin castigos: comer más no rompe la racha de registro.
 */
export function AdherenceCard({ weekly, streaks, hasTargets }: { weekly: WeeklyAdherence | null; streaks: Streaks | null; hasTargets: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Tu semana</CardTitle>
        <CardDescription>
          {weekly ? `Del ${formatShortDate(weekly.weekStart)} al ${formatShortDate(weekly.weekEnd)}` : "Hábitos de registro y metas"}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!hasTargets || !weekly ? (
          <p className="text-sm text-muted-foreground">
            Necesitas metas diarias para ver tu adherencia.{" "}
            <Link href="/app/perfil/metas" className="font-medium text-primary-strong underline-offset-4 hover:underline">
              Revisa tus metas
            </Link>
          </p>
        ) : (
          <>
            <ol className="grid grid-cols-7 gap-1.5" aria-label="Días de la semana registrados">
              {Array.from({ length: 7 }, (_, i) => {
                const day = weekly.days[i];
                const label = day ? `${formatShortDate(day.date)}: ${day.logged ? (day.goalsMet ? "registrado y en meta" : "registrado") : "sin registro"}` : "Día por venir";
                return (
                  <li
                    key={i}
                    className={cn(
                      "flex h-11 items-center justify-center rounded-xl text-sm font-semibold",
                      !day
                        ? "border border-dashed border-border text-muted-foreground"
                        : day.goalsMet
                          ? "bg-primary text-primary-foreground"
                          : day.logged
                            ? "bg-accent text-accent-foreground"
                            : "bg-muted text-muted-foreground",
                    )}
                  >
                    <span aria-hidden="true">{DAY_LETTERS[i]}</span>
                    <span className="sr-only">{label}</span>
                  </li>
                );
              })}
            </ol>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2.5 rounded-sm bg-primary" /> Registrado y en meta
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2.5 rounded-sm bg-accent ring-1 ring-border" /> Registrado
              </span>
            </p>
            <div className="grid gap-3">
              <Row label="Días con registro" value={weekly.daysLogged} total={weekly.daysElapsed} />
              <Row label="Calorías en meta (±10 %)" value={weekly.daysKcalOnTarget} total={weekly.daysElapsed} />
              <Row label="Proteína en meta (≥ 90 %)" value={weekly.daysProteinOnTarget} total={weekly.daysElapsed} />
            </div>
          </>
        )}
        {streaks ? (
          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="Racha de registro"
              icon={CalendarCheck}
              value={formatNumber(streaks.logging.current)}
              unit={streaks.logging.current === 1 ? "día" : "días"}
              hint={streaks.logging.todayCounts || streaks.logging.current === 0 ? `Mejor racha: ${streaks.logging.longest}` : "Registra hoy para sumar"}
            />
            <StatTile
              label="Racha de metas"
              icon={streaks.goals.current > 0 ? Flame : Target}
              value={formatNumber(streaks.goals.current)}
              unit={streaks.goals.current === 1 ? "día" : "días"}
              hint={`Mejor racha: ${streaks.goals.longest}`}
            />
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">Cada día que registras cuenta. Un día fuera de la meta no borra lo que ya lograste.</p>
      </CardContent>
    </Card>
  );
}
