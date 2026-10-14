import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { anonClient, createTestUser, deleteTestUsers, serviceClient, type TestUser } from "./helpers";

describe("perfiles, roles, cobros y ajustes", () => {
  const admin = serviceClient();
  let a: TestUser;
  let b: TestUser;

  beforeAll(async () => {
    a = await createTestUser("perfil-a");
    b = await createTestUser("perfil-b");
  });

  afterAll(async () => {
    await deleteTestUsers([a, b]);
  });

  it("el trigger handle_new_user crea el perfil con display_name y valores por defecto", async () => {
    const { data, error } = await a.client.from("profiles").select("*").eq("id", a.id).single();
    expect(error).toBeNull();
    expect(data?.display_name).toBe("Prueba perfil-a");
    expect(data?.timezone).toBe("America/Lima");
    expect(data?.country_code).toBe("PE");
    expect(data?.currency_code).toBe("PEN");
  });

  it("un usuario no ve el perfil de otro", async () => {
    const { data, error } = await a.client.from("profiles").select("id").eq("id", b.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("rechaza una zona horaria inexistente", async () => {
    const { error } = await a.client.from("profiles").update({ timezone: "Marte/Olympus" }).eq("id", a.id);
    expect(error?.code).toBe("22023");
  });

  it("un usuario no puede darse roles", async () => {
    const { error } = await a.client.from("user_roles").insert({ user_id: a.id, role: "admin" });
    expect(error?.code).toBe("42501");
    const { data } = await admin.from("user_roles").select("role").eq("user_id", a.id);
    expect(data).toEqual([]);
  });

  it("un superadmin otorga y quita roles por la API, pero superadmin solo por SQL", async () => {
    const boss = await createTestUser("perfil-super", ["superadmin"]);
    const other = await createTestUser("perfil-super-2", ["superadmin"]);
    try {
      const editor = await boss.client.from("user_roles").insert({ user_id: a.id, role: "editor" });
      expect(editor.error).toBeNull();
      const removed = await boss.client.from("user_roles").delete().eq("user_id", a.id).eq("role", "editor").select("role");
      expect(removed.data).toEqual([{ role: "editor" }]);

      const promote = await boss.client.from("user_roles").insert({ user_id: a.id, role: "superadmin" });
      expect(promote.error?.code).toBe("42501");
      const demote = await boss.client.from("user_roles").delete().eq("user_id", other.id).select("role");
      expect(demote.data).toEqual([]);
      const swap = await boss.client.from("user_roles").update({ role: "editor" }).eq("user_id", other.id).select("role");
      expect(swap.data).toEqual([]);
      const { data } = await admin.from("user_roles").select("user_id, role").in("user_id", [a.id, other.id]);
      expect(data).toEqual([{ user_id: other.id, role: "superadmin" }]);
    } finally {
      await deleteTestUsers([boss, other]);
    }
  });

  it("un usuario no puede escribir suscripciones ni pagos", async () => {
    const sub = await a.client.from("subscriptions").insert({
      user_id: a.id,
      plan_id: "premium",
      provider: "stripe",
      provider_subscription_id: `sub_fake_${randomUUID()}`,
      status: "active",
    });
    expect(sub.error?.code).toBe("42501");

    const pay = await a.client.from("payments").insert({
      user_id: a.id,
      provider: "stripe",
      provider_payment_id: `pi_fake_${randomUUID()}`,
      amount_cents: 2990,
      currency_code: "PEN",
      status: "succeeded",
    });
    expect(pay.error?.code).toBe("42501");

    const { data: subs } = await admin.from("subscriptions").select("id").eq("user_id", a.id);
    expect(subs).toEqual([]);
    const { data: pays } = await admin.from("payments").select("id").eq("user_id", a.id);
    expect(pays).toEqual([]);
  });

  it("un usuario no puede escribir app_settings", async () => {
    const insert = await a.client.from("app_settings").insert({ key: `it_${Date.now()}`, value: true });
    expect(insert.error?.code).toBe("42501");

    const update = await a.client
      .from("app_settings")
      .update({ value: "Hackeado" })
      .eq("key", "app_name")
      .select();
    // RLS: el UPDATE no alcanza ninguna fila.
    expect(update.data ?? []).toEqual([]);
    const { data } = await admin.from("app_settings").select("value").eq("key", "app_name").single();
    expect(data?.value).toBe("ORANGE FIT");
  });

  it("anon lee ajustes públicos y FAQ publicadas, pero no borradores legales", async () => {
    const anon = anonClient();
    const settings = await anon.from("app_settings").select("key, value").eq("key", "app_name");
    expect(settings.error).toBeNull();
    expect(settings.data).toEqual([{ key: "app_name", value: "ORANGE FIT" }]);

    const faq = await anon.from("content_pages").select("slug").eq("kind", "faq");
    expect(faq.error).toBeNull();
    expect((faq.data ?? []).length).toBeGreaterThanOrEqual(8);

    const legal = await anon.from("content_pages").select("slug").eq("slug", "terminos");
    expect(legal.error).toBeNull();
    expect(legal.data).toEqual([]);
  });

  it("anon ve los planes y precios activos", async () => {
    const anon = anonClient();
    const { data, error } = await anon.from("plan_prices").select("plan_id, interval, currency_code, amount_cents");
    expect(error).toBeNull();
    expect(data).toEqual(
      expect.arrayContaining([
        { plan_id: "premium", interval: "month", currency_code: "PEN", amount_cents: 2990 },
        { plan_id: "premium", interval: "year", currency_code: "PEN", amount_cents: 19990 },
      ]),
    );
  });

  it("los errores se pueden reportar con o sin sesión, pero no a nombre de otro", async () => {
    // El límite anónimo es por IP y hora: se limpia para que correr la suite seguido no lo agote.
    await admin.from("rate_limits").delete().like("key", "error_reports:ip:%");
    const anon = anonClient();
    const anonInsert = await anon.from("error_reports").insert({ message: "Fallo de prueba (anon)", route: "/it" });
    expect(anonInsert.error).toBeNull();
    await admin.from("rate_limits").delete().like("key", "error_reports:ip:%");

    const own = await a.client.from("error_reports").insert({ message: "Fallo de prueba", user_id: a.id });
    expect(own.error).toBeNull();

    const spoof = await a.client.from("error_reports").insert({ message: "Suplantación", user_id: b.id });
    expect(spoof.error?.code).toBe("42501");

    // Solo el staff los lee.
    const read = await a.client.from("error_reports").select("id");
    expect(read.data ?? []).toEqual([]);

    await admin.from("error_reports").delete().in("route", ["/it"]);
  });

  it("al pasar el límite de reportes responde 429", async () => {
    const key = `error_reports:u:${b.id}`;
    await admin.from("rate_limits").upsert({ key, window_start: new Date().toISOString(), count: 60 });
    const res = await b.client.from("error_reports").insert({ message: "Uno de más" });
    expect(res.status).toBe(429);
    expect(res.error).not.toBeNull();
    await admin.from("rate_limits").delete().in("key", [`error_reports:u:${a.id}`, key]);
  });
});
