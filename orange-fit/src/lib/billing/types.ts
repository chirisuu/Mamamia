import type { Database } from "@/lib/db/database.types";

export type BillingProviderId = Database["public"]["Enums"]["billing_provider"];
export type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];
export type BillingInterval = Database["public"]["Enums"]["billing_interval"];

export type PlanRow = Database["public"]["Tables"]["plans"]["Row"];
export type PlanPriceRow = Database["public"]["Tables"]["plan_prices"]["Row"];
export type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];
export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

/** Estado de pago que guardamos en `payments.status` (check en la BD). */
export type PaymentStatus = "succeeded" | "pending" | "failed" | "refunded";

export const BILLING_PROVIDERS = ["stripe", "mercadopago"] as const satisfies readonly BillingProviderId[];

/** Campos de `subscriptions` que llegan desde un proveedor (los escribe solo el service role). */
export type SubscriptionSnapshot = {
  userId: string;
  provider: BillingProviderId;
  providerSubscriptionId: string;
  providerCustomerId: string | null;
  planId: string;
  priceId: string | null;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
};

/** Cobro que se registra en `payments` (nunca datos de tarjeta). */
export type PaymentSnapshot = {
  userId: string;
  provider: BillingProviderId;
  providerPaymentId: string;
  providerSubscriptionId: string | null;
  amountCents: number;
  currencyCode: string;
  status: PaymentStatus;
  paidAt: string | null;
};

/**
 * Error con status HTTP y código estable para la UI. Lo lanzan los adaptadores de pago y lo
 * traducen los route handlers a `{ error: { code, message } }`.
 */
export class BillingError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "BillingError";
    this.code = code;
    this.status = status;
  }
}

export function isBillingError(error: unknown): error is BillingError {
  return error instanceof BillingError;
}
