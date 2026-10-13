/**
 * Factores de actividad física (multiplicadores del metabolismo basal) de uso clínico habitual,
 * en línea con los niveles de actividad física (PAL) de FAO/OMS/UNU.
 */
import { NutritionInputError } from "./errors";
import { assertInteger } from "./math";
import type { ActivityLevel } from "./types";
import { ACTIVITY_LEVEL_CODES, isActivityLevel } from "./types";

export interface ActivityLevelInfo {
  factor: number;
  label: string;
  description: string;
}

export const ACTIVITY_LEVELS: Record<ActivityLevel, ActivityLevelInfo> = {
  sedentary: {
    factor: 1.2,
    label: "Sedentario",
    description: "Pasas la mayor parte del día sentado y casi no haces ejercicio planificado.",
  },
  light: {
    factor: 1.375,
    label: "Ligero",
    description: "Haces ejercicio ligero 1 a 3 días por semana o caminas bastante en tu día a día.",
  },
  moderate: {
    factor: 1.55,
    label: "Moderado",
    description: "Haces ejercicio moderado 3 a 5 días por semana.",
  },
  active: {
    factor: 1.725,
    label: "Activo",
    description: "Entrenas intenso 6 a 7 días por semana, o entrenas varias veces y tu trabajo te mantiene de pie.",
  },
  very_active: {
    factor: 1.9,
    label: "Muy activo",
    description: "Entrenas fuerte a diario (o dos veces al día) o, además de entrenar, tu trabajo es físicamente pesado.",
  },
};

export function assertActivityLevel(level: unknown, field = "activityLevel"): ActivityLevel {
  if (typeof level !== "string" || !isActivityLevel(level)) {
    throw new NutritionInputError("invalid_value", field, "El nivel de actividad no es válido.");
  }
  return level;
}

export function activityFactor(level: ActivityLevel): number {
  return ACTIVITY_LEVELS[assertActivityLevel(level)].factor;
}

/** Cómo es tu jornada fuera del entrenamiento. */
export type WorkActivity = "seated" | "standing" | "physical";

export const WORK_ACTIVITY_LABELS: Record<WorkActivity, string> = {
  seated: "Trabajo o estudio mayormente sentado",
  standing: "Paso buena parte del día de pie o caminando",
  physical: "Trabajo físico (cargar, construir, limpiar, reparto a pie o en bici)",
};

const WORK_BONUS: Record<WorkActivity, number> = { seated: 0, standing: 1, physical: 2 };

function trainingIndex(days: number): number {
  if (days === 0) return 0;
  if (days <= 2) return 1;
  if (days <= 5) return 2;
  if (days <= 7) return 3;
  return 4; // más de 7 sesiones: dobles turnos
}

export interface ActivitySuggestion {
  level: ActivityLevel;
  factor: number;
  reason: string;
}

/**
 * Sugiere un nivel de actividad a partir de sesiones de entrenamiento por semana (0–14) y del
 * tipo de trabajo. Es un punto de partida: el usuario puede elegir otro nivel.
 */
export function suggestActivityLevel(input: { trainingDaysPerWeek: number; work: WorkActivity }): ActivitySuggestion {
  const days = assertInteger(input.trainingDaysPerWeek, 0, 14, "trainingDaysPerWeek", "Los días de entrenamiento");
  if (typeof input.work !== "string" || !Object.hasOwn(WORK_BONUS, input.work)) {
    throw new NutritionInputError("invalid_value", "work", "El tipo de trabajo no es válido.");
  }
  const index = Math.min(ACTIVITY_LEVEL_CODES.length - 1, trainingIndex(days) + WORK_BONUS[input.work]);
  const level = ACTIVITY_LEVEL_CODES[index]!;
  const sessions = days === 1 ? "1 sesión" : `${days} sesiones`;
  const workText: Record<WorkActivity, string> = {
    seated: "una jornada mayormente sentada",
    standing: "una jornada en la que pasas mucho tiempo de pie",
    physical: "un trabajo físico",
  };
  return {
    level,
    factor: ACTIVITY_LEVELS[level].factor,
    reason: `Con ${sessions} de entrenamiento por semana y ${workText[input.work]}, te sugerimos el nivel «${ACTIVITY_LEVELS[level].label}» (factor ${ACTIVITY_LEVELS[level].factor}).`,
  };
}
