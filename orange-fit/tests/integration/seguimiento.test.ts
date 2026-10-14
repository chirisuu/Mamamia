/**
 * Seguimiento (progreso, fotos, ayuno, cron) contra el Supabase local, con el cliente de cada
 * usuario (RLS) y las mismas funciones de servidor que usan las acciones.
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUsers, serviceClient, type TestUser } from "./helpers";

// Variables que leen los módulos de servidor (publicEnv/serverEnv) ANTES de importarlos.
const envFile = fileURLToPath(new URL("../../.env.local", import.meta.url));
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = /^\s*(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY)\s*=\s*"?([^"]*)"?\s*$/.exec(line);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!;
}
const CRON_SECRET = "it-cron-secret-0123456789abcdef";
process.env.CRON_SECRET = CRON_SECRET;
delete process.env.VAPID_PRIVATE_KEY; // sin push: no hay envíos reales en las pruebas

const { upsertWeight } = await import("@/features/progress/server/progress");
const photos = await import("@/features/progress/server/photos");
const { buildPhotoPath, PHOTO_BUCKET } = await import("@/features/progress/lib/photo-path");
const fasting = await import("@/features/fasting/server/fasting");
const { createDueReminders } = await import("@/lib/notifications/scheduler");
const cronRoute = await import("@/app/api/cron/reminders/route");

const today = "2026-10-13";
// Un PNG 1×1 real (el bucket solo acepta image/*).
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

describe("seguimiento: peso, fotos, ayuno y cron", () => {
  const admin = serviceClient();
  let a: TestUser;
  let b: TestUser;
  const objects: string[] = [];

  beforeAll(async () => {
    a = await createTestUser("seg-a");
    b = await createTestUser("seg-b");
    for (const u of [a, b]) {
      const { error } = await admin
        .from("profiles")
        .update({ birth_date: "1990-05-01", sex: "female", height_cm: 165, timezone: "America/Lima", onboarding_completed_at: new Date().toISOString() })
        .eq("id", u.id);
      if (error) throw new Error(error.message);
      const goal = await admin.from("user_goals").insert({ user_id: u.id, goal_type: "maintain", current_weight_kg: 70, health_flags: [] });
      if (goal.error) throw new Error(goal.error.message);
    }
  });

  afterAll(async () => {
    if (objects.length) await admin.storage.from(PHOTO_BUCKET).remove(objects);
    await deleteTestUsers([a, b]);
  });

  describe("peso: un registro por día (upsert)", () => {
    it("el segundo pesaje del mismo día reemplaza al primero", async () => {
      const first = await upsertWeight(a.client, a.id, { localDate: today, weightKg: 70.4, bodyFatPct: null, bodyFatMethod: null, note: null }, today);
      expect(first.replaced).toBe(false);
      const second = await upsertWeight(
        a.client,
        a.id,
        { localDate: today, weightKg: 70.1, bodyFatPct: 24.5, bodyFatMethod: "bioimpedance", note: "en ayunas" },
        today,
      );
      expect(second.replaced).toBe(true);
      const { data } = await a.client.from("weight_logs").select("weight_kg, body_fat_pct, body_fat_method").eq("user_id", a.id).eq("local_date", today);
      expect(data).toHaveLength(1);
      expect(Number(data![0]!.weight_kg)).toBe(70.1);
      expect(Number(data![0]!.body_fat_pct)).toBe(24.5);
    });

    it("rechaza fechas futuras", async () => {
      await expect(
        upsertWeight(a.client, a.id, { localDate: "2026-10-14", weightKg: 70, bodyFatPct: null, bodyFatMethod: null, note: null }, today),
      ).rejects.toMatchObject({ code: "INVALID_DATE" });
    });

    it("otro usuario no ve ni pisa el pesaje", async () => {
      const { data } = await b.client.from("weight_logs").select("id").eq("user_id", a.id);
      expect(data ?? []).toEqual([]);
    });
  });

  describe("fotos de progreso", () => {
    let path: string;
    let photoId: string;

    it("sin consentimiento progress_photos no se puede preparar la subida", async () => {
      expect(await photos.hasPhotoConsent(a.client, a.id)).toBe(false);
      await expect(photos.preparePhotoUpload(a.client, a.id, { localDate: today, pose: "front", ext: "webp" }, today)).rejects.toMatchObject({
        code: "NO_CONSENT",
      });
    });

    it("con consentimiento: prepara, sube con su sesión, guarda y la lee con URL firmada", async () => {
      await photos.grantPhotoConsent(a.client, a.id);
      expect(await photos.hasPhotoConsent(a.client, a.id)).toBe(true);
      ({ path } = await photos.preparePhotoUpload(a.client, a.id, { localDate: today, pose: "front", ext: "webp" }, today));
      expect(path.startsWith(`${a.id}/${today}-front-`)).toBe(true);

      // Guardar antes de subir: el servidor verifica que el archivo exista.
      await expect(photos.savePhoto(a.client, a.id, { path, localDate: today, pose: "front", note: null }, today)).rejects.toMatchObject({
        code: "NOT_UPLOADED",
      });

      const up = await a.client.storage.from(PHOTO_BUCKET).upload(path, PNG_1x1, { contentType: "image/png", upsert: false });
      expect(up.error).toBeNull();
      objects.push(path);

      const saved = await photos.savePhoto(a.client, a.id, { path, localDate: today, pose: "front", note: "Inicio" }, today);
      photoId = saved.id;

      const list = await photos.listPhotos(a.client, a.id);
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ id: photoId, localDate: today, pose: "front", note: "Inicio" });
      expect(list[0]!.url).toMatch(/\/storage\/v1\/object\/sign\/progress-photos\//);
      const res = await fetch(list[0]!.url!);
      expect(res.status).toBe(200);
      expect(Buffer.from(await res.arrayBuffer()).equals(PNG_1x1)).toBe(true);
    });

    it("otro usuario no puede leer, firmar, listar ni registrar la foto ajena", async () => {
      const down = await b.client.storage.from(PHOTO_BUCKET).download(path);
      expect(down.data).toBeNull();
      const signed = await b.client.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60);
      expect(signed.data).toBeNull();
      expect(await photos.listPhotos(b.client, b.id)).toEqual([]);
      const rows = await b.client.from("progress_photos").select("id").eq("user_id", a.id);
      expect(rows.data ?? []).toEqual([]);

      await photos.grantPhotoConsent(b.client, b.id);
      await expect(photos.savePhoto(b.client, b.id, { path, localDate: today, pose: "front", note: null }, today)).rejects.toMatchObject({
        code: "INVALID_PATH",
      });
      // Tampoco puede subir a la carpeta de A.
      const intruder = buildPhotoPath(a.id, today, "side", "intruderintruder", "webp");
      const up = await b.client.storage.from(PHOTO_BUCKET).upload(intruder, PNG_1x1, { contentType: "image/png" });
      expect(up.error).not.toBeNull();
    });

    it("las fotos nunca son públicas", async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`);
      expect(res.ok).toBe(false);
    });

    it("borrar elimina el archivo y la fila", async () => {
      await photos.deletePhoto(a.client, a.id, photoId);
      const { data } = await admin.storage.from(PHOTO_BUCKET).list(a.id);
      expect((data ?? []).map((o) => o.name)).not.toContain(path.split("/")[1]);
      expect(await photos.listPhotos(a.client, a.id)).toEqual([]);
      await expect(photos.deletePhoto(a.client, a.id, photoId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("ayuno: una sola sesión activa", () => {
    it("inicia, rechaza un segundo ayuno activo y permite otro tras terminar", async () => {
      const s1 = await fasting.startFasting(a.client, a.id, { protocol: "16:8", customHours: null, startedMinutesAgo: 60, note: null }, today);
      expect(s1).toMatchObject({ status: "active", targetHours: 16, protocol: "16:8" });

      await expect(
        fasting.startFasting(a.client, a.id, { protocol: "12:12", customHours: null, startedMinutesAgo: 0, note: null }, today),
      ).rejects.toMatchObject({ code: "ACTIVE_SESSION" });

      // Aun saltándose la validación del servidor, la base no permite dos activas.
      const direct = await a.client.from("fasting_sessions").insert({ user_id: a.id, protocol: "12:12", target_hours: 12, status: "active" });
      expect(direct.error?.code).toBe("23505");

      const ended = await fasting.endFasting(a.client, a.id, s1.id);
      expect(ended.session.status).toBe("completed");
      expect(ended.hours).toBeGreaterThanOrEqual(0.99);
      expect(ended.reached).toBe(false);

      const s2 = await fasting.startFasting(a.client, a.id, { protocol: "custom", customHours: 13.5, startedMinutesAgo: 0, note: null }, today);
      expect(s2.targetHours).toBe(13.5);
      await fasting.cancelFasting(a.client, a.id, s2.id);
      const data = await fasting.getFastingPageData(a.client, a.id);
      expect(data.active).toBeNull();
      expect(data.stats).toMatchObject({ completedSessions: 1, cancelledSessions: 1 });
    });

    it("con una bandera de riesgo (embarazo) no se puede iniciar", async () => {
      await admin.from("user_goals").update({ health_flags: ["pregnant"] }).eq("user_id", b.id).eq("is_active", true);
      await expect(
        fasting.startFasting(b.client, b.id, { protocol: "12:12", customHours: null, startedMinutesAgo: 0, note: null }, today),
      ).rejects.toMatchObject({ code: "RISK_BLOCKED" });
      const { count } = await b.client.from("fasting_sessions").select("id", { count: "exact", head: true }).eq("user_id", b.id);
      expect(count).toBe(0);
    });
  });

  describe("cron de recordatorios", () => {
    it("sin Authorization Bearer CRON_SECRET responde 401", async () => {
      const res = await cronRoute.GET(new Request("http://localhost/api/cron/reminders"));
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("UNAUTHORIZED");
      const wrong = await cronRoute.GET(new Request("http://localhost/api/cron/reminders", { headers: { Authorization: "Bearer otro-secreto-de-16-chars" } }));
      expect(wrong.status).toBe(401);
    });

    it("con el secreto corre y crea el recordatorio debido una sola vez", async () => {
      await admin.from("profiles").update({ notification_prefs: { logging: { enabled: true, hour: 10 } } }).eq("id", b.id);
      // Fecha real de Lima: la deduplicación compara el día local del created_at (reloj de la base) con
      // el día del recordatorio; con una fecha fija la prueba solo pasaba ese día.
      const limaToday = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
      const fixed = new Date(`${limaToday}T20:00:00Z`); // 15:00 en Lima, sin comidas registradas
      const run1 = await createDueReminders(admin, fixed);
      expect(run1.created).toBeGreaterThanOrEqual(1);
      const run2 = await createDueReminders(admin, new Date(fixed.getTime() + 60 * 60_000));
      const { data } = await admin.from("notifications").select("type").eq("user_id", b.id).eq("type", "logging_reminder");
      expect(data).toHaveLength(1);
      expect(run2.byType.logging_reminder ?? 0).toBeLessThanOrEqual(run1.byType.logging_reminder ?? 0);

      const ok = await cronRoute.GET(new Request("http://localhost/api/cron/reminders", { headers: { Authorization: `Bearer ${CRON_SECRET}` } }));
      expect(ok.status).toBe(200);
      const body = (await ok.json()) as { ok: boolean; push: { configured: boolean } };
      expect(body.ok).toBe(true);
      expect(body.push.configured).toBe(false);
    });

    it("con el acceso en pausa (retiró el permiso de datos de salud) no crea recordatorios", async () => {
      // revokeHealthConsent deja onboarding_completed_at en null; las preferencias y el ayuno siguen ahí.
      const fixed = new Date(`${today}T20:00:00Z`);
      const prefs = { logging: { enabled: true, hour: 10 }, fasting: { enabled: true } };
      const paused = await admin.from("profiles").update({ notification_prefs: prefs, onboarding_completed_at: null }).eq("id", a.id);
      expect(paused.error).toBeNull();
      const fast = await admin
        .from("fasting_sessions")
        .insert({ user_id: a.id, protocol: "16:8", target_hours: 16, status: "active", started_at: new Date(fixed.getTime() - 20 * 3_600_000).toISOString() });
      expect(fast.error).toBeNull();

      await createDueReminders(admin, fixed);
      const { data } = await admin.from("notifications").select("type").eq("user_id", a.id);
      expect(data).toEqual([]);
    });
  });
});
