import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/db/database.types";
import { DEFAULT_TIMEZONE, isValidTimeZone, todayInTz } from "@/lib/dates";
import { getActiveGoal } from "@/lib/data/targets";
import {
  isActivityLevel,
  isGoal,
  isNutritionInputError,
  NUTRITION_EXPERIENCES,
  parseHealthFlags,
  type NutritionExperience,
} from "@/lib/nutrition";
import { ageGate, computePlan, type PlanInput, type PlanResult } from "@/features/onboarding/plan";
import type { ManualTargetsContext } from "@/features/profile/manual-targets";
import type { WeightSource } from "@/features/profile/target-inputs";

type Client = SupabaseClient<Database>;

export type SavedPlanContext = {
  userId: string;
  today: string;
  timezone: string;
  profile: Tables<"profiles">;
  goal: Tables<"user_goals"> | null;
  latestWeight: { weightKg: number; localDate: string } | null;
};

/** Perfil, objetivo activo y último peso de una persona (propia o paciente con acceso, vía RLS). */
export async function loadPlanContext(supabase: Client, userId: string): Promise<SavedPlanContext | null> {
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!profile) return null;
  const timezone = isValidTimeZone(profile.timezone) ? profile.timezone : DEFAULT_TIMEZONE;
  const [goal, { data: weights }] = await Promise.all([
    getActiveGoal(supabase, userId),
    supabase
      .from("weight_logs")
      .select("weight_kg, local_date")
      .eq("user_id", userId)
      .order("local_date", { ascending: false })
      .limit(1),
  ]);
  const w = weights?.[0];
  return {
    userId,
    today: todayInTz(timezone),
    timezone,
    profile,
    goal,
    latestWeight: w ? { weightKg: Number(w.weight_kg), localDate: w.local_date } : null,
  };
}

export type SavedPlanInput = { ok: true; input: PlanInput; weightSource: WeightSource } | { ok: false; reason: string };

/** Datos para recalcular con el peso más reciente (o el del objetivo si no hay pesajes). */
export function savedPlanInput(ctx: SavedPlanContext): SavedPlanInput {
  const { profile, goal } = ctx;
  if (!profile.birth_date || !profile.sex || profile.height_cm == null) {
    return { ok: false, reason: "Completa tu fecha de nacimiento, sexo para el cálculo y estatura en Datos personales." };
  }
  if (!goal || !isGoal(goal.goal_type) || !isActivityLevel(goal.activity_level)) {
    return { ok: false, reason: "No tienes un objetivo activo. Actualiza tu objetivo para calcular una meta." };
  }
  const weightSource: WeightSource | null = ctx.latestWeight
    ? { kind: "weight_log", localDate: ctx.latestWeight.localDate, weightKg: ctx.latestWeight.weightKg }
    : goal.current_weight_kg != null
      ? { kind: "goal", localDate: null, weightKg: Number(goal.current_weight_kg) }
      : null;
  if (!weightSource) return { ok: false, reason: "Registra tu peso en Progreso para recalcular tu meta." };
  const experience = (NUTRITION_EXPERIENCES as readonly string[]).includes(goal.nutrition_experience ?? "")
    ? (goal.nutrition_experience as NutritionExperience)
    : null;
  return {
    ok: true,
    weightSource,
    input: {
      birthDate: profile.birth_date,
      sex: profile.sex,
      heightCm: Number(profile.height_cm),
      weightKg: weightSource.weightKg,
      activityLevel: goal.activity_level,
      goal: goal.goal_type,
      weeklyRateKg: goal.weekly_rate_kg != null ? Number(goal.weekly_rate_kg) : null,
      experience,
      healthFlags: parseHealthFlags(goal.health_flags),
    },
  };
}

export type PlanPreview =
  | { ok: true; input: PlanInput; weightSource: WeightSource; plan: PlanResult }
  | { ok: false; reason: string };

export function previewPlan(ctx: SavedPlanContext): PlanPreview {
  const saved = savedPlanInput(ctx);
  if (!saved.ok) return saved;
  const { gate } = ageGate(saved.input.birthDate, ctx.today);
  if (gate !== "adult" && gate !== "minor") return { ok: false, reason: "Revisa tu fecha de nacimiento en Datos personales." };
  try {
    const plan = computePlan(saved.input, ctx.today);
    if (!plan.storable) {
      return { ok: false, reason: "Con estos datos no podemos fijar una meta automática segura. Defínela con un profesional." };
    }
    return { ok: true, input: saved.input, weightSource: saved.weightSource, plan };
  } catch (error) {
    if (isNutritionInputError(error)) return { ok: false, reason: error.message };
    throw error;
  }
}

/** Contexto para revisar metas manuales: TMB, gasto y bloqueos del cribado (si hay datos). */
export function manualContext(ctx: SavedPlanContext, preview: PlanPreview = previewPlan(ctx)): ManualTargetsContext {
  if (!preview.ok) {
    return { sex: ctx.profile.sex ?? null, bmr: null, tdee: null, deficitBlocked: false, cautious: false };
  }
  return {
    sex: preview.input.sex,
    bmr: preview.plan.targets.bmr,
    tdee: preview.plan.targets.tdee,
    deficitBlocked: preview.plan.risk.blocks.calorieDeficit,
    cautious: preview.plan.risk.blocks.aggressiveGoals,
  };
}
