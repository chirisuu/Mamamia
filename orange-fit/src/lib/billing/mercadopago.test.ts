/**
 * Mercado Pago sin red: la API no es accesible desde este contenedor, así que se prueba con un
 * `fetch` simulado (qué se envía, cómo se interpreta la respuesta) y la firma con HMAC real.
 */
import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  buildPreapprovalBody,
  cancelMercadoPagoSubscription,
  createMercadoPagoCheckout,
  handleMercadoPagoWebhook,
  MERCADOPAGO_API,
  MERCADOPAGO_SIGNATURE_TOLERANCE_SECONDS,
  parseSignatureHeader,
  signatureManifest,
  verifyMercadoPagoSignature,
  type MercadoPagoClient,
} from "./mercadopago";
import type { CheckoutInput } from "./provider";
import type { PlanPriceRow, SubscriptionRow } from "./types";

const SECRET = "mp-webhook-secret-de-prueba";
const NOW = new Date("2026-10-13T15:00:00Z");
const TS = String(Math.floor(NOW.getTime() / 1000));

function sign(dataId: string | null, requestId: string | null, ts: string, secret = SECRET) {
  const manifest = signatureManifest(dataId, requestId, ts);
  return `ts=${ts},v1=${createHmac("sha256", secret).update(manifest).digest("hex")}`;
}

describe("firma x-signature", () => {
  it("arma el manifiesto como lo documenta Mercado Pago (id alfanumérico en minúsculas)", () => {
    expect(signatureManifest("ABC123", "req-1", "1700000000")).toBe("id:abc123;request-id:req-1;ts:1700000000;");
    expect(signatureManifest(null, null, "1700000000")).toBe("ts:1700000000;");
    expect(parseSignatureHeader("ts=1,v1=abc")).toEqual({ ts: "1", v1: "abc" });
    expect(parseSignatureHeader("v1=abc")).toBeNull();
  });

  it("válida", () => {
    const header = sign("123456", "req-1", TS);
    expect(verifyMercadoPagoSignature({ signatureHeader: header, requestId: "req-1", dataId: "123456", secret: SECRET, now: NOW })).toEqual({ ok: true });
  });

  it("acepta ts en milisegundos", () => {
    const tsMs = String(NOW.getTime());
    const header = sign("123456", "req-1", tsMs);
    expect(verifyMercadoPagoSignature({ signatureHeader: header, requestId: "req-1", dataId: "123456", secret: SECRET, now: NOW }).ok).toBe(true);
  });

  it("inválida: otro secreto, otro id, otro request-id o firma alterada", () => {
    const good = sign("123456", "req-1", TS);
    const base = { requestId: "req-1", dataId: "123456", secret: SECRET, now: NOW };
    expect(verifyMercadoPagoSignature({ ...base, signatureHeader: sign("123456", "req-1", TS, "otro") })).toEqual({ ok: false, reason: "mismatch" });
    expect(verifyMercadoPagoSignature({ ...base, signatureHeader: good, dataId: "999" })).toEqual({ ok: false, reason: "mismatch" });
    expect(verifyMercadoPagoSignature({ ...base, signatureHeader: good, requestId: "req-2" })).toEqual({ ok: false, reason: "mismatch" });
    const tampered = good.replace(/v1=(.)/, (_, c: string) => `v1=${c === "a" ? "b" : "a"}`);
    expect(verifyMercadoPagoSignature({ ...base, signatureHeader: tampered })).toEqual({ ok: false, reason: "mismatch" });
  });

  it("vieja: fuera de la ventana de tolerancia (aunque la firma cuadre)", () => {
    const oldTs = String(Math.floor(NOW.getTime() / 1000) - MERCADOPAGO_SIGNATURE_TOLERANCE_SECONDS - 60);
    const header = sign("123456", "req-1", oldTs);
    expect(verifyMercadoPagoSignature({ signatureHeader: header, requestId: "req-1", dataId: "123456", secret: SECRET, now: NOW })).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("ausente o mal formada", () => {
    const base = { requestId: "req-1", dataId: "123456", secret: SECRET, now: NOW };
    expect(verifyMercadoPagoSignature({ ...base, signatureHeader: null })).toEqual({ ok: false, reason: "missing" });
    expect(verifyMercadoPagoSignature({ ...base, signatureHeader: "ts=abc,v1=zz" })).toEqual({ ok: false, reason: "malformed" });
  });
});

const price: PlanPriceRow = {
  id: "bbe4f3de-b23f-4bcb-9d1e-5eb55c264ad3",
  plan_id: "premium",
  interval: "year",
  currency_code: "PEN",
  amount_cents: 19990,
  trial_days: 7,
  stripe_price_id: null,
  mercadopago_plan_id: null,
  is_active: true,
  created_at: "2026-10-13T00:00:00Z",
  updated_at: "2026-10-13T00:00:00Z",
};

const input: CheckoutInput = {
  user: { id: "0b5a7c1e-1f2a-4c3b-8d4e-5f6a7b8c9d0e", email: "ana@example.com" },
  price,
  planName: "Premium",
  appName: "ORANGE FIT",
  trialDays: 7,
  customerId: null,
  successUrl: "https://app.example.com/app/premium/gracias?provider=mercadopago",
  cancelUrl: "https://app.example.com/app/premium?cancelado=1",
};

function fakeClient(response: { status?: number; body: unknown }) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(response.body), { status: response.status ?? 200 }));
  const client: MercadoPagoClient = { accessToken: "TEST-token", fetch };
  return { client, fetch };
}

describe("checkout con /preapproval", () => {
  it("anual = cada 12 meses en soles, con prueba, external_reference = user_id", () => {
    const body = buildPreapprovalBody(input);
    expect(body).toMatchObject({
      external_reference: input.user.id,
      payer_email: "ana@example.com",
      back_url: input.successUrl,
      status: "pending",
      auto_recurring: {
        frequency: 12,
        frequency_type: "months",
        transaction_amount: 199.9,
        currency_id: "PEN",
        free_trial: { frequency: 7, frequency_type: "days" },
      },
    });
    expect(body.reason).toContain("anual");
  });

  it("mensual sin prueba no envía free_trial", () => {
    const body = buildPreapprovalBody({ ...input, trialDays: 0, price: { ...price, interval: "month", amount_cents: 2990 } });
    expect(body.auto_recurring).toEqual({ frequency: 1, frequency_type: "months", transaction_amount: 29.9, currency_id: "PEN" });
  });

  it("rechaza otras monedas y cuentas sin correo", () => {
    expect(() => buildPreapprovalBody({ ...input, price: { ...price, currency_code: "USD" } })).toThrow(/soles/);
    expect(() => buildPreapprovalBody({ ...input, user: { ...input.user, email: null } })).toThrow(/correo/);
  });

  it("POST /preapproval con token e idempotencia → init_point", async () => {
    const { client, fetch } = fakeClient({ status: 201, body: { id: "pre_123", init_point: "https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_id=pre_123" } });
    const session = await createMercadoPagoCheckout(input, client);
    expect(session).toEqual({ url: "https://www.mercadopago.com.pe/subscriptions/checkout?preapproval_id=pre_123", providerReference: "pre_123" });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${MERCADOPAGO_API}/preapproval`);
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer TEST-token");
    expect(headers["X-Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(String(init.body))).toMatchObject({ external_reference: input.user.id });
  });

  it("sin init_point o con error del proveedor → error real (502/503), nunca un éxito", async () => {
    await expect(createMercadoPagoCheckout(input, fakeClient({ body: { id: "x" } }).client)).rejects.toMatchObject({ status: 502, code: "PROVIDER_ERROR" });
    await expect(createMercadoPagoCheckout(input, fakeClient({ status: 401, body: {} }).client)).rejects.toMatchObject({
      status: 503,
      code: "BILLING_NOT_CONFIGURED",
    });
    await expect(createMercadoPagoCheckout(input, fakeClient({ status: 500, body: {} }).client)).rejects.toMatchObject({ status: 502 });
  });
});

describe("cancelar con PUT /preapproval/{id}", () => {
  const sub: SubscriptionRow = {
    id: "8f0c2c1e-6a1d-4b2e-9c3f-0a1b2c3d4e5f",
    user_id: input.user.id,
    plan_id: "premium",
    price_id: price.id,
    provider: "mercadopago",
    provider_customer_id: "123",
    provider_subscription_id: "pre_123",
    status: "active",
    current_period_start: "2026-10-13T15:00:00Z",
    current_period_end: "2099-11-13T15:00:00.000Z",
    trial_end: null,
    cancel_at_period_end: false,
    canceled_at: null,
    created_at: "2026-10-13T15:00:00Z",
    updated_at: "2026-10-13T15:00:00Z",
  };

  it("envía status cancelled y conserva el acceso pagado con cancel_at_period_end", async () => {
    const { client, fetch } = fakeClient({ body: { id: "pre_123", status: "cancelled", last_modified: "2026-10-13T16:00:00Z" } });
    const snap = await cancelMercadoPagoSubscription(sub, client);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${MERCADOPAGO_API}/preapproval/pre_123`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ status: "cancelled" });
    expect(snap).toMatchObject({ status: "active", cancelAtPeriodEnd: true, currentPeriodEnd: "2099-11-13T15:00:00.000Z", userId: sub.user_id });
  });
});

describe("webhook (antes de tocar la BD)", () => {
  const url = "https://app.example.com/api/billing/webhooks/mercadopago?data.id=123456&type=subscription_preapproval";

  it("sin secreto configurado → 503", async () => {
    const res = await handleMercadoPagoWebhook(new Request(url, { method: "POST", body: "{}" }), { webhookSecret: undefined });
    expect(res.status).toBe(503);
  });

  it("firma inválida → 400", async () => {
    const res = await handleMercadoPagoWebhook(
      new Request(url, {
        method: "POST",
        headers: { "x-signature": sign("123456", "req-1", TS, "otro-secreto"), "x-request-id": "req-1" },
        body: JSON.stringify({ id: 1, type: "subscription_preapproval", data: { id: "123456" } }),
      }),
      { webhookSecret: SECRET, now: NOW },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: { code: "INVALID_SIGNATURE", message: expect.any(String) } });
  });

  it("firma vieja → 400", async () => {
    const oldTs = String(Math.floor(NOW.getTime() / 1000) - 2 * MERCADOPAGO_SIGNATURE_TOLERANCE_SECONDS);
    const res = await handleMercadoPagoWebhook(
      new Request(url, { method: "POST", headers: { "x-signature": sign("123456", "req-1", oldTs), "x-request-id": "req-1" }, body: "{}" }),
      { webhookSecret: SECRET, now: NOW },
    );
    expect(res.status).toBe(400);
  });

  it("id del cuerpo distinto al firmado en la URL → 400", async () => {
    const res = await handleMercadoPagoWebhook(
      new Request(url, {
        method: "POST",
        headers: { "x-signature": sign("123456", "req-1", TS), "x-request-id": "req-1" },
        body: JSON.stringify({ id: 1, type: "subscription_preapproval", data: { id: "999999" } }),
      }),
      { webhookSecret: SECRET, now: NOW },
    );
    expect(res.status).toBe(400);
  });
});
