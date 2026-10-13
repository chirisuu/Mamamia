/**
 * Adherencia: estado de cada día, rachas y resumen semanal.
 *
 * Reglas que no castigan:
 * - La racha de REGISTRO solo pide registrar: comer más (o menos) no la rompe.
 * - La racha de METAS es aparte (kcal dentro de ±10 % y proteína ≥ 90 %).
 * - Hoy suma a una racha solo si ya cumple; si aún no, la racha sigue viva desde ayer
 *   (el día no ha terminado).
 */
import { addDays, dateRange, diffDays, isIsoDate, startOfWeek } from "@/lib/dates";
import { NutritionInputError } from "./errors";
import { assertNonNegative, assertPositive, roundDecimals } from "./math";

export const KCAL_TOLERANCE = 0.1;
export const PROTEIN_ON_TARGET_RATIO = 0.9;

export interface DayIntake {
  date: string;
  /** ¿Registró al menos un alimento ese día? */
  logged: boolean;
  energyKcal: number;
  proteinG: number;
  /** Metas vigentes ese día. */
  targetKcal: number;
  targetProteinG: number;
}

export interface DayStatus {
  date: string;
  logged: boolean;
  kcalOnTarget: boolean;
  proteinOnTarget: boolean;
  goalsMet: boolean;
  /** (consumido − meta) / meta × 100, 1 decimal; null si no registró. */
  kcalDeviationPct: number | null;
  /** consumido / meta × 100, 1 decimal; null si no registró o no hay meta de proteína. */
  proteinPct: number | null;
}

function assertDate(date: string, field: string): void {
  if (typeof date !== "string" || !isIsoDate(date)) {
    throw new NutritionInputError("invalid_date", field, "La fecha debe tener el formato AAAA-MM-DD.");
  }
}

export function dayStatus(day: DayIntake): DayStatus {
  assertDate(day.date, "date");
  const kcal = assertNonNegative(day.energyKcal, "energyKcal", "Las calorías");
  const protein = assertNonNegative(day.proteinG, "proteinG", "La proteína");
  const targetKcal = assertPositive(day.targetKcal, "targetKcal", "La meta de calorías");
  const targetProtein = assertNonNegative(day.targetProteinG, "targetProteinG", "La meta de proteína");
  if (!day.logged) {
    return {
      date: day.date,
      logged: false,
      kcalOnTarget: false,
      proteinOnTarget: false,
      goalsMet: false,
      kcalDeviationPct: null,
      proteinPct: null,
    };
  }
  const deviation = (kcal - targetKcal) / targetKcal;
  // Pequeña tolerancia numérica para que exactamente ±10 % cuente como dentro.
  const kcalOnTarget = Math.abs(deviation) <= KCAL_TOLERANCE + 1e-9;
  const proteinOnTarget = targetProtein === 0 || protein >= targetProtein * PROTEIN_ON_TARGET_RATIO - 1e-9;
  return {
    date: day.date,
    logged: true,
    kcalOnTarget,
    proteinOnTarget,
    goalsMet: kcalOnTarget && proteinOnTarget,
    kcalDeviationPct: roundDecimals(deviation * 100, 1),
    proteinPct: targetProtein === 0 ? null : roundDecimals((protein / targetProtein) * 100, 1),
  };
}

function statusMap(days: readonly DayIntake[]): Map<string, DayStatus> {
  const map = new Map<string, DayStatus>();
  for (const day of days) map.set(day.date, dayStatus(day));
  return map;
}

export interface StreakInfo {
  current: number;
  longest: number;
  /** ¿Hoy ya suma a la racha? */
  todayCounts: boolean;
}

export interface Streaks {
  logging: StreakInfo;
  goals: StreakInfo;
}

function streakFor(map: Map<string, DayStatus>, today: string, pass: (s: DayStatus) => boolean): StreakInfo {
  const ok = (date: string) => {
    const s = map.get(date);
    return s !== undefined && pass(s);
  };
  const todayCounts = ok(today);
  let current = 0;
  let cursor = todayCounts ? today : addDays(today, -1);
  while (ok(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  let longest = 0;
  let run = 0;
  const dates = [...map.keys()].filter((d) => d <= today).sort();
  let prev: string | null = null;
  for (const date of dates) {
    if (ok(date)) {
      run = prev !== null && diffDays(prev, date) === 1 && ok(prev) ? run + 1 : 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
    prev = date;
  }
  return { current, longest: Math.max(longest, current), todayCounts };
}

/** Rachas hasta `today` (las fechas futuras se ignoran; los días sin datos cuentan como no registrados). */
export function computeStreaks(days: readonly DayIntake[], today: string): Streaks {
  assertDate(today, "today");
  const map = statusMap(days);
  return {
    logging: streakFor(map, today, (s) => s.logged),
    goals: streakFor(map, today, (s) => s.goalsMet),
  };
}

export interface WeeklyAdherence {
  weekStart: string;
  weekEnd: string;
  /** Días de la semana ya transcurridos (hoy incluido); los futuros no cuentan. */
  daysElapsed: number;
  daysLogged: number;
  daysKcalOnTarget: number;
  daysProteinOnTarget: number;
  daysGoalsMet: number;
  /** Porcentajes sobre los días transcurridos (0–100, 1 decimal). */
  loggingPct: number;
  kcalPct: number;
  proteinPct: number;
  goalsPct: number;
  days: DayStatus[];
}

/** Adherencia de la semana (lunes a domingo) que contiene `weekOf`, contada hasta `today`. */
export function weeklyAdherence(days: readonly DayIntake[], weekOf: string, today: string): WeeklyAdherence {
  assertDate(weekOf, "weekOf");
  assertDate(today, "today");
  const weekStart = startOfWeek(weekOf);
  const weekEnd = addDays(weekStart, 6);
  const map = statusMap(days);
  const elapsed = dateRange(weekEnd, 7).filter((d) => d <= today);
  const statuses = elapsed.map(
    (date) =>
      map.get(date) ?? {
        date,
        logged: false,
        kcalOnTarget: false,
        proteinOnTarget: false,
        goalsMet: false,
        kcalDeviationPct: null,
        proteinPct: null,
      },
  );
  const count = (f: (s: DayStatus) => boolean) => statuses.filter(f).length;
  const pct = (n: number) => (statuses.length === 0 ? 0 : roundDecimals((n / statuses.length) * 100, 1));
  const daysLogged = count((s) => s.logged);
  const daysKcalOnTarget = count((s) => s.kcalOnTarget);
  const daysProteinOnTarget = count((s) => s.proteinOnTarget);
  const daysGoalsMet = count((s) => s.goalsMet);
  return {
    weekStart,
    weekEnd,
    daysElapsed: statuses.length,
    daysLogged,
    daysKcalOnTarget,
    daysProteinOnTarget,
    daysGoalsMet,
    loggingPct: pct(daysLogged),
    kcalPct: pct(daysKcalOnTarget),
    proteinPct: pct(daysProteinOnTarget),
    goalsPct: pct(daysGoalsMet),
    days: statuses,
  };
}
