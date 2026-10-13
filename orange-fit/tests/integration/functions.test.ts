import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { anonClient, createTestUser, deleteTestUsers, serviceClient, uniqueTag, type TestUser } from "./helpers";

type QuotaResult = { allowed: boolean; used: number; limit: number; plan: string; request_id: string | null };

describe("funciones RPC", () => {
  const admin = serviceClient();
  let freeUser: TestUser;
  let premiumUser: TestUser;
  let adminUser: TestUser;

  beforeAll(async () => {
    freeUser = await createTestUser("fn-free");
    premiumUser = await createTestUser("fn-premium");
    adminUser = await createTestUser("fn-admin", ["admin"]);

    const now = Date.now();
    const { error } = await admin.from("subscriptions").insert({
      user_id: premiumUser.id,
      plan_id: "premium",
      provider: "stripe",
      provider_customer_id: `cus_it_${uniqueTag()}`,
      provider_subscription_id: `sub_it_${randomUUID()}`,
      status: "active",
      current_period_start: new Date(now).toISOString(),
      current_period_end: new Date(now + 30 * 24 * 3600 * 1000).toISOString(),
    });
    if (error) throw error;
  });

  afterAll(async () => {
    await deleteTestUsers([freeUser, premiumUser, adminUser]);
  });

  describe("admin_metrics", () => {
    it("falla para un usuario normal", async () => {
      const { data, error } = await freeUser.client.rpc("admin_metrics");
      expect(data).toBeNull();
      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
    });

    it("falla para anon", async () => {
      const { error } = await anonClient().rpc("admin_metrics");
      expect(error?.code).toBe("42501");
    });

    it("funciona para un admin y no expone PII", async () => {
      const { data, error } = await adminUser.client.rpc("admin_metrics");
      expect(error).toBeNull();
      const metrics = data as Record<string, unknown>;
      expect(metrics.users_total).toEqual(expect.any(Number));
      expect(metrics.users_total as number).toBeGreaterThanOrEqual(3);
      expect(metrics.premium_active as number).toBeGreaterThanOrEqual(1);
      for (const key of [
        "users_new_7d",
        "users_new_30d",
        "users_active_7d",
        "users_active_30d",
        "premium_paying",
        "conversion_rate",
        "revenue_month_cents",
        "cancellations_month",
        "ai_requests_month",
        "ai_cost_usd_month",
      ]) {
        expect(metrics).toHaveProperty(key);
      }
      const serialized = JSON.stringify(metrics);
      expect(serialized).not.toContain("@");
      expect(serialized).not.toContain(freeUser.id);
    });
  });

  describe("is_premium / consume_ai_quota / complete_ai_request", () => {
    it("is_premium refleja la suscripción y no deja consultar a otros", async () => {
      expect((await premiumUser.client.rpc("is_premium")).data).toBe(true);
      expect((await freeUser.client.rpc("is_premium")).data).toBe(false);
      const spy = await freeUser.client.rpc("is_premium", { uid: premiumUser.id });
      expect(spy.error?.code).toBe("42501");
    });

    it("plan gratis: allowed=false (límite 0)", async () => {
      const { data, error } = await freeUser.client.rpc("consume_ai_quota", { kind: "photo" });
      expect(error).toBeNull();
      const result = data as QuotaResult;
      expect(result.allowed).toBe(false);
      expect(result.plan).toBe("free");
      expect(result.limit).toBe(0);
      expect(result.request_id).toBeNull();
    });

    it("premium: allowed=true, reserva la solicitud y se cierra una sola vez", async () => {
      const { data, error } = await premiumUser.client.rpc("consume_ai_quota", { kind: "photo" });
      expect(error).toBeNull();
      const result = data as QuotaResult;
      expect(result.allowed).toBe(true);
      expect(result.plan).toBe("premium");
      expect(result.limit).toBe(120);
      expect(result.used).toBe(1);
      expect(result.request_id).toEqual(expect.any(String));

      const pending = await premiumUser.client
        .from("ai_analysis_requests")
        .select("status, kind")
        .eq("id", result.request_id!)
        .single();
      expect(pending.data).toEqual({ status: "pending", kind: "photo" });

      // El usuario no puede tocar su cuota directamente.
      const tamper = await premiumUser.client
        .from("ai_analysis_requests")
        .update({ status: "failed" })
        .eq("id", result.request_id!)
        .select();
      expect(tamper.error?.code).toBe("42501");

      const close = await premiumUser.client.rpc("complete_ai_request", {
        request_id: result.request_id!,
        status: "succeeded",
        provider: "anthropic",
        model: "test-model",
        tokens_input: 10,
        tokens_output: 20,
        estimated_cost_usd: 0.0012,
        latency_ms: 800,
      });
      expect(close.error).toBeNull();
      expect(close.data).toBe(true);

      const again = await premiumUser.client.rpc("complete_ai_request", {
        request_id: result.request_id!,
        status: "failed",
      });
      expect(again.data).toBe(false);

      const second = await premiumUser.client.rpc("consume_ai_quota", { kind: "photo" });
      expect((second.data as QuotaResult).used).toBe(2);
    });

    it("otro usuario no puede cerrar una solicitud ajena", async () => {
      const { data } = await premiumUser.client.rpc("consume_ai_quota", { kind: "text" });
      const requestId = (data as QuotaResult).request_id!;
      const foreign = await freeUser.client.rpc("complete_ai_request", { request_id: requestId, status: "failed" });
      expect(foreign.data).toBe(false);
    });

    it("anon no puede consumir cuota", async () => {
      const { error } = await anonClient().rpc("consume_ai_quota", { kind: "photo" });
      expect(error?.code).toBe("42501");
    });
  });

  describe("check_rate_limit", () => {
    it("deja pasar hasta el máximo y corta al pasarlo", async () => {
      const bucket = `it-${uniqueTag()}`;
      const results: boolean[] = [];
      for (let i = 0; i < 4; i++) {
        const { data, error } = await freeUser.client.rpc("check_rate_limit", {
          bucket,
          max_hits: 3,
          window_seconds: 60,
        });
        expect(error).toBeNull();
        results.push(data as boolean);
      }
      expect(results).toEqual([true, true, true, false]);

      // Es por usuario: otro usuario tiene su propio contador.
      const other = await premiumUser.client.rpc("check_rate_limit", { bucket, max_hits: 3, window_seconds: 60 });
      expect(other.data).toBe(true);

      await admin.from("rate_limits").delete().like("key", `${bucket}%`);
    });

    it("rate_limits no es accesible desde la API", async () => {
      const { error } = await freeUser.client.from("rate_limits").select("*");
      expect(error?.code).toBe("42501");
    });
  });

  describe("log_admin_action", () => {
    it("solo el staff registra y solo admin lee la auditoría", async () => {
      const denied = await freeUser.client.rpc("log_admin_action", {
        action: "it.test",
        target_table: "foods",
        target_id: "x",
        metadata: {},
      });
      expect(denied.error?.code).toBe("42501");

      const marker = `it.${uniqueTag()}`;
      const ok = await adminUser.client.rpc("log_admin_action", {
        action: marker,
        target_table: "app_settings",
        target_id: "app_name",
        metadata: { reason: "prueba" },
      });
      expect(ok.error).toBeNull();

      const read = await adminUser.client.from("admin_audit_logs").select("actor_id, action").eq("action", marker);
      expect(read.data).toEqual([{ actor_id: adminUser.id, action: marker }]);

      const hidden = await freeUser.client.from("admin_audit_logs").select("id").eq("action", marker);
      expect(hidden.data ?? []).toEqual([]);

      const direct = await adminUser.client.from("admin_audit_logs").insert({ action: "forjado" });
      expect(direct.error?.code).toBe("42501");

      await admin.from("admin_audit_logs").delete().eq("action", marker);
    });
  });

  describe("get_shared_plan", () => {
    it("devuelve el plan compartido por token, sin datos del dueño", async () => {
      const token = `${randomUUID()}${randomUUID()}`.replace(/-/g, "");
      const plan = await freeUser.client
        .from("meal_plans")
        .insert({
          user_id: freeUser.id,
          name: "Semana de prueba",
          start_date: "2026-10-13",
          days: 7,
          share_token: token,
          shared_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      expect(plan.error).toBeNull();
      const item = await freeUser.client.from("meal_plan_items").insert({
        plan_id: plan.data!.id,
        user_id: freeUser.id,
        day_index: 0,
        meal_type: "breakfast",
        grams: 200,
        energy_kcal: 300,
        protein_g: 15,
        carbs_g: 40,
        fat_g: 8,
      });
      expect(item.error).toBeNull();

      // Sin la función, anon no ve planes.
      const direct = await anonClient().from("meal_plans").select("id").eq("share_token", token);
      expect(direct.data ?? []).toEqual([]);

      const { data, error } = await anonClient().rpc("get_shared_plan", { token });
      expect(error).toBeNull();
      const shared = data as { name: string; days: number; items: unknown[] };
      expect(shared.name).toBe("Semana de prueba");
      expect(shared.days).toBe(7);
      expect(shared.items).toHaveLength(1);
      expect(JSON.stringify(shared)).not.toContain(freeUser.id);

      const missing = await anonClient().rpc("get_shared_plan", { token: "x".repeat(32) });
      expect(missing.error).toBeNull();
      expect(missing.data).toBeNull();
    });
  });
});
