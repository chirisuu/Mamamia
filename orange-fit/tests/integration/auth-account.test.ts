import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildAccountExport } from "@/features/profile/server/export";
import { deleteAccount } from "@/features/profile/server/delete-account";
import { createTestUser, deleteTestUsers, serviceClient, type TestUser } from "./helpers";

// JPEG mínimo (cabecera SOI/EOI): basta para probar Storage.
const tinyJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);

async function seedLogs(user: TestUser, name: string) {
  const meal = await user.client
    .from("meal_logs")
    .insert({ user_id: user.id, local_date: "2026-10-12", meal_type: "lunch" })
    .select("id")
    .single();
  if (meal.error) throw meal.error;
  const item = await user.client.from("meal_log_items").insert({
    meal_log_id: meal.data.id,
    user_id: user.id,
    name,
    quantity: 1,
    unit: "plato",
    grams: 300,
    energy_kcal: 500,
    protein_g: 30,
    carbs_g: 60,
    fat_g: 12,
    source: "manual",
  });
  if (item.error) throw item.error;
  const weight = await user.client.from("weight_logs").insert({ user_id: user.id, local_date: "2026-10-12", weight_kg: 80 });
  if (weight.error) throw weight.error;
  const water = await user.client.from("water_logs").insert({ user_id: user.id, local_date: "2026-10-12", amount_ml: 500 });
  if (water.error) throw water.error;
}

describe("exportación de datos de la cuenta", () => {
  const admin = serviceClient();
  let owner: TestUser;
  let patient: TestUser;
  const uploaded: Array<{ bucket: string; path: string }> = [];

  beforeAll(async () => {
    // La dueña del export es profesional y tiene acceso a otra persona: RLS le deja leer sus
    // registros, así que el export debe filtrar por su propio id y no mezclarlos.
    owner = await createTestUser("exp-duena", ["professional"]);
    patient = await createTestUser("exp-paciente");
    await seedLogs(owner, "Comida de la dueña");
    await seedLogs(patient, "Comida del paciente");
    const access = await patient.client.from("professional_access").insert({ professional_id: owner.id, user_id: patient.id });
    if (access.error) throw access.error;

    const photoPath = `${owner.id}/2026-10-12-front.jpg`;
    const up = await owner.client.storage.from("progress-photos").upload(photoPath, tinyJpeg, { contentType: "image/jpeg" });
    if (up.error) throw up.error;
    uploaded.push({ bucket: "progress-photos", path: photoPath });
    const row = await owner.client
      .from("progress_photos")
      .insert({ user_id: owner.id, local_date: "2026-10-12", storage_path: photoPath, pose: "front" });
    if (row.error) throw row.error;
    const mealPath = `${owner.id}/ia/plato.jpg`;
    const up2 = await owner.client.storage.from("meal-photos").upload(mealPath, tinyJpeg, { contentType: "image/jpeg" });
    if (up2.error) throw up2.error;
    uploaded.push({ bucket: "meal-photos", path: mealPath });
  });

  afterAll(async () => {
    for (const f of uploaded) await admin.storage.from(f.bucket).remove([f.path]);
    await deleteTestUsers([owner, patient]);
  });

  it("devuelve solo los datos propios, con URL firmadas para las fotos", async () => {
    const { data } = await owner.client.auth.getUser();
    const exported = await buildAccountExport(owner.client, data.user!);
    const json = JSON.parse(JSON.stringify(exported)) as Record<string, unknown>;

    expect((json.account as { id: string }).id).toBe(owner.id);
    expect((json.profile as { id: string }).id).toBe(owner.id);
    const items = json.meal_log_items as Array<{ user_id: string; name: string }>;
    expect(items.map((i) => i.name)).toEqual(["Comida de la dueña"]);
    for (const table of ["meal_logs", "meal_log_items", "weight_logs", "water_logs", "consents", "user_goals"]) {
      for (const row of json[table] as Array<{ user_id: string }>) expect(row.user_id).toBe(owner.id);
    }
    // Ningún dato del paciente en todo el archivo.
    expect(JSON.stringify(json)).not.toContain("Comida del paciente");
    expect(JSON.stringify(json)).not.toContain(patient.id);

    const received = json.professional_access_received as Array<Record<string, unknown>>;
    expect(received).toHaveLength(1);
    expect(received[0]).not.toHaveProperty("user_id");

    const files = json.files as { progress_photos: Array<{ path: string; url: string | null }>; meal_photos: Array<{ path: string; url: string | null }> };
    expect(files.progress_photos).toHaveLength(1);
    expect(files.progress_photos[0]?.url).toMatch(/\/storage\/v1\/object\/sign\/progress-photos\//);
    expect(files.meal_photos.map((f) => f.path)).toEqual([`${owner.id}/ia/plato.jpg`]);
    expect(files.meal_photos[0]?.url).toBeTruthy();

    const subs = json.subscriptions as unknown[];
    expect(Array.isArray(subs)).toBe(true);
    expect((json._meta as { version: number }).version).toBe(1);
  });
});

describe("eliminación de cuenta", () => {
  const admin = serviceClient();
  let doomed: TestUser;
  let subscriber: TestUser;
  const paths = {
    progress: "",
    meal: "",
    recipe: "",
  };

  beforeAll(async () => {
    doomed = await createTestUser("del-cuenta");
    subscriber = await createTestUser("del-suscrita");
    await seedLogs(doomed, "Algo");
    paths.progress = `${doomed.id}/frente.jpg`;
    paths.meal = `${doomed.id}/2026/10/plato.jpg`;
    paths.recipe = `${doomed.id}/receta.jpg`;
    for (const [bucket, path] of [
      ["progress-photos", paths.progress],
      ["meal-photos", paths.meal],
      ["recipe-images", paths.recipe],
    ] as const) {
      const up = await doomed.client.storage.from(bucket).upload(path, tinyJpeg, { contentType: "image/jpeg" });
      if (up.error) throw new Error(`${bucket}: ${up.error.message}`);
    }
    const sub = await admin.from("subscriptions").insert({
      user_id: subscriber.id,
      plan_id: "premium",
      provider: "stripe",
      provider_subscription_id: `sub_test_${subscriber.id}`,
      status: "active",
      cancel_at_period_end: false,
    });
    if (sub.error) throw sub.error;
  });

  afterAll(async () => {
    // doomed ya no existe si la prueba pasó; deleteTestUsers fallaría con él.
    await deleteTestUsers([subscriber]);
    const stillThere = await admin.auth.admin.getUserById(doomed.id);
    if (stillThere.data.user) await deleteTestUsers([doomed]);
  });

  it("no elimina si hay una suscripción que seguiría cobrando", async () => {
    const outcome = await deleteAccount(admin, subscriber.id);
    expect(outcome).toMatchObject({ ok: false, status: 409, code: "ACTIVE_SUBSCRIPTION" });
    const user = await admin.auth.admin.getUserById(subscriber.id);
    expect(user.data.user?.id).toBe(subscriber.id);
  });

  it("borra los archivos, el usuario (cascada) y deja auditoría mínima", async () => {
    const outcome = await deleteAccount(admin, doomed.id);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.filesRemoved).toEqual({ "progress-photos": 1, "meal-photos": 1, "recipe-images": 1 });

    for (const bucket of ["progress-photos", "meal-photos", "recipe-images"]) {
      const list = await admin.storage.from(bucket).list(doomed.id);
      expect(list.data ?? []).toEqual([]);
    }
    const user = await admin.auth.admin.getUserById(doomed.id);
    expect(user.data.user).toBeNull();
    const profile = await admin.from("profiles").select("id").eq("id", doomed.id);
    expect(profile.data).toEqual([]);
    const logs = await admin.from("meal_logs").select("id").eq("user_id", doomed.id);
    expect(logs.data).toEqual([]);

    const audit = await admin
      .from("admin_audit_logs")
      .select("action, target_table, target_id, metadata")
      .eq("target_id", doomed.id)
      .eq("action", "account.deleted_by_user");
    expect(audit.data).toHaveLength(1);
    expect(audit.data?.[0]?.metadata).toEqual({ files_removed: { "progress-photos": 1, "meal-photos": 1, "recipe-images": 1 } });
    // Metadatos mínimos: sin correo ni nombre.
    expect(JSON.stringify(audit.data)).not.toContain(doomed.email);
    await admin.from("admin_audit_logs").delete().eq("target_id", doomed.id);
  });
});
