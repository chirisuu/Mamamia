import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/lib/db/database.types";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { DEFAULT_TIMEZONE, isValidTimeZone, todayInTz } from "@/lib/dates";
import { isNutritionInputError } from "@/lib/nutrition";
import { CONSENT_VERSION, type ConsentType } from "@/features/auth/consents";
import { buildAutoTargetInputs } from "@/features/profile/target-inputs";
import { ageGate, computePlan, goalNeedsRate, planInputFromAnswers, type PlanResult } from "../plan";
import { submissionSchema, type OnboardingAnswers, type OnboardingConsents } from "../schemas";

type Client = SupabaseClient<Database>;

export type SaveOnboardingResult = { goalId: string; targetId: string; localDate: string; timezone: string };

const DB_ERROR = "No pudimos guardar tu plan. Inténtalo de nuevo en un momento.";

export function goalRowFromAnswers(
  userId: string,
  a: OnboardingAnswers,
  plan: Pick<PlanResult, "requiresProfessionalReview">,
): TablesInsert<"user_goals"> {
  return {
    user_id: userId,
    goal_type: a.goal,
    current_weight_kg: a.weightKg,
    target_weight_kg: a.targetWeightKg,
    weekly_rate_kg: goalNeedsRate(a.goal) ? a.weeklyRateKg : null,
    activity_level: a.activityLevel,
    training_days_per_week: a.trainingDaysPerWeek,
    diet_pattern: a.dietPattern,
    allergies: a.allergies,
    intolerances: a.intolerances,
    restrictions: a.restrictions,
    disliked_foods: a.dislikedFoods,
    weekly_budget: a.weeklyBudget,
    budget_currency: a.weeklyBudget != null ? a.currencyCode : null,
    meals_per_day: a.mealsPerDay,
    nutrition_experience: a.experience,
    health_flags: a.healthFlags,
    requires_professional_review: plan.requiresProfessionalReview,
    is_active: true,
  };
}

export function consentRows(userId: string, c: OnboardingConsents, nowIso: string): TablesInsert<"consents">[] {
  const choices: Array<[ConsentType, boolean]> = [
    ["terms", c.termsPrivacy],
    ["privacy", c.termsPrivacy],
    ["health_data", c.healthData],
    ["ai_processing", c.aiProcessing],
    ["marketing", c.marketing],
  ];
  // Se registra también lo NO otorgado: deja constancia de la decisión y de la versión mostrada.
  return choices.map(([consent_type, granted]) => ({
    user_id: userId,
    consent_type,
    version: CONSENT_VERSION,
    granted,
    granted_at: nowIso,
  }));
}

/**
 * Guarda el onboarding: perfil, consentimientos, objetivo activo, meta nutricional, peso inicial y,
 * al final, `onboarding_completed_at`. Sin transacción (PostgREST), el orden hace que un fallo a
 * medias deje el onboarding sin completar y reintentarlo sea seguro: el objetivo anterior se
 * desactiva antes de insertar el nuevo, el peso del día se actualiza y metas/consentimientos son
 * historial. Usa el cliente con la sesión del usuario (RLS).
 */
export async function saveOnboarding(
  supabase: Client,
  userId: string,
  rawSubmission: unknown,
  opts: { now?: Date } = {},
): Promise<ActionResult<SaveOnboardingResult>> {
  const parsed = submissionSchema.safeParse(rawSubmission);
  if (!parsed.success) return invalid(parsed.error, "Revisa tus respuestas: hay datos incompletos o fuera de rango.");
  const { answers, consents } = parsed.data;

  const now = opts.now ?? new Date();
  const nowIso = now.toISOString();
  let timezone = parsed.data.timezone && isValidTimeZone(parsed.data.timezone) ? parsed.data.timezone : DEFAULT_TIMEZONE;

  const evaluate = (tz: string): ActionResult<{ today: string; plan: PlanResult }> => {
    const today = todayInTz(tz);
    const { gate } = ageGate(answers.birthDate, today);
    if (gate === "too_young") return fail("AGE_TOO_YOUNG", "Esta app es para personas de 13 años o más.");
    if (gate !== "adult" && gate !== "minor") return fail("INVALID_BIRTH_DATE", "Revisa tu fecha de nacimiento.");
    try {
      const plan = computePlan(input, today);
      if (!plan.storable) {
        return fail(
          "TARGETS_NOT_STORABLE",
          "Con estos datos no podemos calcular una meta segura de forma automática. Te recomendamos definirla con un profesional de salud.",
        );
      }
      return ok({ today, plan });
    } catch (error) {
      if (isNutritionInputError(error)) return fail("VALIDATION", error.message);
      throw error;
    }
  };

  const input = planInputFromAnswers(answers);
  let evaluated = evaluate(timezone);
  if (!evaluated.ok) return evaluated;

  const profilePatch = {
    id: userId,
    display_name: answers.displayName,
    birth_date: answers.birthDate,
    sex: answers.sex,
    height_cm: answers.heightCm,
    timezone,
    country_code: answers.countryCode,
    currency_code: answers.currencyCode,
  };
  let profileWrite = await supabase.from("profiles").upsert(profilePatch, { onConflict: "id" });
  if (profileWrite.error?.code === "22023") {
    // Postgres no conoce esa zona (Intl sí): usamos la de Lima en vez de fallar.
    timezone = DEFAULT_TIMEZONE;
    evaluated = evaluate(timezone);
    if (!evaluated.ok) return evaluated;
    profileWrite = await supabase.from("profiles").upsert({ ...profilePatch, timezone }, { onConflict: "id" });
  }
  if (profileWrite.error) return fail("DB_ERROR", DB_ERROR);
  const { today, plan } = evaluated.data;

  const consentWrite = await supabase.from("consents").insert(consentRows(userId, consents, nowIso));
  if (consentWrite.error) return fail("DB_ERROR", DB_ERROR);

  const deactivate = await supabase
    .from("user_goals")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("is_active", true);
  if (deactivate.error) return fail("DB_ERROR", DB_ERROR);

  const goal = await supabase.from("user_goals").insert(goalRowFromAnswers(userId, answers, plan)).select("id").single();
  if (goal.error || !goal.data) return fail("DB_ERROR", DB_ERROR);

  const t = plan.targets;
  const target = await supabase
    .from("nutrition_targets")
    .insert({
      user_id: userId,
      effective_from: today,
      energy_kcal: t.energyKcal,
      protein_g: t.proteinG,
      carbs_g: t.carbsG,
      fat_g: t.fatG,
      fiber_g: t.fiberG,
      water_ml: t.waterMl,
      method: t.method,
      source: "auto",
      created_by: userId,
      inputs: buildAutoTargetInputs(input, plan, {
        computedAt: nowIso,
        weightSource: { kind: "onboarding", localDate: today, weightKg: answers.weightKg },
        trigger: "onboarding",
      }),
    })
    .select("id")
    .single();
  if (target.error || !target.data) return fail("DB_ERROR", DB_ERROR);

  const weight = await supabase
    .from("weight_logs")
    .upsert({ user_id: userId, local_date: today, weight_kg: answers.weightKg }, { onConflict: "user_id,local_date" });
  if (weight.error) return fail("DB_ERROR", DB_ERROR);

  // Último paso: marca el onboarding (solo la primera vez; rehacerlo conserva la fecha original).
  const done = await supabase
    .from("profiles")
    .update({ onboarding_completed_at: nowIso })
    .eq("id", userId)
    .is("onboarding_completed_at", null);
  if (done.error) return fail("DB_ERROR", DB_ERROR);

  return ok({ goalId: goal.data.id, targetId: target.data.id, localDate: today, timezone });
}

/**
 * Vuelve a otorgar el consentimiento de datos de salud tras haberlo retirado (se había pausado el
 * acceso). Solo si la persona ya tenía un plan: si no, debe hacer el onboarding completo.
 */
export async function restoreHealthConsent(supabase: Client, userId: string, now: Date = new Date()): Promise<ActionResult<null>> {
  const goal = await supabase.from("user_goals").select("id").eq("user_id", userId).eq("is_active", true).maybeSingle();
  if (goal.error) return fail("DB_ERROR", DB_ERROR);
  if (!goal.data) return fail("NO_PLAN", "Completa el cuestionario para crear tu plan.");

  const nowIso = now.toISOString();
  const consent = await supabase
    .from("consents")
    .insert({ user_id: userId, consent_type: "health_data", version: CONSENT_VERSION, granted: true, granted_at: nowIso });
  if (consent.error) return fail("DB_ERROR", "No pudimos guardar tu autorización. Inténtalo de nuevo.");

  const done = await supabase
    .from("profiles")
    .update({ onboarding_completed_at: nowIso })
    .eq("id", userId)
    .is("onboarding_completed_at", null);
  if (done.error) return fail("DB_ERROR", "No pudimos reactivar tu cuenta. Inténtalo de nuevo.");
  return ok(null);
}
