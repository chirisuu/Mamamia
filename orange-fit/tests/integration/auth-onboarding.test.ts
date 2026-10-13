import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { todayInTz } from "@/lib/dates";
import { restoreHealthConsent, saveOnboarding } from "@/features/onboarding/server/save";
import type { OnboardingAnswers } from "@/features/onboarding/schemas";
import { createTestUser, deleteTestUsers, serviceClient, type TestUser } from "./helpers";

const answers: OnboardingAnswers = {
  displayName: "Lucía Prueba",
  birthDate: "1994-05-20",
  sex: "female",
  heightCm: 162,
  weightKg: 70,
  targetWeightKg: 62,
  activityLevel: "light",
  trainingDaysPerWeek: 3,
  goal: "lose_fat",
  weeklyRateKg: 0.35,
  dietPattern: "omnivore",
  allergies: ["mani"],
  intolerances: ["lactosa"],
  restrictions: ["Sin cerdo"],
  dislikedFoods: ["hígado"],
  countryCode: "PE",
  currencyCode: "PEN",
  weeklyBudget: 150,
  mealsPerDay: 4,
  experience: "beginner",
  healthFlags: [],
};

const consents = { termsPrivacy: true, healthData: true, aiProcessing: false, marketing: true };

describe("completeOnboarding (saveOnboarding) contra Supabase local", () => {
  const admin = serviceClient();
  let user: TestUser;
  let minor: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    user = await createTestUser("onb-adulta");
    minor = await createTestUser("onb-menor");
    other = await createTestUser("onb-invalida");
  });

  afterAll(async () => {
    await deleteTestUsers([user, minor, other]);
  });

  it("guarda perfil, objetivo, meta, consentimientos y peso inicial", async () => {
    const result = await saveOnboarding(user.client, user.id, { answers, consents, timezone: "America/Lima" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const today = todayInTz("America/Lima");
    expect(result.data.localDate).toBe(today);

    const profile = await user.client.from("profiles").select("*").eq("id", user.id).single();
    expect(profile.error).toBeNull();
    expect(profile.data).toMatchObject({
      display_name: "Lucía Prueba",
      birth_date: "1994-05-20",
      sex: "female",
      height_cm: 162,
      timezone: "America/Lima",
      country_code: "PE",
      currency_code: "PEN",
    });
    expect(profile.data?.onboarding_completed_at).not.toBeNull();

    const goals = await user.client.from("user_goals").select("*").eq("user_id", user.id);
    expect(goals.data).toHaveLength(1);
    expect(goals.data?.[0]).toMatchObject({
      goal_type: "lose_fat",
      is_active: true,
      weekly_rate_kg: 0.35,
      allergies: ["mani"],
      intolerances: ["lactosa"],
      weekly_budget: 150,
      budget_currency: "PEN",
      meals_per_day: 4,
      nutrition_experience: "beginner",
      requires_professional_review: false,
    });

    const targets = await user.client.from("nutrition_targets").select("*").eq("user_id", user.id);
    expect(targets.data).toHaveLength(1);
    const t = targets.data![0]!;
    expect(t).toMatchObject({ source: "auto", method: "mifflin_st_jeor", effective_from: today, energy_kcal: 1520, created_by: user.id });
    const inputs = t.inputs as Record<string, unknown>;
    expect(inputs.formula).toBe("Mifflin-St Jeor");
    expect(Array.isArray(inputs.steps) && inputs.steps.length).toBeGreaterThan(5);
    expect(Array.isArray(inputs.assumptions)).toBe(true);
    expect((inputs.risk as { level: string }).level).toBe("ok");

    const rows = await user.client.from("consents").select("consent_type, granted, version").eq("user_id", user.id);
    const byType = Object.fromEntries((rows.data ?? []).map((r) => [r.consent_type, r]));
    expect(Object.keys(byType).sort()).toEqual(["ai_processing", "health_data", "marketing", "privacy", "terms"]);
    expect(byType.health_data).toMatchObject({ granted: true, version: "2026-10" });
    expect(byType.ai_processing).toMatchObject({ granted: false });

    const weights = await user.client.from("weight_logs").select("local_date, weight_kg").eq("user_id", user.id);
    expect(weights.data).toEqual([{ local_date: today, weight_kg: 70 }]);
  });

  it("rehacerlo desactiva el objetivo anterior y conserva la fecha de onboarding", async () => {
    const before = await user.client.from("profiles").select("onboarding_completed_at").eq("id", user.id).single();
    const result = await saveOnboarding(user.client, user.id, {
      answers: { ...answers, goal: "maintain", weeklyRateKg: null, weightKg: 69 },
      consents,
      timezone: "America/Lima",
    });
    expect(result.ok).toBe(true);
    const goals = await user.client.from("user_goals").select("goal_type, is_active").eq("user_id", user.id).order("created_at");
    expect(goals.data?.map((g) => [g.goal_type, g.is_active])).toEqual([
      ["lose_fat", false],
      ["maintain", true],
    ]);
    const after = await user.client.from("profiles").select("onboarding_completed_at").eq("id", user.id).single();
    expect(after.data?.onboarding_completed_at).toBe(before.data?.onboarding_completed_at);
    // Mismo día: el peso se actualiza, no se duplica.
    const weights = await user.client.from("weight_logs").select("weight_kg").eq("user_id", user.id);
    expect(weights.data).toEqual([{ weight_kg: 69 }]);
  });

  it("menor de edad: mantenimiento y revisión profesional, aunque pida bajar", async () => {
    const result = await saveOnboarding(minor.client, minor.id, {
      answers: { ...answers, birthDate: "2010-01-01" },
      consents,
      timezone: "America/Lima",
    });
    expect(result.ok).toBe(true);
    const goal = await minor.client.from("user_goals").select("requires_professional_review, goal_type").eq("user_id", minor.id).single();
    expect(goal.data).toEqual({ requires_professional_review: true, goal_type: "lose_fat" });
    const target = await minor.client.from("nutrition_targets").select("energy_kcal, inputs").eq("user_id", minor.id).single();
    const inputs = target.data?.inputs as { result: { tdee: number; goal_adjustment_kcal: number }; risk: { level: string } };
    expect(inputs.result.goal_adjustment_kcal).toBe(0);
    expect(target.data?.energy_kcal).toBe(inputs.result.tdee);
    expect(inputs.risk.level).toBe("professional");
  });

  it("sin el consentimiento de datos de salud no guarda nada", async () => {
    const result = await saveOnboarding(other.client, other.id, {
      answers,
      consents: { ...consents, healthData: false },
      timezone: "America/Lima",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION");
    expect(result.error.fieldErrors?.["consents.healthData"]?.[0]).toMatch(/permiso/);
    const goals = await admin.from("user_goals").select("id").eq("user_id", other.id);
    expect(goals.data).toEqual([]);
    const profile = await admin.from("profiles").select("onboarding_completed_at, birth_date").eq("id", other.id).single();
    expect(profile.data).toEqual({ onboarding_completed_at: null, birth_date: null });
  });

  it("zona horaria inválida: usa America/Lima", async () => {
    const result = await saveOnboarding(other.client, other.id, { answers, consents, timezone: "Marte/Olympus" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.timezone).toBe("America/Lima");
  });

  it("retirar y volver a dar el consentimiento de salud pausa y reactiva el acceso", async () => {
    const nowIso = new Date().toISOString();
    await other.client
      .from("consents")
      .insert({ user_id: other.id, consent_type: "health_data", version: "2026-10", granted: false, granted_at: nowIso, revoked_at: nowIso });
    await other.client.from("profiles").update({ onboarding_completed_at: null }).eq("id", other.id);

    const restored = await restoreHealthConsent(other.client, other.id);
    expect(restored.ok).toBe(true);
    const profile = await other.client.from("profiles").select("onboarding_completed_at").eq("id", other.id).single();
    expect(profile.data?.onboarding_completed_at).not.toBeNull();
    const latest = await other.client
      .from("consents")
      .select("granted")
      .eq("user_id", other.id)
      .eq("consent_type", "health_data")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(latest.data?.[0]?.granted).toBe(true);
  });
});
