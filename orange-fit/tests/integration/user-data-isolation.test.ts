import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUsers, serviceClient, type TestUser } from "./helpers";

/** El usuario A no puede leer ni tocar los registros del usuario B. */
describe("aislamiento de registros entre usuarios (RLS)", () => {
  const admin = serviceClient();
  let a: TestUser;
  let b: TestUser;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    a = await createTestUser("aisla-a");
    b = await createTestUser("aisla-b");

    const mealLog = await b.client
      .from("meal_logs")
      .insert({ user_id: b.id, local_date: "2026-10-13", meal_type: "lunch" })
      .select("id")
      .single();
    if (mealLog.error) throw mealLog.error;
    ids.meal_logs = mealLog.data.id;

    const item = await b.client
      .from("meal_log_items")
      .insert({
        meal_log_id: ids.meal_logs,
        user_id: b.id,
        name: "Arroz con pollo",
        quantity: 1,
        unit: "plato",
        grams: 350,
        energy_kcal: 520,
        protein_g: 28,
        carbs_g: 70,
        fat_g: 12,
        source: "manual",
      })
      .select("id")
      .single();
    if (item.error) throw item.error;
    ids.meal_log_items = item.data.id;

    const weight = await b.client
      .from("weight_logs")
      .insert({ user_id: b.id, local_date: "2026-10-13", weight_kg: 70.5 })
      .select("id")
      .single();
    if (weight.error) throw weight.error;
    ids.weight_logs = weight.data.id;

    const water = await b.client
      .from("water_logs")
      .insert({ user_id: b.id, local_date: "2026-10-13", amount_ml: 250 })
      .select("id")
      .single();
    if (water.error) throw water.error;
    ids.water_logs = water.data.id;

    const photo = await b.client
      .from("progress_photos")
      .insert({ user_id: b.id, local_date: "2026-10-13", storage_path: `${b.id}/front.jpg`, pose: "front" })
      .select("id")
      .single();
    if (photo.error) throw photo.error;
    ids.progress_photos = photo.data.id;
  });

  afterAll(async () => {
    await deleteTestUsers([a, b]);
  });

  const tables = ["meal_logs", "meal_log_items", "weight_logs", "water_logs", "progress_photos"] as const;

  it.each(tables)("B ve su propio registro en %s", async (table) => {
    const { data, error } = await b.client.from(table).select("id").eq("id", ids[table]);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it.each(tables)("A no puede leer el registro de B en %s", async (table) => {
    const { data, error } = await a.client.from(table).select("id").eq("id", ids[table]);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it.each(tables)("A no puede borrar el registro de B en %s", async (table) => {
    const { data } = await a.client.from(table).delete().eq("id", ids[table]).select("id");
    expect(data ?? []).toEqual([]);
    const still = await admin.from(table).select("id").eq("id", ids[table]);
    expect(still.data).toHaveLength(1);
  });

  it("A no puede modificar los registros de B", async () => {
    const meal = await a.client.from("meal_logs").update({ meal_type: "dinner" }).eq("id", ids.meal_logs).select();
    expect(meal.data ?? []).toEqual([]);
    const item = await a.client.from("meal_log_items").update({ energy_kcal: 1 }).eq("id", ids.meal_log_items).select();
    expect(item.data ?? []).toEqual([]);
    const weight = await a.client.from("weight_logs").update({ weight_kg: 99 }).eq("id", ids.weight_logs).select();
    expect(weight.data ?? []).toEqual([]);
    const water = await a.client.from("water_logs").update({ amount_ml: 4000 }).eq("id", ids.water_logs).select();
    expect(water.data ?? []).toEqual([]);
    const photo = await a.client.from("progress_photos").update({ note: "x" }).eq("id", ids.progress_photos).select();
    expect(photo.data ?? []).toEqual([]);

    const check = await admin.from("meal_log_items").select("energy_kcal").eq("id", ids.meal_log_items).single();
    expect(Number(check.data?.energy_kcal)).toBe(520);
    const checkWeight = await admin.from("weight_logs").select("weight_kg").eq("id", ids.weight_logs).single();
    expect(Number(checkWeight.data?.weight_kg)).toBe(70.5);
  });

  it("A no puede crear registros a nombre de B ni colgarse de la comida de B", async () => {
    const asB = await a.client.from("meal_logs").insert({ user_id: b.id, local_date: "2026-10-14", meal_type: "breakfast" });
    expect(asB.error?.code).toBe("42501");

    const intoBMeal = await a.client.from("meal_log_items").insert({
      meal_log_id: ids.meal_logs,
      user_id: a.id,
      name: "Intruso",
      quantity: 1,
      unit: "g",
      energy_kcal: 1,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    });
    expect(intoBMeal.error?.code).toBe("42501");

    const water = await a.client.from("water_logs").insert({ user_id: b.id, local_date: "2026-10-14", amount_ml: 100 });
    expect(water.error?.code).toBe("42501");

    // La ruta de la foto debe estar en la carpeta del dueño.
    const photo = await a.client
      .from("progress_photos")
      .insert({ user_id: a.id, local_date: "2026-10-14", storage_path: `${b.id}/robada.jpg` });
    expect(photo.error?.code).toBe("23514");
  });

  it("los totales diarios solo muestran lo propio", async () => {
    const own = await b.client.from("daily_nutrition_totals").select("*").eq("local_date", "2026-10-13");
    expect(own.error).toBeNull();
    expect(own.data).toHaveLength(1);
    expect(Number(own.data?.[0]?.energy_kcal)).toBe(520);
    expect(own.data?.[0]?.items_count).toBe(1);

    const other = await a.client.from("daily_nutrition_totals").select("*").eq("user_id", b.id);
    expect(other.data ?? []).toEqual([]);
  });
});
