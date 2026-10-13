import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUsers, type TestUser } from "./helpers";

describe("acceso de profesionales", () => {
  let patient: TestUser;
  let pro: TestUser;
  let otherPro: TestUser;
  let regular: TestUser;
  let accessId: string;

  const targetFixture = (userId: string, createdBy: string, source: "auto" | "manual" | "professional") => ({
    user_id: userId,
    created_by: createdBy,
    source,
    energy_kcal: 2000,
    protein_g: 120,
    carbs_g: 220,
    fat_g: 65,
    fiber_g: 28,
    water_ml: 2200,
  });

  beforeAll(async () => {
    patient = await createTestUser("pro-paciente");
    pro = await createTestUser("pro-con-acceso", ["professional"]);
    otherPro = await createTestUser("pro-sin-acceso", ["professional"]);
    regular = await createTestUser("pro-regular");

    const meal = await patient.client
      .from("meal_logs")
      .insert({ user_id: patient.id, local_date: "2026-10-13", meal_type: "breakfast" })
      .select("id")
      .single();
    if (meal.error) throw meal.error;
    const item = await patient.client.from("meal_log_items").insert({
      meal_log_id: meal.data.id,
      user_id: patient.id,
      name: "Avena con plátano",
      quantity: 1,
      unit: "tazón",
      grams: 300,
      energy_kcal: 350,
      protein_g: 10,
      carbs_g: 60,
      fat_g: 6,
    });
    if (item.error) throw item.error;
    const weight = await patient.client
      .from("weight_logs")
      .insert({ user_id: patient.id, local_date: "2026-10-13", weight_kg: 82 });
    if (weight.error) throw weight.error;
    const goal = await patient.client
      .from("user_goals")
      .insert({ user_id: patient.id, goal_type: "lose_fat", activity_level: "light", current_weight_kg: 82 });
    if (goal.error) throw goal.error;
  });

  afterAll(async () => {
    await deleteTestUsers([patient, pro, otherPro, regular]);
  });

  const readable = ["meal_logs", "meal_log_items", "weight_logs", "user_goals"] as const;

  it.each(readable)("sin acceso, el profesional no ve %s del usuario", async (table) => {
    const { data, error } = await pro.client.from(table).select("id").eq("user_id", patient.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("solo se puede dar acceso a cuentas con rol professional", async () => {
    const bad = await patient.client
      .from("professional_access")
      .insert({ professional_id: regular.id, user_id: patient.id });
    expect(bad.error?.code).toBe("23514");

    const ok = await patient.client
      .from("professional_access")
      .insert({ professional_id: pro.id, user_id: patient.id })
      .select("id")
      .single();
    expect(ok.error).toBeNull();
    accessId = ok.data!.id;
  });

  it("nadie puede crear accesos a nombre de otro usuario", async () => {
    const forged = await pro.client.from("professional_access").insert({ professional_id: pro.id, user_id: regular.id });
    expect(forged.error?.code).toBe("42501");
  });

  it.each(readable)("con acceso vigente, el profesional lee %s del usuario", async (table) => {
    const { data, error } = await pro.client.from(table).select("id").eq("user_id", patient.id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it.each(readable)("otro profesional sin acceso no lee %s", async (table) => {
    const { data } = await otherPro.client.from(table).select("id").eq("user_id", patient.id);
    expect(data ?? []).toEqual([]);
  });

  it("el profesional ve la vigencia del acceso que lo nombra", async () => {
    const { data } = await pro.client.from("professional_access").select("id, scope").eq("id", accessId);
    expect(data).toEqual([{ id: accessId, scope: "read_logs_write_targets" }]);
  });

  it("el profesional con acceso escribe metas con source='professional' (y solo así)", async () => {
    const ok = await pro.client.from("nutrition_targets").insert(targetFixture(patient.id, pro.id, "professional"));
    expect(ok.error).toBeNull();

    const asManual = await pro.client.from("nutrition_targets").insert(targetFixture(patient.id, pro.id, "manual"));
    expect(asManual.error?.code).toBe("42501");

    const noAccess = await otherPro.client
      .from("nutrition_targets")
      .insert(targetFixture(patient.id, otherPro.id, "professional"));
    expect(noAccess.error?.code).toBe("42501");

    const own = await patient.client.from("nutrition_targets").select("source").eq("user_id", patient.id);
    expect(own.data).toEqual([{ source: "professional" }]);
  });

  it("el usuario no puede hacerse pasar por profesional", async () => {
    const fake = await patient.client
      .from("nutrition_targets")
      .insert(targetFixture(patient.id, patient.id, "professional"));
    expect(fake.error?.code).toBe("42501");
  });

  it("al revocar el acceso el profesional deja de ver los registros", async () => {
    const revoke = await patient.client
      .from("professional_access")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", accessId)
      .select("id");
    expect(revoke.error).toBeNull();
    expect(revoke.data).toHaveLength(1);

    for (const table of readable) {
      const { data } = await pro.client.from(table).select("id").eq("user_id", patient.id);
      expect(data ?? []).toEqual([]);
    }
    const write = await pro.client.from("nutrition_targets").insert(targetFixture(patient.id, pro.id, "professional"));
    expect(write.error?.code).toBe("42501");
  });
});
