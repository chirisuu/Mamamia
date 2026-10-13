import { describe, expect, it } from "vitest";
import type { PlanPriceRow, PlanRow } from "@/lib/billing/types";
import { providerAvailability } from "@/lib/billing/catalog";
import { buildCatalogView, optionForProvider, primaryCurrency, savingsFor } from "./catalog-view";
import { aiLimitLines, featureLabel } from "./labels";

const plan = (id: string, features: string[], limits: Record<string, number>): PlanRow => ({
  id,
  name: id === "free" ? "Gratis" : "Premium",
  description: null,
  features,
  ai_monthly_limits: limits,
  is_active: true,
  sort_order: id === "free" ? 0 : 1,
  created_at: "2026-10-13T00:00:00Z",
  updated_at: "2026-10-13T00:00:00Z",
});

const price = (id: string, interval: "month" | "year", currency: string, cents: number, stripe: string | null = null): PlanPriceRow => ({
  id,
  plan_id: "premium",
  interval,
  currency_code: currency,
  amount_cents: cents,
  trial_days: 7,
  stripe_price_id: stripe,
  mercadopago_plan_id: null,
  is_active: true,
  created_at: "2026-10-13T00:00:00Z",
  updated_at: "2026-10-13T00:00:00Z",
});

const catalog = {
  plans: [
    plan("free", ["manual_logging", "macros", "desconocida"], { photo: 0 }),
    plan("premium", ["manual_logging", "macros", "ai_photo", "meal_plans"], { photo: 120, chat: 400 }),
  ],
  prices: [price("pm", "month", "PEN", 2990), price("py", "year", "PEN", 19990), price("um", "month", "USD", 799, "price_um")],
};

describe("buildCatalogView", () => {
  const view = buildCatalogView(catalog, 7);

  it("solo muestra funciones con nombre conocido y marca las de pago", () => {
    expect(view.free?.features.map((f) => f.code)).toEqual(["manual_logging", "macros"]);
    expect(view.premium?.features.filter((f) => f.premium).map((f) => f.code)).toEqual(["ai_photo", "meal_plans"]);
    expect(view.premium?.aiLimits).toEqual(["120 registros con foto al mes", "400 mensajes al asistente al mes"]);
    expect(view.free?.aiLimits).toEqual([]);
  });

  it("precios de Premium con prueba y si están listos en Stripe", () => {
    expect(view.premiumPrices).toHaveLength(3);
    expect(view.premiumPrices.find((p) => p.id === "um")).toMatchObject({ stripeReady: true, trialDays: 7, currency: "USD" });
    expect(primaryCurrency(view.premiumPrices)).toBe("PEN");
    expect(savingsFor(view.premiumPrices, "PEN")?.percent).toBe(44);
    expect(savingsFor(view.premiumPrices, "USD")).toBeNull();
  });

  it("precio por proveedor: Mercado Pago en soles; Stripe solo con precio creado en Stripe", () => {
    expect(optionForProvider(view.premiumPrices, "month", "mercadopago")?.id).toBe("pm");
    expect(optionForProvider(view.premiumPrices, "month", "stripe")?.id).toBe("um");
    expect(optionForProvider(view.premiumPrices, "year", "stripe")).toBeNull();
  });
});

describe("etiquetas", () => {
  it("featureLabel y aiLimitLines ignoran lo desconocido", () => {
    expect(featureLabel("ai_photo")).toBe("Registro con foto e IA");
    expect(featureLabel("nope")).toBeNull();
    expect(aiLimitLines(null)).toEqual([]);
    expect(aiLimitLines({ voice: 300, text: -1 })).toEqual(["300 registros por voz al mes"]);
  });
});

describe("providerAvailability", () => {
  it("sin claves → BILLING_NOT_CONFIGURED aunque la bandera esté encendida", () => {
    expect(providerAvailability("stripe", false, { payments_stripe: true })).toMatchObject({
      available: false,
      reason: { code: "BILLING_NOT_CONFIGURED" },
    });
  });
  it("con claves pero apagado por el admin → PROVIDER_DISABLED", () => {
    expect(providerAvailability("mercadopago", true, { payments_mercadopago: false })).toMatchObject({
      available: false,
      reason: { code: "PROVIDER_DISABLED" },
    });
  });
  it("con claves y sin bandera → disponible", () => {
    expect(providerAvailability("mercadopago", true, {})).toMatchObject({ available: true, reason: null });
  });
});
