import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { handleStripeWebhook, stripeSubscriptionSnapshot } from "./stripe";

const SECRET = "whsec_unit_test_secret";
const t = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

function subscription(over: Partial<Record<string, unknown>> = {}): Stripe.Subscription {
  return {
    id: "sub_123",
    object: "subscription",
    customer: "cus_123",
    status: "trialing",
    cancel_at_period_end: false,
    cancel_at: null,
    canceled_at: null,
    trial_end: t("2026-10-20T15:00:00Z"),
    metadata: { user_id: "0b5a7c1e-1f2a-4c3b-8d4e-5f6a7b8c9d0e" },
    items: {
      object: "list",
      data: [
        {
          id: "si_1",
          price: { id: "price_usd_m" },
          current_period_start: t("2026-10-13T15:00:00Z"),
          current_period_end: t("2026-10-20T15:00:00Z"),
        },
      ],
    },
    ...over,
  } as unknown as Stripe.Subscription;
}

describe("stripeSubscriptionSnapshot", () => {
  const ctx = { userId: "0b5a7c1e-1f2a-4c3b-8d4e-5f6a7b8c9d0e", planId: "premium", priceId: null };

  it("toma el periodo del ítem (API nueva), la prueba y el cliente", () => {
    expect(stripeSubscriptionSnapshot(subscription(), ctx)).toEqual({
      ...ctx,
      provider: "stripe",
      providerSubscriptionId: "sub_123",
      providerCustomerId: "cus_123",
      status: "trialing",
      currentPeriodStart: "2026-10-13T15:00:00.000Z",
      currentPeriodEnd: "2026-10-20T15:00:00.000Z",
      trialEnd: "2026-10-20T15:00:00.000Z",
      cancelAtPeriodEnd: false,
      canceledAt: null,
    });
  });

  it("cancelación programada por cancel_at_period_end o por fecha cancel_at", () => {
    expect(stripeSubscriptionSnapshot(subscription({ status: "active", cancel_at_period_end: true }), ctx).cancelAtPeriodEnd).toBe(true);
    expect(stripeSubscriptionSnapshot(subscription({ status: "active", cancel_at: t("2026-11-13T15:00:00Z") }), ctx).cancelAtPeriodEnd).toBe(true);
  });

  it("cancelada: canceled_at y sin 'no se renovará'", () => {
    const snap = stripeSubscriptionSnapshot(subscription({ status: "canceled", cancel_at_period_end: true, canceled_at: t("2026-10-14T00:00:00Z") }), ctx);
    expect(snap).toMatchObject({ status: "canceled", cancelAtPeriodEnd: false, canceledAt: "2026-10-14T00:00:00.000Z" });
  });

  it("estados de Stripe sin acceso (unpaid, incomplete_expired)", () => {
    expect(stripeSubscriptionSnapshot(subscription({ status: "unpaid" }), ctx).status).toBe("past_due");
    expect(stripeSubscriptionSnapshot(subscription({ status: "incomplete_expired" }), ctx).status).toBe("expired");
  });
});

describe("webhook de Stripe (antes de tocar la BD)", () => {
  const payload = JSON.stringify({ id: "evt_1", object: "event", type: "customer.subscription.created", data: { object: subscription() } });
  const url = "https://app.example.com/api/billing/webhooks/stripe";

  it("sin secreto → 503", async () => {
    const res = await handleStripeWebhook(new Request(url, { method: "POST", body: payload }), { webhookSecret: undefined });
    expect(res.status).toBe(503);
  });

  it("sin cabecera de firma → 400", async () => {
    const res = await handleStripeWebhook(new Request(url, { method: "POST", body: payload }), { webhookSecret: SECRET });
    expect(res.status).toBe(400);
  });

  it("firma con otro secreto → 400 INVALID_SIGNATURE", async () => {
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_otro" });
    const res = await handleStripeWebhook(new Request(url, { method: "POST", headers: { "stripe-signature": header }, body: payload }), {
      webhookSecret: SECRET,
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("INVALID_SIGNATURE");
  });

  it("cuerpo alterado después de firmar → 400", async () => {
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    const res = await handleStripeWebhook(
      new Request(url, { method: "POST", headers: { "stripe-signature": header }, body: payload.replace("trialing", "active") }),
      { webhookSecret: SECRET },
    );
    expect(res.status).toBe(400);
  });
});
