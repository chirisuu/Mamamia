/**
 * ¿Puede esta persona iniciar un ayuno? (puro). Usa el cribado de `src/lib/nutrition/risk.ts` con el
 * perfil y el objetivo activo, y `canStartFasting`. Si faltan datos para el cribado, por prudencia
 * NO se permite y se explica qué completar (nunca se asume un perfil «sin riesgo»).
 */
import { ageOn, isIsoDate } from "@/lib/dates";
import {
  canStartFasting,
  computeBmi,
  isGoal,
  isSex,
  parseHealthFlags,
  RISK_FLAG_LABELS,
  screenRisk,
  type CanStartFastingResult,
  type RiskScreening,
} from "@/lib/nutrition";

export type EligibilityInput = {
  today: string;
  profile: { birth_date: string | null; sex: string | null; height_cm: number | null } | null;
  goal: { goal_type: string; health_flags: string[] | null; current_weight_kg: number | null } | null;
  /** Último peso registrado (kg) o null. */
  latestWeightKg: number | null;
  hasActiveSession: boolean;
};

export type FastingEligibility = Omit<CanStartFastingResult, "code"> & {
  /** "missing_data": faltan datos para el cribado. */
  code: CanStartFastingResult["code"] | "missing_data";
  risk: RiskScreening | null;
  /** Motivos legibles del bloqueo (p. ej. «Embarazo»), sin diagnósticos. */
  blockedBy: string[];
};

export function fastingEligibility(input: EligibilityInput): FastingEligibility {
  const { profile, goal } = input;
  const birth = profile?.birth_date && isIsoDate(profile.birth_date) ? profile.birth_date : null;
  const sex = profile?.sex && isSex(profile.sex) ? profile.sex : null;
  if (!birth || !sex || !goal || !isGoal(goal.goal_type)) {
    return {
      allowed: false,
      code: "missing_data",
      reason:
        "Para mostrarte el ayuno de forma segura necesitamos tu fecha de nacimiento, tu sexo para el cálculo y tu objetivo con tu información de salud. Complétalos en tu perfil.",
      cautions: [],
      risk: null,
      blockedBy: [],
    };
  }
  const weight = input.latestWeightKg ?? (goal.current_weight_kg != null ? Number(goal.current_weight_kg) : null);
  let bmi: number | null = null;
  try {
    bmi = weight && profile?.height_cm ? computeBmi(Number(weight), Number(profile.height_cm)) : null;
  } catch {
    bmi = null;
  }
  const risk = screenRisk({
    ageYears: ageOn(birth, input.today),
    sex,
    bmi,
    healthFlags: parseHealthFlags(goal.health_flags),
    goal: goal.goal_type,
  });
  const check = canStartFasting(risk, { hasActiveSession: input.hasActiveSession });
  const blockedBy = check.code === "risk_blocked" ? risk.flags.filter((f) => FLAGS_BLOCKING_FASTING.has(f)).map((f) => RISK_FLAG_LABELS[f]) : [];
  return { ...check, risk, blockedBy };
}

/** Banderas que bloquean el ayuno (tabla de NUTRITION_ENGINE.md §4). */
const FLAGS_BLOCKING_FASTING = new Set([
  "minor",
  "pregnant",
  "lactating",
  "underweight",
  "eating_disorder_history",
  "diabetes_medication",
  "kidney_disease",
]);
