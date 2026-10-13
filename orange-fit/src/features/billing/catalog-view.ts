import { annualSavings, trialDaysFor, type AnnualSavings } from "@/lib/billing/pricing";
import type { BillingInterval, PlanPriceRow, PlanRow } from "@/lib/billing/types";
import { aiLimitLines, featureLabel, isPremiumFeature } from "./labels";

/** Plan listo para mostrar (sin ids de proveedor ni nada sensible: viaja al cliente). */
export type PlanCard = {
  id: string;
  name: string;
  description: string | null;
  /** Funciones con nombre conocido, en el orden del plan. */
  features: Array<{ code: string; label: string; premium: boolean }>;
  aiLimits: string[];
};

export type PriceOption = {
  id: string;
  interval: BillingInterval;
  currency: string;
  amountCents: number;
  /** Días de prueba que se ofrecen en una primera suscripción (0 = sin prueba). */
  trialDays: number;
  /** Tiene precio creado en Stripe (`stripe_price_id`). */
  stripeReady: boolean;
};

export type CatalogView = {
  free: PlanCard | null;
  premium: PlanCard | null;
  premiumPrices: PriceOption[];
};

function toPlanCard(plan: PlanRow): PlanCard {
  const features: PlanCard["features"] = [];
  for (const code of plan.features) {
    const label = featureLabel(code);
    if (label) features.push({ code, label, premium: isPremiumFeature(code) });
  }
  return { id: plan.id, name: plan.name, description: plan.description, features, aiLimits: aiLimitLines(plan.ai_monthly_limits) };
}

/** Catálogo de la BD → lo que muestran /precios y /app/premium. */
export function buildCatalogView(catalog: { plans: PlanRow[]; prices: PlanPriceRow[] }, defaultTrialDays: number): CatalogView {
  const free = catalog.plans.find((p) => p.id === "free") ?? null;
  const premium = catalog.plans.find((p) => p.id === "premium") ?? null;
  const premiumPrices: PriceOption[] = premium
    ? catalog.prices
        .filter((p) => p.is_active && p.plan_id === premium.id && p.amount_cents > 0)
        .map((p) => ({
          id: p.id,
          interval: p.interval,
          currency: p.currency_code.trim().toUpperCase(),
          amountCents: p.amount_cents,
          trialDays: trialDaysFor(p, defaultTrialDays, true),
          stripeReady: Boolean(p.stripe_price_id),
        }))
    : [];
  return { free: free ? toPlanCard(free) : null, premium: premium ? toPlanCard(premium) : null, premiumPrices };
}

export function priceFor(prices: readonly PriceOption[], interval: BillingInterval, currency: string): PriceOption | null {
  return prices.find((p) => p.interval === interval && p.currency === currency) ?? null;
}

/** Ahorro del plan anual en una moneda (null si falta alguno de los dos precios). */
export function savingsFor(prices: readonly PriceOption[], currency: string): AnnualSavings | null {
  const month = priceFor(prices, "month", currency);
  const year = priceFor(prices, "year", currency);
  if (!month || !year) return null;
  return annualSavings(month.amountCents, year.amountCents);
}

/** Moneda principal a mostrar: soles si hay precio en soles; si no, la primera disponible. */
export function primaryCurrency(prices: readonly PriceOption[]): string | null {
  if (prices.some((p) => p.currency === "PEN")) return "PEN";
  return prices[0]?.currency ?? null;
}

/**
 * Precio que se cobraría con un proveedor en un periodo: Mercado Pago en soles; Stripe con un
 * precio creado en Stripe, preferentemente en dólares (tarjeta internacional).
 */
export function optionForProvider(
  prices: readonly PriceOption[],
  interval: BillingInterval,
  provider: "stripe" | "mercadopago",
): PriceOption | null {
  const candidates = prices.filter((p) => p.interval === interval);
  if (provider === "mercadopago") return candidates.find((p) => p.currency === "PEN") ?? null;
  const ready = candidates.filter((p) => p.stripeReady);
  return ready.find((p) => p.currency === "USD") ?? ready[0] ?? null;
}
