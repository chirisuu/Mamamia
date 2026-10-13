/**
 * Analítica de progreso (pura): series para gráficos, ventanas de comparación y entradas de
 * adherencia. Las fórmulas viven en src/lib/nutrition (weight-trend, adherence); aquí solo se arma
 * lo que necesita la pantalla.
 */
import { addDays } from "@/lib/dates";
import { movingAverage, type DayIntake, type WeightEntry } from "@/lib/nutrition";
import { sortTargets, targetForDate, type TargetRowLite } from "./targets-by-date";

export type WeightPoint = { date: string; weightKg: number; average: number | null };

/** Pesajes con su promedio móvil de 7 días; el promedio se calcula con todo el historial. */
export function weightChartPoints(entries: readonly WeightEntry[], from: string, to: string): WeightPoint[] {
  if (entries.length === 0) return [];
  return movingAverage(entries)
    .filter((p) => p.date >= from && p.date <= to)
    .map((p) => ({ date: p.date, weightKg: p.weightKg, average: p.average }));
}

export type PeriodWindow = { from: string; to: string };

/** Últimos `days` días (con hoy) frente a los `days` anteriores. */
export function periodWindows(today: string, days: number): { previous: PeriodWindow; current: PeriodWindow } {
  const currentFrom = addDays(today, -(days - 1));
  return {
    current: { from: currentFrom, to: today },
    previous: { from: addDays(currentFrom, -days), to: addDays(currentFrom, -1) },
  };
}

export type MeasurementRow = {
  local_date: string;
  waist_cm: number | null;
  hip_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  calf_cm: number | null;
  neck_cm: number | null;
};

export function measurementSeries<K extends Exclude<keyof MeasurementRow, "local_date">>(
  rows: readonly MeasurementRow[],
  column: K,
  from: string | null,
): { date: string; value: number }[] {
  return rows
    .filter((r) => r[column] != null && (from == null || r.local_date >= from))
    .map((r) => ({ date: r.local_date, value: Number(r[column]) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Diferencia entre la primera y la última medida de la serie (cm, 1 decimal); null con < 2 puntos. */
export function seriesChange(series: readonly { value: number }[]): number | null {
  if (series.length < 2) return null;
  return Math.round((series.at(-1)!.value - series[0]!.value) * 10) / 10;
}

export type TotalsRow = { local_date: string | null; energy_kcal: number | null; protein_g: number | null; items_count: number | null };

/**
 * Días para `weeklyAdherence`/`computeStreaks`. Un día sin meta vigente no se puede evaluar contra
 * la meta: se omite (no se cuenta como fallido).
 */
export function adherenceDays(totals: readonly TotalsRow[], targets: readonly TargetRowLite[]): DayIntake[] {
  const sorted = sortTargets(targets);
  const out: DayIntake[] = [];
  for (const t of totals) {
    if (!t.local_date) continue;
    const target = targetForDate(sorted, t.local_date);
    if (!target?.energy_kcal || target.energy_kcal <= 0) continue;
    out.push({
      date: t.local_date,
      logged: Number(t.items_count ?? 0) > 0,
      energyKcal: Math.max(0, Number(t.energy_kcal ?? 0)),
      proteinG: Math.max(0, Number(t.protein_g ?? 0)),
      targetKcal: Number(target.energy_kcal),
      targetProteinG: Math.max(0, Number(target.protein_g ?? 0)),
    });
  }
  return out;
}

/** Rango del eje Y con margen, incluyendo la meta si la hay. */
export function weightDomain(points: readonly WeightPoint[], goalKg: number | null): [number, number] | null {
  const values = points.flatMap((p) => [p.weightKg, p.average ?? p.weightKg]);
  if (goalKg != null) values.push(goalKg);
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(0.5, (max - min) * 0.1);
  return [Math.floor((min - pad) * 2) / 2, Math.ceil((max + pad) * 2) / 2];
}
