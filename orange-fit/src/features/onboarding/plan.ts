/**
 * Puente entre las respuestas del onboarding (o el perfil guardado) y el motor nutricional.
 * Puro: lo usan el navegador (vista previa del resultado) y el servidor (lo que se guarda).
 */
import { ageOn } from "@/lib/dates";
import {
  computeBmi,
  computeTargets,
  screenRisk,
  WEEKLY_LOSS_LIMITS,
  type ActivityLevel,
  type Goal,
  type HealthFlag,
  type NutritionExperience,
  type NutritionTargets,
  type RiskScreening,
  type Sex,
} from "@/lib/nutrition";
import type { OnboardingAnswers } from "./schemas";

export const MIN_AGE = 13;
export const MAX_AGE = 100;
/** Mínimo que acepta `nutrition_targets.energy_kcal`. */
export const MIN_STORABLE_KCAL = 500;

export type AgeGate = "invalid" | "too_young" | "too_old" | "minor" | "adult";

export function ageGate(birthDate: string | undefined | null, today: string): { gate: AgeGate; age: number | null } {
  if (!birthDate || birthDate > today) return { gate: "invalid", age: null };
  const age = ageOn(birthDate, today);
  if (!Number.isFinite(age)) return { gate: "invalid", age: null };
  if (age < MIN_AGE) return { gate: "too_young", age };
  if (age > MAX_AGE) return { gate: "too_old", age };
  return { gate: age < 18 ? "minor" : "adult", age };
}

/** Datos mínimos para calcular metas (vienen del onboarding o del perfil + objetivo activo). */
export type PlanInput = {
  birthDate: string;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  weeklyRateKg: number | null;
  experience: NutritionExperience | null;
  healthFlags: readonly HealthFlag[];
};

export type PlanResult = {
  ageYears: number;
  requestedGoal: Goal;
  /** Objetivo con el que se calcularon las metas (mantenimiento si el perfil pide revisión profesional). */
  effectiveGoal: Goal;
  maintenanceByProfile: boolean;
  requiresProfessionalReview: boolean;
  /** Cribado con el objetivo que eligió la persona (sus mensajes son los que se muestran). */
  risk: RiskScreening;
  targets: NutritionTargets;
  /** Notas propias del onboarding que se muestran junto a los mensajes del cribado. */
  notes: string[];
  /** false si la meta no se puede guardar (p. ej. queda bajo 500 kcal con datos extremos). */
  storable: boolean;
};

export function planInputFromAnswers(a: OnboardingAnswers): PlanInput {
  return {
    birthDate: a.birthDate,
    sex: a.sex,
    heightCm: a.heightCm,
    weightKg: a.weightKg,
    activityLevel: a.activityLevel,
    goal: a.goal,
    weeklyRateKg: a.weeklyRateKg,
    experience: a.experience,
    healthFlags: a.healthFlags,
  };
}

/**
 * Calcula el plan. Si el cribado pide acompañamiento profesional (`level === "professional"`),
 * las metas quedan en mantenimiento aunque el objetivo sea bajar o subir: lo decide la persona
 * con su profesional. El objetivo elegido se guarda igual en `user_goals`.
 * Lanza `NutritionInputError` si un dato está fuera de rango.
 */
export function computePlan(input: PlanInput, today: string): PlanResult {
  const ageYears = ageOn(input.birthDate, today);
  const bmi = computeBmi(input.weightKg, input.heightCm);
  const risk = screenRisk({ ageYears, sex: input.sex, bmi, healthFlags: input.healthFlags, goal: input.goal });
  const professional = risk.level === "professional";
  const adjustsEnergy = input.goal === "lose_fat" || input.goal === "recomposition" || input.goal === "gain_muscle";
  const effectiveGoal: Goal = professional && adjustsEnergy ? "maintain" : input.goal;

  const targets = computeTargets({
    sex: input.sex,
    ageYears,
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    activityLevel: input.activityLevel,
    goal: effectiveGoal,
    weeklyRateKg: effectiveGoal === "lose_fat" ? input.weeklyRateKg : null,
    experience: input.experience,
    healthFlags: input.healthFlags,
  });

  const notes: string[] = [];
  const maintenanceByProfile = effectiveGoal !== input.goal;
  if (maintenanceByProfile) {
    // Para objetivos con déficit bloqueado el cribado ya lo explica; aquí cubrimos el resto.
    const alreadyExplained = risk.messages.some((m) => m.includes("mantenimiento"));
    if (!alreadyExplained) {
      notes.push(
        "Por tu perfil de salud, por ahora tus metas son de mantenimiento. Conversa tu objetivo con un profesional: luego podrás ajustar tu meta desde tu perfil.",
      );
    }
  }
  if (professional) {
    notes.push(
      "Puedes usar el registro de comidas, agua y progreso con normalidad. Lo que pausamos son los ajustes de calorías y los planes automáticos sin revisión.",
    );
  }

  return {
    ageYears,
    requestedGoal: input.goal,
    effectiveGoal,
    maintenanceByProfile,
    requiresProfessionalReview: professional,
    risk,
    targets,
    notes,
    storable: targets.energyKcal >= MIN_STORABLE_KCAL,
  };
}

/** Cribado parcial (sin banderas de salud) para adaptar las opciones de ritmo antes del final. */
export function preliminaryRisk(
  a: Pick<OnboardingAnswers, "birthDate" | "sex" | "heightCm" | "weightKg" | "goal">,
  today: string,
): RiskScreening {
  return screenRisk({
    ageYears: ageOn(a.birthDate, today),
    sex: a.sex,
    bmi: computeBmi(a.weightKg, a.heightCm),
    healthFlags: [],
    goal: a.goal,
  });
}

export type RateOption = {
  /** % del peso corporal por semana. */
  pct: number;
  kg: number;
  label: string;
  hint: string;
  recommended: boolean;
  disabled: boolean;
  disabledReason: string | null;
};

const LOSS_RATES = [
  { pct: 0.25, label: "Gradual", hint: "El más fácil de sostener." },
  { pct: 0.5, label: "Moderado", hint: "Un buen equilibrio para la mayoría.", recommended: true },
  { pct: 0.75, label: "Constante", hint: "Pide más orden en tus comidas." },
  { pct: 1, label: "Rápido", hint: "El máximo que permitimos." },
] as const;

const GAIN_RATES = [
  { pct: 0.25, label: "Gradual", hint: "Menos ganancia de grasa.", recommended: true },
  { pct: 0.5, label: "Moderado", hint: "Para quien entrena fuerte y con constancia." },
] as const;

function roundRate(kg: number): number {
  return Math.round(Math.min(2, kg) * 100) / 100;
}

/** Opciones prudentes de ritmo semanal, con el % del peso visible. */
export function weeklyRateOptions(goal: Goal, weightKg: number, risk: Pick<RiskScreening, "blocks">): RateOption[] {
  if (goal === "lose_fat") {
    const capPct = risk.blocks.aggressiveGoals
      ? WEEKLY_LOSS_LIMITS.cautiousMaxFractionOfWeight * 100
      : WEEKLY_LOSS_LIMITS.maxFractionOfWeight * 100;
    return LOSS_RATES.map((r) => {
      const disabled = r.pct > capPct + 1e-9;
      return {
        pct: r.pct,
        kg: roundRate((weightKg * r.pct) / 100),
        label: r.label,
        hint: r.hint,
        recommended: "recommended" in r && r.recommended === true,
        disabled,
        disabledReason: disabled ? `Por tu perfil limitamos el ritmo a ${capPct.toLocaleString("es-PE")} % de tu peso por semana.` : null,
      };
    });
  }
  if (goal === "gain_muscle") {
    return GAIN_RATES.map((r) => ({
      pct: r.pct,
      kg: roundRate((weightKg * r.pct) / 100),
      label: r.label,
      hint: r.hint,
      recommended: "recommended" in r && r.recommended === true,
      disabled: false,
      disabledReason: null,
    }));
  }
  return [];
}

export function goalNeedsRate(goal: Goal | undefined): goal is "lose_fat" | "gain_muscle" {
  return goal === "lose_fat" || goal === "gain_muscle";
}
