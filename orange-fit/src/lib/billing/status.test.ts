import { describe, expect, it } from "vitest";
import {
  blocksNewCheckout,
  describeSubscription,
  isTrialEligible,
  mapMercadoPagoPaymentStatus,
  mapMercadoPagoPreapproval,
  mapStripeStatus,
  pickCurrentSubscription,
  preapprovalTrialEnd,
  type MercadoPagoPreapproval,
} from "./status";

const NOW = new Date("2026-10-13T15:00:00Z");
const FUTURE = "2026-11-13T15:00:00.000Z";
const PAST = "2026-10-01T15:00:00.000Z";

describe("mapStripeStatus", () => {
  it.each([
    ["trialing", "trialing"],
    ["active", "active"],
    ["past_due", "past_due"],
    ["unpaid", "past_due"],
    ["canceled", "canceled"],
    ["incomplete", "incomplete"],
    ["incomplete_expired", "expired"],
    ["paused", "paused"],
  ] as const)("%s → %s", (stripe, ours) => {
    expect(mapStripeStatus(stripe)).toBe(ours);
  });

  it("un estado desconocido no da acceso", () => {
    expect(mapStripeStatus("algo_nuevo")).toBe("incomplete");
  });
});

describe("mapMercadoPagoPreapproval", () => {
  const base: MercadoPagoPreapproval = {
    id: "2c938084726fca480172750000000000",
    status: "authorized",
    date_created: "2026-10-13T10:00:00.000-05:00",
    next_payment_date: FUTURE,
    auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 29.9, currency_id: "PEN", start_date: "2026-10-13T15:00:00Z" },
    summarized: { charged_quantity: 1, last_charged_date: "2026-10-13T15:00:00Z" },
  };

  it("authorized con cobro → active con fin de periodo = próximo cobro", () => {
    const m = mapMercadoPagoPreapproval(base, null, NOW);
    expect(m.status).toBe("active");
    expect(m.currentPeriodEnd).toBe(FUTURE);
    expect(m.cancelAtPeriodEnd).toBe(false);
  });

  it("authorized en prueba sin cobros → trialing con fin de prueba", () => {
    const pre = { ...base, summarized: { charged_quantity: 0 }, auto_recurring: { ...base.auto_recurring, free_trial: { frequency: 7, frequency_type: "days" } } };
    const m = mapMercadoPagoPreapproval(pre, null, NOW);
    expect(m.status).toBe("trialing");
    expect(m.trialEnd).toBe("2026-10-20T15:00:00.000Z");
    expect(preapprovalTrialEnd(pre)).toBe("2026-10-20T15:00:00.000Z");
  });

  it("pending → incomplete (sin acceso); paused → paused; finished → expired", () => {
    expect(mapMercadoPagoPreapproval({ ...base, status: "pending" }, null, NOW).status).toBe("incomplete");
    expect(mapMercadoPagoPreapproval({ ...base, status: "paused" }, null, NOW).status).toBe("paused");
    expect(mapMercadoPagoPreapproval({ ...base, status: "finished" }, null, NOW).status).toBe("expired");
  });

  it("cancelled con periodo pagado vigente conserva el acceso hasta esa fecha", () => {
    const m = mapMercadoPagoPreapproval(
      { ...base, status: "cancelled", next_payment_date: null, last_modified: "2026-10-13T14:00:00Z" },
      { status: "active", currentPeriodEnd: FUTURE, trialEnd: null },
      NOW,
    );
    expect(m.status).toBe("active");
    expect(m.cancelAtPeriodEnd).toBe(true);
    expect(m.currentPeriodEnd).toBe(FUTURE);
    expect(m.canceledAt).toBe("2026-10-13T14:00:00.000Z");
  });

  it("cancelled sin periodo vigente → canceled", () => {
    const m = mapMercadoPagoPreapproval({ ...base, status: "cancelled", next_payment_date: PAST }, { status: "active", currentPeriodEnd: PAST, trialEnd: null }, NOW);
    expect(m.status).toBe("canceled");
    expect(m.cancelAtPeriodEnd).toBe(false);
  });

  it("estado desconocido no da acceso", () => {
    expect(mapMercadoPagoPreapproval({ ...base, status: "raro" }, null, NOW).status).toBe("incomplete");
  });
});

describe("mapMercadoPagoPaymentStatus", () => {
  it.each([
    ["approved", "succeeded"],
    ["processed", "succeeded"],
    ["refunded", "refunded"],
    ["charged_back", "refunded"],
    ["rejected", "failed"],
    ["cancelled", "failed"],
    ["in_process", "pending"],
    [null, "pending"],
  ] as const)("%s → %s", (mp, ours) => {
    expect(mapMercadoPagoPaymentStatus(mp)).toBe(ours);
  });
});

describe("describeSubscription (mismo criterio que is_premium)", () => {
  it("prueba vigente: acceso, próximo cobro al terminar la prueba y se puede cancelar", () => {
    const v = describeSubscription({ status: "trialing", trial_end: FUTURE, current_period_end: FUTURE, cancel_at_period_end: false }, NOW);
    expect(v).toMatchObject({ hasAccess: true, trialEndsAt: FUTURE, nextChargeAt: FUTURE, canCancel: true });
  });

  it("activa cancelada al final del periodo: acceso hasta esa fecha, sin próximo cobro", () => {
    const v = describeSubscription({ status: "active", trial_end: null, current_period_end: FUTURE, cancel_at_period_end: true }, NOW);
    expect(v).toMatchObject({ hasAccess: true, accessEndsAt: FUTURE, nextChargeAt: null, canCancel: false });
  });

  it("activa con el periodo vencido: sin acceso (no inventa un 'activa')", () => {
    const v = describeSubscription({ status: "active", trial_end: null, current_period_end: PAST, cancel_at_period_end: false }, NOW);
    expect(v.hasAccess).toBe(false);
  });

  it("past_due: sin acceso, se puede cancelar; canceled/expired/incomplete: sin acceso", () => {
    expect(describeSubscription({ status: "past_due", trial_end: null, current_period_end: FUTURE, cancel_at_period_end: false }, NOW)).toMatchObject({
      hasAccess: false,
      canCancel: true,
      tone: "warning",
    });
    for (const status of ["canceled", "expired", "incomplete", "paused"] as const) {
      expect(describeSubscription({ status, trial_end: null, current_period_end: FUTURE, cancel_at_period_end: false }, NOW).hasAccess).toBe(false);
    }
  });
});

describe("pickCurrentSubscription / blocksNewCheckout / isTrialEligible", () => {
  const old = { status: "canceled" as const, trial_end: null, current_period_end: PAST, cancel_at_period_end: false, created_at: "2026-10-12T00:00:00Z" };
  const live = { status: "active" as const, trial_end: null, current_period_end: FUTURE, cancel_at_period_end: false, created_at: "2026-09-01T00:00:00Z" };
  const abandoned = { status: "incomplete" as const, trial_end: null, current_period_end: null, cancel_at_period_end: false, created_at: "2026-10-13T00:00:00Z" };

  it("prefiere la que da acceso aunque haya otras más nuevas", () => {
    expect(pickCurrentSubscription([abandoned, old, live], NOW)).toBe(live);
    expect(pickCurrentSubscription([old, abandoned], NOW)).toBe(abandoned);
    expect(pickCurrentSubscription([], NOW)).toBeNull();
  });

  it("bloquea un checkout nuevo si ya tiene acceso o un cobro pendiente", () => {
    expect(blocksNewCheckout(live, NOW)).toBe(true);
    expect(blocksNewCheckout({ ...live, status: "past_due" }, NOW)).toBe(true);
    expect(blocksNewCheckout(old, NOW)).toBe(false);
    expect(blocksNewCheckout(abandoned, NOW)).toBe(false);
  });

  it("la prueba es solo para quien nunca tuvo Premium", () => {
    expect(isTrialEligible([], false)).toBe(true);
    expect(isTrialEligible([abandoned], false)).toBe(true);
    expect(isTrialEligible([old], false)).toBe(false);
    expect(isTrialEligible([{ status: "expired", trial_end: PAST }], false)).toBe(false);
    expect(isTrialEligible([], true)).toBe(false);
  });
});
