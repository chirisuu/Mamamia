/**
 * Tendencia de peso. El peso diario oscila por agua, sal y digestión; por eso se trabaja con
 * un promedio móvil de 7 días (con al menos 3 pesajes en la ventana) y una regresión lineal
 * sobre esos promedios.
 */
import { addDays, diffDays, isIsoDate } from "@/lib/dates";
import { NutritionInputError } from "./errors";
import { assertInRange, roundDecimals } from "./math";

export interface WeightEntry {
  date: string;
  weightKg: number;
}

export interface SmoothedPoint {
  date: string;
  weightKg: number;
  /** Promedio de los pesajes de la ventana que termina en `date`; null si hay menos del mínimo. */
  average: number | null;
  /** Pesajes en la ventana. */
  count: number;
}

export const TREND_WINDOW_DAYS = 7;
export const TREND_MIN_ENTRIES = 3;
/** Por debajo de este ritmo (kg/semana) se considera estable. */
export const FLAT_RATE_KG_PER_WEEK = 0.02;
/** Proyecciones más lejanas que esto no son confiables. */
export const MAX_PROJECTION_DAYS = 730;

function assertDate(date: string, field: string): void {
  if (typeof date !== "string" || !isIsoDate(date)) {
    throw new NutritionInputError("invalid_date", field, "La fecha debe tener el formato AAAA-MM-DD.");
  }
}

/** Ordena por fecha y deja un pesaje por día (el último recibido para esa fecha). */
export function normalizeWeights(entries: readonly WeightEntry[]): WeightEntry[] {
  const byDate = new Map<string, number>();
  entries.forEach((e, i) => {
    assertDate(e.date, `entries.${i}.date`);
    assertInRange(e.weightKg, 20, 400, `entries.${i}.weightKg`, "El peso", "kg");
    byDate.set(e.date, e.weightKg);
  });
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, weightKg]) => ({ date, weightKg }));
}

export function movingAverage(
  entries: readonly WeightEntry[],
  options: { windowDays?: number; minEntries?: number } = {},
): SmoothedPoint[] {
  const windowDays = options.windowDays ?? TREND_WINDOW_DAYS;
  const minEntries = options.minEntries ?? TREND_MIN_ENTRIES;
  const sorted = normalizeWeights(entries);
  return sorted.map((entry) => {
    const from = addDays(entry.date, -(windowDays - 1));
    const inWindow = sorted.filter((e) => e.date >= from && e.date <= entry.date);
    const avg = inWindow.reduce((acc, e) => acc + e.weightKg, 0) / inWindow.length;
    return {
      date: entry.date,
      weightKg: entry.weightKg,
      average: inWindow.length >= minEntries ? roundDecimals(avg, 2) : null,
      count: inWindow.length,
    };
  });
}

export interface LinearFit {
  slope: number;
  intercept: number;
  /** Coeficiente de determinación (0–1); 1 si todos los puntos están sobre la recta. */
  r2: number;
  n: number;
}

/** Mínimos cuadrados. null con menos de 2 puntos o sin variación en x. */
export function linearRegression(points: readonly { x: number; y: number }[]): LinearFit | null {
  const n = points.length;
  if (n < 2) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
    syy += (p.y - my) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  return { slope, intercept, r2, n };
}

export type TrendConfidence = "insufficient" | "low" | "ok";

export interface WeightTrend {
  points: SmoothedPoint[];
  /** Ritmo en kg por semana (negativo = bajando). */
  weeklyRateKg: number | null;
  /** Valor de la recta en la última fecha con promedio. */
  trendWeightKg: number | null;
  latestAverageKg: number | null;
  startDate: string | null;
  endDate: string | null;
  spanDays: number;
  fit: LinearFit | null;
  confidence: TrendConfidence;
}

export function weightTrend(entries: readonly WeightEntry[]): WeightTrend {
  const points = movingAverage(entries);
  const averaged = points.filter((p): p is SmoothedPoint & { average: number } => p.average !== null);
  const startDate = averaged[0]?.date ?? null;
  const endDate = averaged.at(-1)?.date ?? null;
  const fit =
    startDate === null
      ? null
      : linearRegression(averaged.map((p) => ({ x: diffDays(startDate, p.date), y: p.average })));
  const spanDays = startDate && endDate ? diffDays(startDate, endDate) : 0;
  const confidence: TrendConfidence = !fit ? "insufficient" : averaged.length < 4 || spanDays < 14 ? "low" : "ok";
  return {
    points,
    weeklyRateKg: fit ? roundDecimals(fit.slope * 7, 2) : null,
    trendWeightKg: fit ? roundDecimals(fit.intercept + fit.slope * spanDays, 2) : null,
    latestAverageKg: averaged.at(-1)?.average ?? null,
    startDate,
    endDate,
    spanDays,
    fit,
    confidence,
  };
}

export type ProjectionReason = "on_track" | "reached" | "moving_away" | "flat" | "insufficient_data" | "too_far";

export interface GoalProjection {
  /** Fecha estimada para llegar a la meta, o null si no aplica. */
  date: string | null;
  days: number | null;
  reason: ProjectionReason;
  message: string;
}

/**
 * Proyecta cuándo se llegaría a la meta si se mantiene el ritmo actual. Es una extrapolación
 * lineal: el ritmo real suele desacelerarse.
 */
export function projectGoalDate(trend: WeightTrend, targetWeightKg: number): GoalProjection {
  assertInRange(targetWeightKg, 20, 400, "targetWeightKg", "El peso meta", "kg");
  if (!trend.fit || trend.trendWeightKg === null || trend.endDate === null || trend.weeklyRateKg === null) {
    return {
      date: null,
      days: null,
      reason: "insufficient_data",
      message: "Necesitamos más pesajes (al menos 3 por semana durante unos días) para estimar tu tendencia.",
    };
  }
  const current = trend.trendWeightKg;
  const gap = targetWeightKg - current;
  if (Math.abs(gap) < 0.1) {
    return { date: trend.endDate, days: 0, reason: "reached", message: "Tu tendencia ya está en tu peso meta." };
  }
  const slope = trend.fit.slope;
  if (Math.abs(slope * 7) < FLAT_RATE_KG_PER_WEEK) {
    return { date: null, days: null, reason: "flat", message: "Tu peso está estable, así que no hay una fecha estimada para tu meta." };
  }
  if (Math.sign(slope) !== Math.sign(gap)) {
    return {
      date: null,
      days: null,
      reason: "moving_away",
      message: "Con la tendencia actual no te estás acercando a tu meta. Revisa tu plan con calma: los cambios toman tiempo.",
    };
  }
  const days = Math.ceil(gap / slope);
  if (days > MAX_PROJECTION_DAYS) {
    return {
      date: null,
      days,
      reason: "too_far",
      message: "A este ritmo la meta está a más de 2 años: una proyección tan lejana no es confiable.",
    };
  }
  return {
    date: addDays(trend.endDate, days),
    days,
    reason: "on_track",
    message: "Fecha estimada si mantienes el ritmo actual. Es una aproximación: el ritmo suele cambiar con el tiempo.",
  };
}

export interface PeriodSummary {
  from: string;
  to: string;
  count: number;
  averageKg: number;
  minKg: number;
  maxKg: number;
}

export interface PeriodComparison {
  a: PeriodSummary | null;
  b: PeriodSummary | null;
  /** promedio(b) − promedio(a); null si falta alguno. */
  deltaKg: number | null;
  deltaPct: number | null;
}

export function summarizePeriod(entries: readonly WeightEntry[], from: string, to: string): PeriodSummary | null {
  assertDate(from, "from");
  assertDate(to, "to");
  if (from > to) throw new NutritionInputError("invalid_date", "from", "La fecha inicial debe ser anterior a la final.");
  const inRange = normalizeWeights(entries).filter((e) => e.date >= from && e.date <= to);
  if (inRange.length === 0) return null;
  const weights = inRange.map((e) => e.weightKg);
  return {
    from,
    to,
    count: inRange.length,
    averageKg: roundDecimals(weights.reduce((s, w) => s + w, 0) / weights.length, 2),
    minKg: Math.min(...weights),
    maxKg: Math.max(...weights),
  };
}

/** Compara el promedio de dos periodos (p. ej. esta semana vs. la anterior). */
export function comparePeriods(
  entries: readonly WeightEntry[],
  a: { from: string; to: string },
  b: { from: string; to: string },
): PeriodComparison {
  const sa = summarizePeriod(entries, a.from, a.to);
  const sb = summarizePeriod(entries, b.from, b.to);
  const deltaKg = sa && sb ? roundDecimals(sb.averageKg - sa.averageKg, 2) : null;
  return {
    a: sa,
    b: sb,
    deltaKg,
    deltaPct: sa && sb && deltaKg !== null ? roundDecimals((deltaKg / sa.averageKg) * 100, 2) : null,
  };
}
