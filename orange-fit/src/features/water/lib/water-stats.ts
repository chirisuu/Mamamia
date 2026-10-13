/**
 * Agua: series diarias e indicadores del historial (puro). Un día sin registros no se dibuja como
 * 0 ml: puede que la persona simplemente no anotó.
 */
import { dateRange } from "@/lib/dates";
import { sortTargets, targetForDate, type TargetRowLite } from "@/features/progress/lib/targets-by-date";

export type WaterLogLite = { local_date: string; amount_ml: number };

export type WaterDay = {
  date: string;
  /** null = sin registros ese día. */
  ml: number | null;
  targetMl: number | null;
  reached: boolean;
};

export function sumByDate(logs: readonly WaterLogLite[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const log of logs) map.set(log.local_date, (map.get(log.local_date) ?? 0) + Number(log.amount_ml));
  return map;
}

export function waterSeries(logs: readonly WaterLogLite[], targets: readonly TargetRowLite[], today: string, days: number): WaterDay[] {
  const sums = sumByDate(logs);
  const sorted = sortTargets(targets);
  return dateRange(today, days).map((date) => {
    const ml = sums.get(date) ?? null;
    const t = targetForDate(sorted, date)?.water_ml ?? null;
    const targetMl = t != null && t > 0 ? Number(t) : null;
    return { date, ml, targetMl, reached: ml != null && targetMl != null && ml >= targetMl };
  });
}

export type WaterSummary = {
  days: number;
  daysLogged: number;
  /** Promedio de los días con registro (ml, entero); null sin registros. */
  averageMl: number | null;
  daysReached: number;
  totalMl: number;
};

export function summarizeWater(series: readonly WaterDay[]): WaterSummary {
  const logged = series.filter((d) => d.ml != null);
  const totalMl = logged.reduce((s, d) => s + (d.ml ?? 0), 0);
  return {
    days: series.length,
    daysLogged: logged.length,
    averageMl: logged.length ? Math.round(totalMl / logged.length) : null,
    daysReached: series.filter((d) => d.reached).length,
    totalMl,
  };
}

/** Límites del monto personalizado en la UI (la base acepta 1–5000 ml por registro). */
export const CUSTOM_WATER_LIMITS = { min: 50, max: 2000, step: 50 } as const;
