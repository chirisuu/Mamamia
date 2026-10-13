/**
 * Módulo pagos contra el Supabase LOCAL: route handlers reales con firma real.
 *
 * - Stripe: el webhook se firma con `Stripe.webhooks.generateTestHeaderString` (sin red). Sin
 *   STRIPE_SECRET_KEY el webhook trabaja con el contenido firmado del evento.
 * - Mercado Pago: su API no es accesible desde aquí; el webhook se prueba con firma HMAC real y un
 *   cliente con `fetch` simulado que devuelve los recursos que consultaría.
 * - Checkout/cancelar/portal sin claves del proveedor → 503 (nunca un éxito simulado).
 */
import fs from "node:fs";
import { createHmac, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { serviceClient, uniqueTag } from "./helpers";

const jar = vi.hoisted(() => ({ current: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [...jar.current].map(([name, value]) => ({ name, value })),
    get: (name: string) => (jar.current.has(name) ? { name, value: jar.current.get(name)! } : undefined),
    set: (name: string, value: string) => {
      if (value) jar.current.set(name, value);
      else jar.current.delete(name);
    },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const envFile = fileURLToPath(new URL("../../.env.local", import.meta.url));
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
// Solo el secreto del webhook de Stripe: sin claves de API de ningún proveedor.
const STRIPE_WEBHOOK_SECRET = `whsec_it_${randomUUID().replace(/-/g, "")}`;
process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET;
delete process.env.STRIPE_SECRET_KEY;
delete process.env.MERCADOPAGO_ACCESS_TOKEN;
delete process.env.MERCADOPAGO_WEBHOOK_SECRET;

type Db = SupabaseClient<Database>;
type Session = { id: string; email: string; cookies: Map<string, string>; client: Db };

async function createSessionUser(label: string): Promise<Session> {
  const admin = serviceClient();
  const email = `it-pagos-${label}-${uniqueTag()}@example.com`;
  const password = `Pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  const cookies = new Map<string, string>();
  const client = createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (list) => {
        for (const { name, value } of list) {
          if (value) cookies.set(name, value);
          else cookies.delete(name);
        }
      },
    },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn: ${signInError.message}`);
  return { id: data.user.id, email, cookies, client };
}

const as = (s: Session | null) => {
  jar.current = s ? s.cookies : new Map();
};

const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

type Routes = {
  stripeWebhook: typeof import("@/app/api/billing/webhooks/stripe/route");
  mpWebhook: typeof import("@/app/api/billing/webhooks/mercadopago/route");
  checkout: typeof import("@/app/api/billing/checkout/route");
  cancel: typeof import("@/app/api/billing/cancel/route");
  portal: typeof import("@/app/api/billing/portal/route");
  confirm: typeof import("@/app/api/billing/confirm/route");
  mp: typeof import("@/lib/billing/mercadopago");
};

describe("módulo pagos (Supabase local)", () => {
  const admin = serviceClient();
  const tag = uniqueTag();
  const users: Session[] = [];
  const eventIds: Array<{ provider: "stripe" | "mercadopago"; id: string }> = [];
  let r: Routes;
  let ana: Session;
  let beto: Session;
  let stripePriceRowId: string;
  const stripePriceId = `price_it_${tag}`;
  const subId = `sub_it_${tag}`;

  const post = async (handler: (req: Request) => Promise<Response>, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await handler(
      new Request(`http://localhost:3000${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", host: "localhost:3000", ...headers },
        body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
      }),
    );
    return { status: res.status, body: (await res.json()) as Record<string, unknown> & { error?: { code: string; message: string } } };
  };

  function stripeEvent(type: string, object: Record<string, unknown>, id = `evt_it_${randomUUID().replace(/-/g, "")}`) {
    eventIds.push({ provider: "stripe", id });
    return { id, object: "event", type, created: unix(new Date().toISOString()), api_version: Stripe.API_VERSION, data: { object } };
  }

  function stripeSubscription(over: Record<string, unknown> = {}) {
    return {
      id: subId,
      object: "subscription",
      customer: `cus_it_${tag}`,
      status: "trialing",
      cancel_at_period_end: false,
      cancel_at: null,
      canceled_at: null,
      trial_end: unix(inDays(7)),
      metadata: { user_id: ana.id },
      items: {
        object: "list",
        data: [{ id: "si_1", price: { id: stripePriceId }, current_period_start: unix(new Date().toISOString()), current_period_end: unix(inDays(7)) }],
      },
      ...over,
    };
  }

  const sendStripe = (event: object, secret = STRIPE_WEBHOOK_SECRET) => {
    const payload = JSON.stringify(event);
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret });
    return post(r.stripeWebhook.POST, "/api/billing/webhooks/stripe", payload, { "stripe-signature": signature });
  };

  const isPremium = async (s: Session) => {
    const { data, error } = await s.client.rpc("is_premium");
    if (error) throw error;
    return data;
  };

  beforeAll(async () => {
    r = {
      stripeWebhook: await import("@/app/api/billing/webhooks/stripe/route"),
      mpWebhook: await import("@/app/api/billing/webhooks/mercadopago/route"),
      checkout: await import("@/app/api/billing/checkout/route"),
      cancel: await import("@/app/api/billing/cancel/route"),
      portal: await import("@/app/api/billing/portal/route"),
      confirm: await import("@/app/api/billing/confirm/route"),
      mp: await import("@/lib/billing/mercadopago"),
    };
    ana = await createSessionUser("ana");
    beto = await createSessionUser("beto");
    users.push(ana, beto);
    // Precio inactivo con id de Stripe propio de esta corrida (no choca con el activo de la semilla).
    const { data, error } = await admin
      .from("plan_prices")
      .insert({ plan_id: "premium", interval: "month", currency_code: "USD", amount_cents: 799, trial_days: 7, stripe_price_id: stripePriceId, is_active: false })
      .select("id")
      .single();
    if (error) throw error;
    stripePriceRowId = data.id;
  });

  afterAll(async () => {
    as(null);
    for (const u of users) await admin.auth.admin.deleteUser(u.id);
    for (const e of eventIds) await admin.from("billing_events").delete().eq("provider", e.provider).eq("event_id", e.id);
    if (stripePriceRowId) await admin.from("plan_prices").delete().eq("id", stripePriceRowId);
  });

  describe("webhook de Stripe", () => {
    it("firma inválida → 400 y no registra el evento", async () => {
      const event = stripeEvent("customer.subscription.created", stripeSubscription());
      const res = await sendStripe(event, "whsec_otro_secreto");
      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe("INVALID_SIGNATURE");
      const { data } = await admin.from("billing_events").select("id").eq("provider", "stripe").eq("event_id", event.id);
      expect(data).toEqual([]);
      const { data: subs } = await admin.from("subscriptions").select("id").eq("user_id", ana.id);
      expect(subs).toEqual([]);
    });

    it("sin cabecera de firma → 400", async () => {
      const res = await post(r.stripeWebhook.POST, "/api/billing/webhooks/stripe", JSON.stringify(stripeEvent("ping", {})));
      expect(res.status).toBe(400);
    });

    it("evento firmado crea la suscripción y is_premium pasa a true", async () => {
      expect(await isPremium(ana)).toBe(false);
      const event = stripeEvent("customer.subscription.created", stripeSubscription());
      const res = await sendStripe(event);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ received: true, result: "saved" });

      const { data: subs } = await admin.from("subscriptions").select("*").eq("user_id", ana.id);
      expect(subs).toHaveLength(1);
      expect(subs![0]).toMatchObject({
        provider: "stripe",
        provider_subscription_id: subId,
        provider_customer_id: `cus_it_${tag}`,
        status: "trialing",
        plan_id: "premium",
        price_id: stripePriceRowId,
        cancel_at_period_end: false,
      });
      expect(subs![0]!.trial_end).not.toBeNull();
      expect(await isPremium(ana)).toBe(true);
      // Beto no ve la suscripción de Ana (RLS) y sigue sin Premium.
      const { data: seenByBeto } = await beto.client.from("subscriptions").select("id").eq("user_id", ana.id);
      expect(seenByBeto).toEqual([]);
      expect(await isPremium(beto)).toBe(false);

      // Reenviar el MISMO evento no reprocesa ni duplica.
      const again = await sendStripe(event);
      expect(again.status).toBe(200);
      expect(again.body).toMatchObject({ duplicate: true });
      const { data: after } = await admin.from("subscriptions").select("id").eq("user_id", ana.id);
      expect(after).toHaveLength(1);
      const { data: events } = await admin.from("billing_events").select("id").eq("provider", "stripe").eq("event_id", event.id);
      expect(events).toHaveLength(1);
    });

    it("updated: activa y cancelada al final del periodo (sigue con acceso)", async () => {
      const periodEnd = unix(inDays(30));
      const res = await sendStripe(
        stripeEvent(
          "customer.subscription.updated",
          stripeSubscription({
            status: "active",
            trial_end: null,
            cancel_at_period_end: true,
            items: { object: "list", data: [{ id: "si_1", price: { id: stripePriceId }, current_period_start: unix(new Date().toISOString()), current_period_end: periodEnd }] },
          }),
        ),
      );
      expect(res.status).toBe(200);
      const { data } = await admin.from("subscriptions").select("status, cancel_at_period_end, current_period_end").eq("provider_subscription_id", subId).single();
      expect(data).toMatchObject({ status: "active", cancel_at_period_end: true });
      expect(new Date(data!.current_period_end!).getTime()).toBe(periodEnd * 1000);
      expect(await isPremium(ana)).toBe(true);
    });

    it("invoice.paid registra el cobro una sola vez; invoice.payment_failed registra el fallo y avisa", async () => {
      const invoice = (id: string, over: Record<string, unknown> = {}) => ({
        id,
        object: "invoice",
        customer: `cus_it_${tag}`,
        currency: "usd",
        amount_paid: 799,
        amount_due: 799,
        status_transitions: { paid_at: unix(new Date().toISOString()) },
        parent: { type: "subscription_details", subscription_details: { subscription: subId, metadata: { user_id: ana.id } } },
        ...over,
      });
      const paid = stripeEvent("invoice.paid", invoice(`in_it_${tag}_1`));
      expect((await sendStripe(paid)).status).toBe(200);
      expect((await sendStripe(paid)).body).toMatchObject({ duplicate: true });

      const failed = stripeEvent("invoice.payment_failed", invoice(`in_it_${tag}_2`, { amount_paid: 0 }));
      expect((await sendStripe(failed)).status).toBe(200);

      const { data: payments } = await ana.client.from("payments").select("provider_payment_id, amount_cents, currency_code, status, subscription_id, paid_at").order("provider_payment_id");
      expect(payments).toHaveLength(2);
      expect(payments![0]).toMatchObject({ provider_payment_id: `in_it_${tag}_1`, amount_cents: 799, currency_code: "USD", status: "succeeded" });
      expect(payments![0]!.subscription_id).not.toBeNull();
      expect(payments![0]!.paid_at).not.toBeNull();
      expect(payments![1]).toMatchObject({ provider_payment_id: `in_it_${tag}_2`, status: "failed", paid_at: null });

      const { data: notes } = await admin.from("notifications").select("type, url").eq("user_id", ana.id).eq("type", "billing.payment_failed");
      expect(notes).toEqual([{ type: "billing.payment_failed", url: "/app/perfil/suscripcion" }]);
    });

    it("la factura de 0 de la prueba no se registra como cobro", async () => {
      const res = await sendStripe(
        stripeEvent("invoice.paid", {
          id: `in_it_${tag}_0`,
          object: "invoice",
          customer: `cus_it_${tag}`,
          currency: "usd",
          amount_paid: 0,
          amount_due: 0,
          parent: { subscription_details: { subscription: subId } },
        }),
      );
      expect(res.body).toMatchObject({ result: "ignored_zero" });
    });

    it("deleted → canceled y sin Premium; un 'updated' viejo que llega tarde no la revive", async () => {
      const deleted = await sendStripe(
        stripeEvent("customer.subscription.deleted", stripeSubscription({ status: "canceled", trial_end: null, canceled_at: unix(new Date().toISOString()) })),
      );
      expect(deleted.status).toBe(200);
      expect(await isPremium(ana)).toBe(false);

      const late = await sendStripe(stripeEvent("customer.subscription.updated", stripeSubscription({ status: "active", trial_end: null })));
      expect(late.status).toBe(200);
      const { data } = await admin.from("subscriptions").select("status, canceled_at").eq("provider_subscription_id", subId).single();
      expect(data!.status).toBe("canceled");
      expect(data!.canceled_at).not.toBeNull();
      expect(await isPremium(ana)).toBe(false);
    });
  });

  describe("rutas de la persona sin claves de proveedor", () => {
    it("checkout: 401 sin sesión, 400 cuerpo inválido, 503 sin claves (Stripe y Mercado Pago)", async () => {
      const { data: prices } = await admin.from("plan_prices").select("id, currency_code, interval").eq("plan_id", "premium").eq("is_active", true);
      const pen = prices!.find((p) => p.currency_code === "PEN" && p.interval === "month")!;
      const usd = prices!.find((p) => p.currency_code === "USD" && p.interval === "month")!;

      as(null);
      expect((await post(r.checkout.POST, "/api/billing/checkout", { priceId: pen.id, provider: "mercadopago" })).status).toBe(401);

      as(beto);
      const bad = await post(r.checkout.POST, "/api/billing/checkout", { priceId: "no-es-uuid", provider: "paypal" });
      expect(bad.status).toBe(400);

      const mp = await post(r.checkout.POST, "/api/billing/checkout", { priceId: pen.id, provider: "mercadopago" });
      expect(mp.status).toBe(503);
      expect(mp.body.error?.code).toBe("BILLING_NOT_CONFIGURED");
      expect(mp.body).not.toHaveProperty("url");

      const st = await post(r.checkout.POST, "/api/billing/checkout", { priceId: usd.id, provider: "stripe" });
      expect(st.status).toBe(503);
      expect(st.body.error?.code).toBe("BILLING_NOT_CONFIGURED");
    });

    it("checkout desde otro origen → 403", async () => {
      as(beto);
      const res = await post(r.checkout.POST, "/api/billing/checkout", { priceId: randomUUID(), provider: "stripe" }, { origin: "https://malicioso.example" });
      expect(res.status).toBe(403);
    });

    it("cancelar y portal: 404 sin suscripción; 503 con suscripción de Stripe pero sin claves", async () => {
      as(beto);
      expect((await post(r.cancel.POST, "/api/billing/cancel", {})).body.error?.code).toBe("NO_ACTIVE_SUBSCRIPTION");
      expect((await post(r.portal.POST, "/api/billing/portal", {})).status).toBe(404);

      const { error } = await admin.from("subscriptions").insert({
        user_id: beto.id,
        plan_id: "premium",
        provider: "stripe",
        provider_subscription_id: `sub_it_${tag}_beto`,
        provider_customer_id: `cus_it_${tag}_beto`,
        status: "active",
        current_period_end: inDays(20),
      });
      if (error) throw error;
      const cancel = await post(r.cancel.POST, "/api/billing/cancel", {});
      expect(cancel.status).toBe(503);
      expect(cancel.body.error?.code).toBe("BILLING_NOT_CONFIGURED");
      expect((await post(r.portal.POST, "/api/billing/portal", {})).status).toBe(503);
      // Nada cambió: sigue activa y sin cancelación programada.
      const { data } = await admin.from("subscriptions").select("status, cancel_at_period_end").eq("user_id", beto.id).single();
      expect(data).toEqual({ status: "active", cancel_at_period_end: false });

      // Y ya no puede iniciar otro checkout… pero el 503 de "sin claves" se informa primero.
      const { data: prices } = await admin.from("plan_prices").select("id").eq("plan_id", "premium").eq("currency_code", "PEN").eq("interval", "year").eq("is_active", true);
      expect((await post(r.checkout.POST, "/api/billing/checkout", { priceId: prices![0]!.id, provider: "mercadopago" })).status).toBe(503);
    });

    it("confirm: lee el estado real (confirmado con acceso, pendiente sin suscripción)", async () => {
      as(beto);
      const okRes = await post(r.confirm.POST, "/api/billing/confirm", { sessionId: "cs_test_abcdefghij" });
      expect(okRes.status).toBe(200);
      expect(okRes.body).toMatchObject({ state: "confirmed" });

      const carla = await createSessionUser("carla");
      users.push(carla);
      as(carla);
      const pending = await post(r.confirm.POST, "/api/billing/confirm", {});
      expect(pending.body).toMatchObject({ state: "pending", label: null });
      expect((await post(r.confirm.POST, "/api/billing/confirm", { sessionId: "no válido" })).status).toBe(400);
    });
  });

  describe("webhook de Mercado Pago (firma real, API simulada)", () => {
    const SECRET = "mp-it-secret";
    const preapprovalId = `2c9380847${tag}`;
    const apId = `7${Date.now()}`;
    // Ids de notificación únicos por corrida (la idempotencia es por id).
    const base = Date.now() * 100;

    function signed(dataId: string, type: string, n: number, secret = SECRET) {
      const notificationId = base + n;
      const requestId = randomUUID();
      const ts = String(Math.floor(Date.now() / 1000));
      const manifest = r.mp.signatureManifest(dataId, requestId, ts);
      const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
      eventIds.push({ provider: "mercadopago", id: String(notificationId) });
      return new Request(`http://localhost:3000/api/billing/webhooks/mercadopago?data.id=${dataId}&type=${type}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId },
        body: JSON.stringify({ id: notificationId, type, action: "updated", data: { id: dataId } }),
      });
    }

    function fakeMp(resources: Record<string, unknown>) {
      const calls: string[] = [];
      const client = {
        accessToken: "TEST",
        fetch: async (url: string, init?: RequestInit) => {
          calls.push(`${init?.method ?? "GET"} ${url.replace(r.mp.MERCADOPAGO_API, "")}`);
          const path = url.replace(r.mp.MERCADOPAGO_API, "");
          const body = resources[path];
          return body ? new Response(JSON.stringify(body), { status: 200 }) : new Response("{}", { status: 404 });
        },
      };
      return { client, calls };
    }

    it("firma inválida → 400 (ruta real, sin tocar la BD)", async () => {
      const res = await r.mpWebhook.POST(signed(preapprovalId, "subscription_preapproval", 1, "otro"));
      // Sin MERCADOPAGO_WEBHOOK_SECRET en el entorno la ruta responde 503 antes de mirar la firma.
      expect(res.status).toBe(503);
      const direct = await r.mp.handleMercadoPagoWebhook(signed(preapprovalId, "subscription_preapproval", 2, "otro"), {
        webhookSecret: SECRET,
        admin,
        client: fakeMp({}).client,
      });
      expect(direct.status).toBe(400);
    });

    it("preaprobación autorizada → suscripción activa con el precio en soles; cobro procesado → payments; sin duplicar", async () => {
      const { data: penMonth } = await admin.from("plan_prices").select("id").eq("plan_id", "premium").eq("currency_code", "PEN").eq("interval", "month").eq("is_active", true).single();
      const carla = users.find((u) => u.email.includes("carla"))!;
      const resources = {
        [`/preapproval/${preapprovalId}`]: {
          id: preapprovalId,
          status: "authorized",
          external_reference: carla.id,
          payer_id: 987654,
          date_created: new Date().toISOString(),
          next_payment_date: inDays(30),
          auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 29.9, currency_id: "PEN", start_date: new Date().toISOString() },
          summarized: { charged_quantity: 1, last_charged_date: new Date().toISOString() },
        },
        [`/authorized_payments/${apId}`]: {
          id: Number(apId),
          preapproval_id: preapprovalId,
          status: "processed",
          transaction_amount: 29.9,
          currency_id: "PEN",
          last_modified: new Date().toISOString(),
          payment: { id: 1, status: "approved" },
        },
      };
      const { client, calls } = fakeMp(resources);
      const deps = { webhookSecret: SECRET, admin, client };

      const res = await r.mp.handleMercadoPagoWebhook(signed(preapprovalId, "subscription_preapproval", 10), deps);
      expect(res.status).toBe(200);
      expect(calls).toContain(`GET /preapproval/${preapprovalId}`);
      const { data: sub } = await admin.from("subscriptions").select("*").eq("provider_subscription_id", preapprovalId).single();
      expect(sub).toMatchObject({ user_id: carla.id, provider: "mercadopago", status: "active", price_id: penMonth!.id, provider_customer_id: "987654" });
      expect(await isPremium(carla)).toBe(true);

      // Misma notificación otra vez: no se consulta ni se escribe de nuevo.
      const before = calls.length;
      const dup = await r.mp.handleMercadoPagoWebhook(signed(preapprovalId, "subscription_preapproval", 10), deps);
      expect(await dup.json()).toMatchObject({ duplicate: true });
      expect(calls.length).toBe(before);

      const pay = await r.mp.handleMercadoPagoWebhook(signed(apId, "subscription_authorized_payment", 11), deps);
      expect(pay.status).toBe(200);
      const { data: payments } = await carla.client.from("payments").select("provider, provider_payment_id, amount_cents, currency_code, status");
      expect(payments).toEqual([{ provider: "mercadopago", provider_payment_id: apId, amount_cents: 2990, currency_code: "PEN", status: "succeeded" }]);
    });

    it("una preaprobación con external_reference ajeno o inexistente no crea nada", async () => {
      const otherId = `2c9380848${tag}`;
      const { client } = fakeMp({
        [`/preapproval/${otherId}`]: { id: otherId, status: "authorized", external_reference: randomUUID(), auto_recurring: { transaction_amount: 29.9, currency_id: "PEN" } },
      });
      const res = await r.mp.handleMercadoPagoWebhook(signed(otherId, "subscription_preapproval", 20), { webhookSecret: SECRET, admin, client });
      expect(await res.json()).toMatchObject({ result: "unmatched" });
      const { data } = await admin.from("subscriptions").select("id").eq("provider_subscription_id", otherId);
      expect(data).toEqual([]);
    });
  });
});
