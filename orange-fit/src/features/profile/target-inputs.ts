/**
 * Formato de `nutrition_targets.inputs` (jsonb): fórmula, valores y supuestos con los que se
 * fijó cada meta, para poder explicarla después. Versión 1.
 */
import { z } from "zod";
import { ACTIVITY_LEVELS } from "@/lib/nutrition";
import type { Json } from "@/lib/db/database.types";
import type { PlanInput, PlanResult } from "@/features/onboarding/plan";

export type TargetKind = "auto" | "manual" | "professional";

export type WeightSource = { kind: "onboarding" | "weight_log" | "goal"; localDate: string | null; weightKg: number };

export function buildAutoTargetInputs(
  input: PlanInput,
  plan: PlanResult,
  opts: { computedAt: string; weightSource: WeightSource; trigger: "onboarding" | "recalculation" },
): { [key: string]: Json } {
  const t = plan.targets;
  return {
    version: 1,
    kind: "auto",
    trigger: opts.trigger,
    computed_at: opts.computedAt,
    formula: "Mifflin-St Jeor",
    input: {
      sex: input.sex,
      age_years: plan.ageYears,
      height_cm: input.heightCm,
      weight_kg: input.weightKg,
      activity_level: input.activityLevel,
      activity_factor: ACTIVITY_LEVELS[input.activityLevel].factor,
      goal: plan.requestedGoal,
      effective_goal: plan.effectiveGoal,
      weekly_rate_kg: input.weeklyRateKg,
      experience: input.experience,
      health_flags: [...input.healthFlags],
    },
    weight_source: {
      kind: opts.weightSource.kind,
      local_date: opts.weightSource.localDate,
      weight_kg: opts.weightSource.weightKg,
    },
    result: {
      bmr: t.bmr,
      tdee: t.tdee,
      goal_adjustment_kcal: t.goalAdjustmentKcal,
      expected_weekly_change_kg: t.expectedWeeklyChangeKg,
      floor_applied: t.floorApplied,
      cap_applied: t.capApplied,
      bmi: t.bmi,
      reference_weight_kg: t.referenceWeightKg,
    },
    steps: t.steps.map((s) => ({ label: s.label, formula: s.formula, value: s.value, unit: s.unit })),
    assumptions: [...t.assumptions],
    warnings: [...t.warnings],
    risk: {
      level: plan.risk.level,
      flags: [...plan.risk.flags],
      blocks: { ...plan.risk.blocks },
      messages: [...plan.risk.messages],
    },
    maintenance_by_profile: plan.maintenanceByProfile,
    notes: [...plan.notes],
  };
}

export function buildManualTargetInputs(opts: {
  kind: "manual" | "professional";
  computedAt: string;
  context: { bmr: number | null; tdee: number | null; riskLevel: string | null };
  warnings: string[];
}): { [key: string]: Json } {
  return {
    version: 1,
    kind: opts.kind,
    computed_at: opts.computedAt,
    context: { bmr: opts.context.bmr, tdee: opts.context.tdee, risk_level: opts.context.riskLevel },
    warnings: [...opts.warnings],
    warnings_acknowledged: opts.warnings.length > 0,
  };
}

const stepSchema = z.object({
  label: z.string(),
  formula: z.string(),
  value: z.number(),
  unit: z.string(),
});

const storedSchema = z
  .object({
    kind: z.string().optional(),
    trigger: z.string().optional(),
    computed_at: z.string().optional(),
    steps: z.array(stepSchema).optional().catch(undefined),
    assumptions: z.array(z.string()).optional().catch(undefined),
    warnings: z.array(z.string()).optional().catch(undefined),
    notes: z.array(z.string()).optional().catch(undefined),
    maintenance_by_profile: z.boolean().optional().catch(undefined),
    risk: z
      .object({ level: z.string().optional(), messages: z.array(z.string()).optional() })
      .optional()
      .catch(undefined),
    result: z
      .object({
        bmr: z.number().nullish(),
        tdee: z.number().nullish(),
        goal_adjustment_kcal: z.number().nullish(),
        expected_weekly_change_kg: z.number().nullish(),
      })
      .optional()
      .catch(undefined),
    input: z
      .object({ weight_kg: z.number().optional(), goal: z.string().optional(), effective_goal: z.string().optional() })
      .optional()
      .catch(undefined),
    weight_source: z
      .object({ kind: z.string().optional(), local_date: z.string().nullish(), weight_kg: z.number().optional() })
      .optional()
      .catch(undefined),
    context: z.object({ bmr: z.number().nullish(), tdee: z.number().nullish() }).optional().catch(undefined),
  });

export type TargetExplanation = {
  steps: Array<{ label: string; formula: string; value: number; unit: string }>;
  assumptions: string[];
  warnings: string[];
  riskMessages: string[];
  riskLevel: string | null;
  notes: string[];
  bmr: number | null;
  tdee: number | null;
  expectedWeeklyChangeKg: number | null;
  weightKg: number | null;
  weightDate: string | null;
  maintenanceByProfile: boolean;
};

/** Lectura tolerante: una meta antigua o escrita por otro módulo no rompe la pantalla. */
export function parseTargetInputs(inputs: unknown): TargetExplanation {
  const parsed = storedSchema.safeParse(inputs ?? {});
  const d = parsed.success ? parsed.data : {};
  return {
    steps: d.steps ?? [],
    assumptions: d.assumptions ?? [],
    warnings: d.warnings ?? [],
    riskMessages: d.risk?.messages ?? [],
    riskLevel: d.risk?.level ?? null,
    notes: d.notes ?? [],
    bmr: d.result?.bmr ?? d.context?.bmr ?? null,
    tdee: d.result?.tdee ?? d.context?.tdee ?? null,
    expectedWeeklyChangeKg: d.result?.expected_weekly_change_kg ?? null,
    weightKg: d.weight_source?.weight_kg ?? d.input?.weight_kg ?? null,
    weightDate: d.weight_source?.local_date ?? null,
    maintenanceByProfile: d.maintenance_by_profile ?? false,
  };
}

export const TARGET_SOURCE_LABELS: Record<TargetKind, string> = {
  auto: "Calculada automáticamente",
  manual: "Ajuste manual",
  professional: "Fijada por tu profesional",
};

export function targetSourceLabel(source: string): string {
  return TARGET_SOURCE_LABELS[source as TargetKind] ?? source;
}
