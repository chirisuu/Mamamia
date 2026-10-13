import { describe, expect, it } from "vitest";
import { amountToCents, annualSavings, centsToAmount, currenciesFor, findPrice, priceForProvider, priceSupportsProvider, trialDaysFor } from "./pricing";

describe("annualSavings", () => {
  it("precios semilla en soles: S/ 29.90/mes vs S/ 199.90/año", () => {
    expect(annualSavings(2990, 19990)).toEqual({
      twelveMonthsCents: 35880,
      savedCents: 15890,
      percent: 44, // 44.28 % → hacia abajo, para no exagerar
      monthlyEquivalentCents: 1666,
    });
  });

  it("precios semilla en dólares: US$ 7.99/mes vs US$ 54.99/año", () => {
    const s = annualSavings(799, 5499)!;
    expect(s.savedCents).toBe(4089);
    expect(s.percent).toBe(42);
    expect(s.monthlyEquivalentCents).toBe(458);
  });

  it("si el anual no es más barato, el ahorro es 0 (nunca negativo)", () => {
    expect(annualSavings(1000, 12000)).toMatchObject({ savedCents: 0, percent: 0 });
    expect(annualSavings(1000, 15000)).toMatchObject({ savedCents: 0, percent: 0 });
  });

  it("datos sin sentido → null (no se muestran cifras falsas)", () => {
    expect(annualSavings(0, 19990)).toBeNull();
    expect(annualSavings(2990, -1)).toBeNull();
    expect(annualSavings(Number.NaN, 19990)).toBeNull();
  });
});

describe("trialDaysFor", () => {
  it("usa los días del precio, o los globales si el precio no define", () => {
    expect(trialDaysFor({ trial_days: 14 }, 7, true)).toBe(14);
    expect(trialDaysFor({ trial_days: 0 }, 7, true)).toBe(7);
  });
  it("sin elegibilidad (ya tuvo Premium) no hay prueba", () => {
    expect(trialDaysFor({ trial_days: 14 }, 7, false)).toBe(0);
  });
  it("valores raros no generan prueba", () => {
    expect(trialDaysFor({ trial_days: 0 }, 0, true)).toBe(0);
    expect(trialDaysFor({ trial_days: 0 }, Number.NaN, true)).toBe(0);
  });
});

describe("precios por proveedor", () => {
  const prices = [
    { id: "pm", plan_id: "premium", interval: "month" as const, currency_code: "PEN", amount_cents: 2990, is_active: true, stripe_price_id: null },
    { id: "py", plan_id: "premium", interval: "year" as const, currency_code: "PEN", amount_cents: 19990, is_active: true, stripe_price_id: "price_pen_y" },
    { id: "um", plan_id: "premium", interval: "month" as const, currency_code: "USD", amount_cents: 799, is_active: true, stripe_price_id: "price_usd_m" },
    { id: "uy", plan_id: "premium", interval: "year" as const, currency_code: "USD", amount_cents: 5499, is_active: false, stripe_price_id: "price_usd_y" },
  ];

  it("Mercado Pago solo en soles; Stripe solo con stripe_price_id", () => {
    expect(priceSupportsProvider(prices[0]!, "mercadopago")).toBe(true);
    expect(priceSupportsProvider(prices[2]!, "mercadopago")).toBe(false);
    expect(priceSupportsProvider(prices[0]!, "stripe")).toBe(false);
    expect(priceSupportsProvider(prices[2]!, "stripe")).toBe(true);
  });

  it("priceForProvider elige USD para Stripe y PEN para Mercado Pago; ignora inactivos", () => {
    expect(priceForProvider(prices, "premium", "month", "stripe")?.id).toBe("um");
    expect(priceForProvider(prices, "premium", "month", "mercadopago")?.id).toBe("pm");
    // El anual en USD está inactivo: Stripe cae al anual en soles que sí tiene precio en Stripe.
    expect(priceForProvider(prices, "premium", "year", "stripe")?.id).toBe("py");
  });

  it("findPrice y currenciesFor", () => {
    expect(findPrice(prices, { planId: "premium", interval: "year", currency: "usd" })).toBeNull();
    expect(findPrice(prices, { planId: "premium", interval: "month", currency: "usd" })?.id).toBe("um");
    expect(currenciesFor(prices, "premium")).toEqual(["PEN", "USD"]);
  });

  it("montos de Mercado Pago (unidades) ↔ céntimos", () => {
    expect(centsToAmount(2990)).toBe(29.9);
    expect(amountToCents(29.9)).toBe(2990);
    expect(amountToCents(199.9)).toBe(19990);
  });
});
