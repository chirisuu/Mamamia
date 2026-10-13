/**
 * Inicio: presupuesto con desglose (sin doble conteo del ejercicio), consumido desde
 * daily_nutrition_totals, agua, peso, rachas, gráfico semanal y recordatorios con hora local.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDashboardData } from "@/features/dashboard/queries";
import { addItemsToMeal } from "@/features/diary/server/log-items";
import { createTestUser, deleteTestUsers, serviceClient, uniqueTag, type TestUser } from "./helpers";

// 2026-10-13 20:00 UTC = 15:00 en Lima.
const NOW = new Date("2026-10-13T20:00:00Z");
const TODAY = "2026-10-13";

describe("Inicio (getDashboardData)", () => {
  const admin = serviceClient();
  const tag = uniqueTag();
  let a: TestUser;
  let empty: TestUser;
  let foodId: string;

  beforeAll(async () => {
    a = await createTestUser("inicio-a");
    empty = await createTestUser("inicio-vacio");
    const { data: food, error } = await admin
      .from("foods")
      .insert({ name: `Pollo de prueba ${tag}`, energy_kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, source: "curated", verification_status: "curated", is_public: true })
      .select("id")
      .single();
    if (error) throw error;
    foodId = food.id;

    await a.client.from("profiles").update({ timezone: "America/Lima", count_exercise_calories: false }).eq("id", a.id);
    const { error: tErr } = await a.client.from("nutrition_targets").insert([
      { user_id: a.id, effective_from: "2026-10-01", energy_kcal: 2000, protein_g: 120, carbs_g: 220, fat_g: 65, fiber_g: 28, water_ml: 2000, source: "auto" },
    ]);
    if (tErr) throw tErr;
    // Desayuno hoy (sin almuerzo: a las 15 h debe recordarlo) y registros de días anteriores.
    await addItemsToMeal(a.client, a.id, {
      localDate: TODAY,
      mealType: "breakfast",
      items: [{ kind: "food", foodId, grams: 200, source: "search" }],
    });
    for (const date of ["2026-10-11", "2026-10-12"]) {
      await addItemsToMeal(a.client, a.id, { localDate: date, mealType: "lunch", items: [{ kind: "food", foodId, grams: 400, source: "search" }] });
    }
    await a.client.from("exercise_logs").insert({
      user_id: a.id,
      local_date: TODAY,
      activity_code: "12020",
      activity_name: "Trotar",
      met: 7.5,
      duration_min: 30,
      energy_kcal: 250,
      energy_source: "met_estimate",
    });
    await a.client.from("water_logs").insert([
      { user_id: a.id, local_date: TODAY, amount_ml: 250 },
      { user_id: a.id, local_date: TODAY, amount_ml: 500 },
    ]);
    await a.client.from("weight_logs").insert([
      { user_id: a.id, local_date: "2026-10-09", weight_kg: 80 },
      { user_id: a.id, local_date: "2026-10-11", weight_kg: 79.6 },
      { user_id: a.id, local_date: "2026-10-13", weight_kg: 79.2 },
    ]);
  });

  afterAll(async () => {
    await deleteTestUsers([a, empty]);
    if (foodId) await admin.from("foods").delete().eq("id", foodId);
  });

  async function profileOf(user: TestUser) {
    const { data } = await user.client.from("profiles").select("*").eq("id", user.id).single();
    return data;
  }

  it("presupuesto sin sumar ejercicio (perfil por defecto) y consumido de la vista", async () => {
    const d = await getDashboardData(a.client, a.id, await profileOf(a), NOW);
    expect(d.today).toBe(TODAY);
    expect(d.hour).toBe(15);
    expect(d.consumed.energyKcal).toBe(330);
    expect(d.consumed.proteinG).toBe(62);
    expect(d.consumed.fiberIncomplete).toBe(true);
    expect(d.budget!.budget.total).toBe(2000);
    expect(d.budget!.budget.exerciseLogged).toBe(250);
    expect(d.budget!.budget.remaining).toBe(1670);
    expect(d.budget!.rows.some((r) => r.key === "exercise")).toBe(false);
    expect(d.water).toEqual({ ml: 750, targetMl: 2000 });
    expect(d.weight).toMatchObject({ latestKg: 79.2, latestDate: TODAY, avg7Kg: 79.6 });
    expect(d.streaks?.logging.current).toBe(3);
    expect(d.weekly).toHaveLength(7);
    expect(d.weekly.at(-1)).toMatchObject({ date: TODAY, consumed: 330, target: 2000 });
    expect(d.weekly[0]!.consumed).toBeNull();
    expect(d.isNewUser).toBe(false);
    // 15 h sin almuerzo y con poca agua: ambos recordatorios, sin tono de culpa.
    expect(d.reminders.map((r) => r.id)).toEqual(["meal", "water"]);
    expect(d.reminders[0]!.title).toBe("Aún no registras el almuerzo");
  });

  it("con count_exercise_calories suma el ejercicio neto", async () => {
    await a.client.from("profiles").update({ count_exercise_calories: true }).eq("id", a.id);
    const d = await getDashboardData(a.client, a.id, await profileOf(a), NOW);
    expect(d.budget!.budget.total).toBe(2250);
    expect(d.budget!.budget.remaining).toBe(1920);
    expect(d.budget!.rows.find((r) => r.key === "exercise")?.value).toBe(250);
    await a.client.from("profiles").update({ count_exercise_calories: false }).eq("id", a.id);
  });

  it("usuario nuevo sin meta: estado vacío honesto", async () => {
    const d = await getDashboardData(empty.client, empty.id, await profileOf(empty), NOW);
    expect(d.isNewUser).toBe(true);
    expect(d.target).toBeNull();
    expect(d.budget).toBeNull();
    expect(d.streaks).toBeNull();
    expect(d.weekly.every((p) => p.consumed == null && p.target == null)).toBe(true);
    expect(d.reminders[0]).toMatchObject({ id: "target", href: "/app/perfil/metas" });
    expect(d.recommendations).toEqual([]);
  });
});
