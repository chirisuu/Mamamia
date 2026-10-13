/**
 * Metas por fecha e historial diario para el gráfico semanal y las rachas. Puro y probado.
 */
import { dateRange } from "@/lib/dates";
import { formatShortDate } from "@/lib/format";
import type { DayIntake } from "@/lib/nutrition";

/** "lun 13" (sin mes) para el eje del gráfico. */
export function axisDateLabel(isoDate: string): string {
  return formatShortDate(isoDate).split(" ").slice(0, 2).join(" ");
}

export type TargetLike = { effective_from: string; created_at: string; energy_kcal: number; protein_g: number };
export type DailyTotalLike = { local_date: string | null; energy_kcal: number | null; protein_g: number | null; items_count: number | null };

/** Meta vigente en `date` (mayor effective_from ≤ date, desempate por created_at más reciente). */
export function targetForDate<T extends TargetLike>(targets: readonly T[], date: string): T | null {
  let best: T | null = null;
  for (const t of targets) {
    if (t.effective_from > date) continue;
    if (
      !best ||
      t.effective_from > best.effective_from ||
      (t.effective_from === best.effective_from && t.created_at > best.created_at)
    ) {
      best = t;
    }
  }
  return best;
}

/** La primera meta registrada (para días anteriores a ella). */
export function earliestTarget<T extends TargetLike>(targets: readonly T[]): T | null {
  let first: T | null = null;
  for (const t of targets) {
    if (!first || t.effective_from < first.effective_from || (t.effective_from === first.effective_from && t.created_at > first.created_at)) {
      first = t;
    }
  }
  return first;
}

export type WeeklyPoint = {
  date: string;
  label: string;
  /** null = ese día no hay registros (distinto de 0 kcal). */
  consumed: number | null;
  target: number | null;
};

export function buildWeeklySeries(today: string, totals: readonly DailyTotalLike[], targets: readonly TargetLike[], days = 7): WeeklyPoint[] {
  const byDate = new Map<string, DailyTotalLike>();
  for (const t of totals) if (t.local_date) byDate.set(t.local_date, t);
  return dateRange(today, days).map((date) => {
    const t = byDate.get(date);
    const logged = t != null && (t.items_count ?? 0) > 0;
    const target = targetForDate(targets, date);
    return {
      date,
      label: axisDateLabel(date),
      consumed: logged ? Math.round(Number(t!.energy_kcal ?? 0)) : null,
      target: target ? Number(target.energy_kcal) : null,
    };
  });
}

/**
 * Historial para `computeStreaks`. Los días antes de la primera meta se evalúan con la primera
 * meta (la racha de registro no depende de la meta; la de metas sí, y es la mejor referencia).
 */
export function buildDayIntakes(totals: readonly DailyTotalLike[], targets: readonly TargetLike[]): DayIntake[] {
  const first = earliestTarget(targets);
  if (!first) return [];
  return totals.flatMap((t) => {
    if (!t.local_date) return [];
    const target = targetForDate(targets, t.local_date) ?? first;
    return [
      {
        date: t.local_date,
        logged: (t.items_count ?? 0) > 0,
        energyKcal: Math.max(0, Number(t.energy_kcal ?? 0)),
        proteinG: Math.max(0, Number(t.protein_g ?? 0)),
        targetKcal: Number(target.energy_kcal),
        targetProteinG: Number(target.protein_g),
      },
    ];
  });
}
