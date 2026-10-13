import type { BillingInterval, BillingProviderId, PlanPriceRow } from "./types";

/** Máximo de días de prueba que acepta Stripe (y un tope sensato para Mercado Pago). */
export const MAX_TRIAL_DAYS = 730;

export type AnnualSavings = {
  /** Lo que costarían 12 meses pagando mes a mes. */
  twelveMonthsCents: number;
  /** Diferencia a favor del plan anual (0 si no hay ahorro). */
  savedCents: number;
  /** Porcentaje entero de ahorro (redondeado hacia abajo para no exagerar). */
  percent: number;
  /** Precio anual repartido en 12 meses (redondeado al céntimo). */
  monthlyEquivalentCents: number;
};

/**
 * Ahorro del plan anual frente a pagar 12 meses. Solo compara montos de la misma moneda;
 * si los datos no tienen sentido (montos ≤ 0) devuelve null para no mostrar cifras falsas.
 */
export function annualSavings(monthlyCents: number, yearlyCents: number): AnnualSavings | null {
  if (!Number.isFinite(monthlyCents) || !Number.isFinite(yearlyCents) || monthlyCents <= 0 || yearlyCents <= 0) return null;
  const twelveMonthsCents = Math.round(monthlyCents * 12);
  const savedCents = Math.max(0, twelveMonthsCents - Math.round(yearlyCents));
  const percent = savedCents > 0 ? Math.floor((savedCents / twelveMonthsCents) * 100) : 0;
  return {
    twelveMonthsCents,
    savedCents,
    percent,
    monthlyEquivalentCents: Math.round(yearlyCents / 12),
  };
}

/** Días de prueba a ofrecer: los del precio o, si el precio no define, los globales. */
export function trialDaysFor(price: Pick<PlanPriceRow, "trial_days">, defaultTrialDays: number, eligible: boolean): number {
  if (!eligible) return 0;
  const raw = price.trial_days > 0 ? price.trial_days : defaultTrialDays;
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(MAX_TRIAL_DAYS, Math.floor(raw));
}

/** ¿Con qué proveedor se puede cobrar este precio? (no mira credenciales, solo los datos). */
export function priceSupportsProvider(
  price: Pick<PlanPriceRow, "currency_code" | "stripe_price_id">,
  provider: BillingProviderId,
): boolean {
  if (provider === "stripe") return Boolean(price.stripe_price_id);
  // Mercado Pago cobra en soles desde Perú.
  return price.currency_code.trim().toUpperCase() === "PEN";
}

type PriceLike = Pick<PlanPriceRow, "id" | "plan_id" | "interval" | "currency_code" | "amount_cents" | "is_active" | "stripe_price_id">;

/** Precio activo de un plan para un intervalo y moneda (el más reciente si hay varios). */
export function findPrice<T extends PriceLike>(
  prices: readonly T[],
  query: { planId: string; interval: BillingInterval; currency: string },
): T | null {
  return (
    prices.find(
      (p) =>
        p.is_active &&
        p.plan_id === query.planId &&
        p.interval === query.interval &&
        p.currency_code.trim().toUpperCase() === query.currency.toUpperCase(),
    ) ?? null
  );
}

/**
 * Precio a usar con un proveedor: Mercado Pago siempre en soles; Stripe prefiere dólares
 * (tarjeta internacional) y, si no hay, cualquier moneda con `stripe_price_id`.
 */
export function priceForProvider<T extends PriceLike>(
  prices: readonly T[],
  planId: string,
  interval: BillingInterval,
  provider: BillingProviderId,
): T | null {
  const candidates = prices.filter((p) => p.is_active && p.plan_id === planId && p.interval === interval && priceSupportsProvider(p, provider));
  if (provider === "mercadopago") return candidates[0] ?? null;
  return candidates.find((p) => p.currency_code.toUpperCase() === "USD") ?? candidates[0] ?? null;
}

/** Monedas con precio activo para un plan, en orden (PEN primero, es el mercado principal). */
export function currenciesFor(prices: readonly PriceLike[], planId: string): string[] {
  const set = new Set(prices.filter((p) => p.is_active && p.plan_id === planId).map((p) => p.currency_code.trim().toUpperCase()));
  return [...set].sort((a, b) => (a === "PEN" ? -1 : b === "PEN" ? 1 : a.localeCompare(b)));
}

/** Monto para Mercado Pago (`transaction_amount` en unidades, con 2 decimales). */
export function centsToAmount(cents: number): number {
  return Math.round(cents) / 100;
}

/** Monto en céntimos desde unidades (Mercado Pago devuelve 29.9). */
export function amountToCents(amount: number): number {
  return Math.round(amount * 100);
}
