import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/db/database.types";
import { getActiveGoal } from "@/lib/data/targets";
import { sanitizeDraftAnswers, type DraftAnswers } from "./schemas";

type Client = SupabaseClient<Database>;

/** Respuestas ya guardadas (perfil + objetivo activo + último peso), para precargar el asistente. */
export async function loadSavedAnswers(
  supabase: Client,
  user: User,
  profile: Tables<"profiles"> | null,
): Promise<{ answers: DraftAnswers; goal: Tables<"user_goals"> | null }> {
  const goal = await getActiveGoal(supabase, user.id);
  const { data: weights } = await supabase
    .from("weight_logs")
    .select("weight_kg")
    .eq("user_id", user.id)
    .order("local_date", { ascending: false })
    .limit(1);
  const metaName = typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : undefined;

  const raw: Record<string, unknown> = {
    displayName: profile?.display_name ?? metaName,
    birthDate: profile?.birth_date ?? undefined,
    sex: profile?.sex ?? undefined,
    heightCm: profile?.height_cm ?? undefined,
    weightKg: weights?.[0]?.weight_kg ?? goal?.current_weight_kg ?? undefined,
  };
  if (profile?.onboarding_completed_at || goal) {
    raw.countryCode = profile?.country_code;
    raw.currencyCode = profile?.currency_code;
  }
  if (goal) {
    Object.assign(raw, {
      targetWeightKg: goal.target_weight_kg,
      activityLevel: goal.activity_level,
      trainingDaysPerWeek: goal.training_days_per_week ?? undefined,
      goal: goal.goal_type,
      weeklyRateKg: goal.weekly_rate_kg,
      dietPattern: goal.diet_pattern ?? undefined,
      allergies: goal.allergies,
      intolerances: goal.intolerances,
      restrictions: goal.restrictions,
      dislikedFoods: goal.disliked_foods,
      weeklyBudget: goal.weekly_budget,
      mealsPerDay: goal.meals_per_day ?? undefined,
      experience: goal.nutrition_experience ?? undefined,
      healthFlags: goal.health_flags,
    });
  }
  return { answers: sanitizeDraftAnswers(raw), goal };
}

/** ¿La persona retiró el consentimiento de datos de salud después de tener un plan? */
export async function healthConsentRevoked(supabase: Client, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("consents")
    .select("granted")
    .eq("user_id", userId)
    .eq("consent_type", "health_data")
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0]?.granted === false;
}
