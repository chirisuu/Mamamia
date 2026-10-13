/**
 * Insignias y retos sin castigos: solo suman lo que la persona sí hizo.
 * - Los criterios de insignias son los de `badges.criteria` (ver `supabase/seed/00_base.sql`);
 *   los días no tienen que ser consecutivos.
 * - Un reto suma días que cumplen la meta diaria desde que empezó; si un día no se logra,
 *   no se pierde nada. No hay estado "fallido".
 */
import { addDays, isIsoDate } from "@/lib/dates";
import { NutritionInputError } from "./errors";
import { clamp, roundDecimals } from "./math";
import { PROTEIN_ON_TARGET_RATIO } from "./adherence";

export type BadgeCriteria =
  | { type: "meal_log_items_total"; min: number }
  | { type: "logging_days"; days: number }
  | { type: "water_goal_days"; days: number }
  | { type: "protein_goal_days"; days: number }
  | { type: "vegetable_days"; days: number }
  | { type: "recipes_created"; min: number }
  | { type: "weight_logs_total"; min: number }
  | { type: "log_source_used"; source: string; min: number }
  | { type: "meal_plans_created"; min: number }
  | { type: "challenges_completed"; min: number };

/** Agregados del usuario (todos opcionales: lo que falte cuenta como 0). */
export interface GamificationStats {
  mealLogItemsTotal?: number;
  loggingDays?: number;
  waterGoalDays?: number;
  proteinGoalDays?: number;
  vegetableDays?: number;
  recipesCreated?: number;
  weightLogsTotal?: number;
  /** Ítems registrados por origen (`log_source`): { barcode: 3, photo_ai: 1 }. */
  logSourceCounts?: Readonly<Record<string, number>>;
  mealPlansCreated?: number;
  challengesCompleted?: number;
}

const COUNT_TYPES = {
  meal_log_items_total: "mealLogItemsTotal",
  recipes_created: "recipesCreated",
  weight_logs_total: "weightLogsTotal",
  meal_plans_created: "mealPlansCreated",
  challenges_completed: "challengesCompleted",
} as const;

const DAY_TYPES = {
  logging_days: "loggingDays",
  water_goal_days: "waterGoalDays",
  protein_goal_days: "proteinGoalDays",
  vegetable_days: "vegetableDays",
} as const;

const isPositiveInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;

/** Valida un `criteria` jsonb. Devuelve null si el tipo no se reconoce o le faltan datos. */
export function parseBadgeCriteria(raw: unknown): BadgeCriteria | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const c = raw as Record<string, unknown>;
  const type = c.type;
  if (typeof type !== "string") return null;
  if (Object.hasOwn(COUNT_TYPES, type)) {
    return isPositiveInt(c.min) ? ({ type, min: c.min } as BadgeCriteria) : null;
  }
  if (Object.hasOwn(DAY_TYPES, type)) {
    return isPositiveInt(c.days) ? ({ type, days: c.days } as BadgeCriteria) : null;
  }
  if (type === "log_source_used") {
    return typeof c.source === "string" && c.source !== "" && isPositiveInt(c.min)
      ? { type, source: c.source, min: c.min }
      : null;
  }
  return null;
}

export interface BadgeEvaluation {
  /** false si el criterio no es reconocido: la insignia no se otorga (ni se muestra como pendiente). */
  supported: boolean;
  earned: boolean;
  current: number;
  target: number;
  /** 0–1. */
  progress: number;
}

const count = (v: number | undefined) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

export function evaluateBadge(criteria: unknown, stats: GamificationStats): BadgeEvaluation {
  const c = parseBadgeCriteria(criteria);
  if (!c) return { supported: false, earned: false, current: 0, target: 0, progress: 0 };
  let current: number;
  let target: number;
  if (c.type === "log_source_used") {
    current = count(stats.logSourceCounts?.[c.source]);
    target = c.min;
  } else if ("days" in c) {
    current = count(stats[DAY_TYPES[c.type]]);
    target = c.days;
  } else {
    current = count(stats[COUNT_TYPES[c.type]]);
    target = c.min;
  }
  return {
    supported: true,
    earned: current >= target,
    current,
    target,
    progress: roundDecimals(clamp(current / target, 0, 1), 3),
  };
}

export interface BadgeDefinition {
  code: string;
  criteria: unknown;
}

/** Evalúa todas las insignias; `newlyEarned` son las cumplidas que aún no tenía. */
export function evaluateBadges(
  badges: readonly BadgeDefinition[],
  stats: GamificationStats,
  alreadyEarned: Iterable<string> = [],
): { results: (BadgeEvaluation & { code: string; alreadyEarned: boolean })[]; newlyEarned: string[] } {
  const earned = new Set(alreadyEarned);
  const results = badges.map((b) => ({ code: b.code, alreadyEarned: earned.has(b.code), ...evaluateBadge(b.criteria, stats) }));
  // Una insignia ganada no se pierde aunque los agregados cambien.
  for (const r of results) {
    if (r.alreadyEarned) {
      r.earned = true;
      r.progress = 1;
    }
  }
  return { results, newlyEarned: results.filter((r) => r.earned && !r.alreadyEarned && r.supported).map((r) => r.code) };
}

/** Datos de un día para los agregados de insignias y los retos. */
export interface DailyHabitRecord {
  date: string;
  /** Ítems registrados ese día. */
  itemsLogged?: number;
  waterMl?: number;
  waterTargetMl?: number | null;
  proteinG?: number;
  proteinTargetG?: number | null;
  vegetableServings?: number;
  activityMinutes?: number;
}

/**
 * Días distintos que cumplen cada hábito. La meta de proteína se considera alcanzada con ≥ 90 %
 * (mismo criterio que la adherencia).
 */
export function aggregateHabitDays(days: readonly DailyHabitRecord[]): Required<
  Pick<GamificationStats, "loggingDays" | "waterGoalDays" | "proteinGoalDays" | "vegetableDays">
> {
  const logging = new Set<string>();
  const water = new Set<string>();
  const protein = new Set<string>();
  const veg = new Set<string>();
  for (const d of days) {
    if (count(d.itemsLogged) > 0) logging.add(d.date);
    if (d.waterTargetMl && d.waterTargetMl > 0 && count(d.waterMl) >= d.waterTargetMl) water.add(d.date);
    if (d.proteinTargetG && d.proteinTargetG > 0 && count(d.proteinG) >= d.proteinTargetG * PROTEIN_ON_TARGET_RATIO) {
      protein.add(d.date);
    }
    if (count(d.vegetableServings) > 0) veg.add(d.date);
  }
  return { loggingDays: logging.size, waterGoalDays: water.size, proteinGoalDays: protein.size, vegetableDays: veg.size };
}

export type ChallengeKind = "water" | "logging" | "protein" | "vegetables" | "activity";

export interface ChallengeDefinition {
  kind: ChallengeKind;
  /** Meta diaria: ml de agua, ítems registrados, % de la meta de proteína, porciones de verdura o minutos. */
  targetValue: number;
  /** Días que hay que sumar (no necesitan ser consecutivos). */
  durationDays: number;
}

/** Valor diario de un reto según su tipo. */
export function challengeDayValue(kind: ChallengeKind, day: DailyHabitRecord): number {
  switch (kind) {
    case "water":
      return count(day.waterMl);
    case "logging":
      return count(day.itemsLogged);
    case "protein":
      return day.proteinTargetG && day.proteinTargetG > 0 ? (count(day.proteinG) / day.proteinTargetG) * 100 : 0;
    case "vegetables":
      return count(day.vegetableServings);
    case "activity":
      return count(day.activityMinutes);
  }
}

export interface ChallengeProgress {
  qualifyingDays: number;
  requiredDays: number;
  remainingDays: number;
  /** 0–1. */
  progress: number;
  completed: boolean;
  /** Día en que se completó (cuando se sumó el último día necesario). */
  completedOn: string | null;
  message: string;
}

export function evaluateChallenge(
  challenge: ChallengeDefinition,
  input: { startedOn: string; today: string; days: readonly DailyHabitRecord[] },
): ChallengeProgress {
  for (const [field, value] of [
    ["startedOn", input.startedOn],
    ["today", input.today],
  ] as const) {
    if (!isIsoDate(value)) throw new NutritionInputError("invalid_date", field, "La fecha debe tener el formato AAAA-MM-DD.");
  }
  if (!(challenge.targetValue > 0)) {
    throw new NutritionInputError("out_of_range", "targetValue", "La meta diaria del reto debe ser mayor que 0.");
  }
  if (!isPositiveInt(challenge.durationDays)) {
    throw new NutritionInputError("out_of_range", "durationDays", "Los días del reto deben ser un entero mayor que 0.");
  }
  const qualifying = [
    ...new Set(
      input.days
        .filter((d) => d.date >= input.startedOn && d.date <= input.today)
        .filter((d) => challengeDayValue(challenge.kind, d) >= challenge.targetValue - 1e-9)
        .map((d) => d.date),
    ),
  ].sort();
  const required = challenge.durationDays;
  const completed = qualifying.length >= required;
  const n = Math.min(qualifying.length, required);
  const remaining = required - n;
  return {
    qualifyingDays: n,
    requiredDays: required,
    remainingDays: remaining,
    progress: roundDecimals(n / required, 3),
    completed,
    completedOn: completed ? qualifying[required - 1]! : null,
    message: completed
      ? `¡Reto completado! Sumaste ${required} ${required === 1 ? "día" : "días"}.`
      : n === 0
        ? "Tu reto empezó. Cada día que lo logres suma."
        : `Llevas ${n} de ${required} días. Si un día no se da, no pasa nada: sigues sumando desde donde vas.`,
  };
}

/** Fecha más temprana posible para completar un reto si se cumple todos los días desde hoy. */
export function earliestChallengeCompletion(progress: ChallengeProgress, today: string, todayCounted: boolean): string | null {
  if (progress.completed) return progress.completedOn;
  return addDays(today, progress.remainingDays - (todayCounted ? 0 : 1));
}
