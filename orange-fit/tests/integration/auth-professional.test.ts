import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { findProfessionalByEmail, getPeopleInfo } from "@/features/profile/server/professionals";
import { loadPlanContext, manualContext, previewPlan } from "@/features/profile/server/targets";
import { saveOnboarding } from "@/features/onboarding/server/save";
import { createTestUser, deleteTestUsers, serviceClient, type TestUser } from "./helpers";

describe("acceso profesional: búsqueda por correo y vista del paciente", () => {
  const admin = serviceClient();
  let pro: TestUser;
  let regular: TestUser;
  let patient: TestUser;

  beforeAll(async () => {
    pro = await createTestUser("pro-busqueda", ["professional"]);
    regular = await createTestUser("pro-no-es");
    patient = await createTestUser("pro-paciente-vista");
    const saved = await saveOnboarding(patient.client, patient.id, {
      answers: {
        displayName: "Paciente",
        birthDate: "1988-03-02",
        sex: "male",
        heightCm: 175,
        weightKg: 90,
        targetWeightKg: 80,
        activityLevel: "moderate",
        trainingDaysPerWeek: 4,
        goal: "lose_fat",
        weeklyRateKg: 0.45,
        dietPattern: "omnivore",
        allergies: [],
        intolerances: [],
        restrictions: [],
        dislikedFoods: [],
        countryCode: "PE",
        currencyCode: "PEN",
        weeklyBudget: null,
        mealsPerDay: 3,
        experience: "intermediate",
        healthFlags: [],
      },
      consents: { termsPrivacy: true, healthData: true, aiProcessing: false, marketing: false },
      timezone: "America/Lima",
    });
    if (!saved.ok) throw new Error(saved.error.message);
  });

  afterAll(async () => {
    await deleteTestUsers([pro, regular, patient]);
  });

  it("encuentra solo cuentas con rol professional (sin distinguir mayúsculas)", async () => {
    const found = await findProfessionalByEmail(admin, pro.email.toUpperCase());
    expect(found?.id).toBe(pro.id);
    expect(found?.displayName).toBe("Prueba pro-busqueda");
    expect(await findProfessionalByEmail(admin, regular.email)).toBeNull();
    expect(await findProfessionalByEmail(admin, "nadie@example.com")).toBeNull();
  });

  it("devuelve nombre y correo de ids concretos", async () => {
    const info = await getPeopleInfo(admin, [pro.id]);
    expect(info.get(pro.id)).toEqual({ id: pro.id, email: pro.email, displayName: "Prueba pro-busqueda" });
  });

  it("con acceso vigente, el profesional arma el contexto del paciente vía RLS y puede fijar metas", async () => {
    expect(await loadPlanContext(pro.client, patient.id)).toBeNull();
    const grant = await patient.client.from("professional_access").insert({ professional_id: pro.id, user_id: patient.id });
    expect(grant.error).toBeNull();

    const ctx = await loadPlanContext(pro.client, patient.id);
    expect(ctx?.profile.display_name).toBe("Paciente");
    expect(ctx?.goal?.goal_type).toBe("lose_fat");
    const preview = previewPlan(ctx!);
    expect(preview.ok).toBe(true);
    const mctx = manualContext(ctx!, preview);
    expect(mctx.tdee).toBeGreaterThan(2000);

    const target = await pro.client.from("nutrition_targets").insert({
      user_id: patient.id,
      effective_from: ctx!.today,
      energy_kcal: 2200,
      protein_g: 170,
      carbs_g: 220,
      fat_g: 70,
      source: "professional",
      method: "professional",
      created_by: pro.id,
    });
    expect(target.error).toBeNull();
    const seen = await patient.client.from("nutrition_targets").select("source, created_by").eq("user_id", patient.id).eq("source", "professional");
    expect(seen.data).toEqual([{ source: "professional", created_by: pro.id }]);
  });
});
