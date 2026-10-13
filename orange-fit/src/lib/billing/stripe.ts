import "server-only";
import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/server-env";
import { billingError, billingJson, NOT_CONFIGURED_MESSAGE } from "./http";
import type { BillingProvider, CheckoutInput, CheckoutSession } from "./provider";
import { mapStripeStatus } from "./status";
import {
  claimBillingEvent,
  findPriceById,
  findPriceByStripeId,
  findSubscriptionByProviderId,
  findUserByCustomer,
  recordPayment,
  releaseBillingEvent,
  upsertSubscription,
  userExists,
} from "./sync";
import { BillingError, type SubscriptionRow, type SubscriptionSnapshot } from "./types";

type Admin = SupabaseClient<Database>;

/** Lo único que el webhook necesita del cliente de Stripe (inyectable en pruebas). */
export type StripeSubscriptionsApi = {
  subscriptions: { retrieve(id: string): Promise<Stripe.Subscription> };
};

let cachedClient: Stripe | null = null;

export function isStripeConfigured(): boolean {
  const env = serverEnv();
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
}

/** Cliente de Stripe. Sin `apiVersion`: el SDK 23 usa la versión que trae fijada. */
export function getStripe(): Stripe {
  const key = serverEnv().STRIPE_SECRET_KEY;
  if (!key) throw new BillingError(503, "BILLING_NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE);
  cachedClient ??= new Stripe(key, {
    appInfo: { name: "ORANGE FIT" },
    maxNetworkRetries: 2,
    timeout: 20_000,
  });
  return cachedClient;
}

const toIso = (seconds: number | null | undefined): string | null =>
  typeof seconds === "number" && Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : null;

const idOf = (value: string | { id: string } | null | undefined): string | null =>
  value == null ? null : typeof value === "string" ? value : value.id;

/**
 * Suscripción de Stripe → columnas de `subscriptions`. Desde la API "basil" el periodo vive en
 * cada ítem (`items.data[].current_period_*`); se toma el primer ítem y, si no viene, los campos
 * antiguos del objeto raíz.
 */
export function stripeSubscriptionSnapshot(
  sub: Stripe.Subscription,
  ctx: { userId: string; planId: string; priceId: string | null },
): SubscriptionSnapshot {
  const item = sub.items?.data?.[0];
  const legacy = sub as unknown as { current_period_start?: number; current_period_end?: number };
  const status = mapStripeStatus(sub.status);
  // Cancelación programada: `cancel_at_period_end` o, en APIs nuevas, una fecha `cancel_at`.
  const scheduledCancel = status !== "canceled" && (sub.cancel_at_period_end || sub.cancel_at != null);
  return {
    userId: ctx.userId,
    provider: "stripe",
    providerSubscriptionId: sub.id,
    providerCustomerId: idOf(sub.customer),
    planId: ctx.planId,
    priceId: ctx.priceId,
    status,
    currentPeriodStart: toIso(item?.current_period_start ?? legacy.current_period_start),
    currentPeriodEnd: toIso(item?.current_period_end ?? legacy.current_period_end),
    trialEnd: toIso(sub.trial_end),
    cancelAtPeriodEnd: scheduledCancel,
    canceledAt: toIso(sub.canceled_at),
  };
}

/** Plan y precio locales de una suscripción de Stripe (por el price del ítem o por metadata). */
async function resolvePlan(admin: Admin, sub: Stripe.Subscription): Promise<{ planId: string; priceId: string | null }> {
  const stripePriceId = sub.items?.data?.[0]?.price?.id;
  const byStripe = stripePriceId ? await findPriceByStripeId(admin, stripePriceId) : null;
  if (byStripe) return { planId: byStripe.plan_id, priceId: byStripe.id };
  const byMeta = sub.metadata?.price_id ? await findPriceById(admin, sub.metadata.price_id) : null;
  if (byMeta) return { planId: byMeta.plan_id, priceId: byMeta.id };
  return { planId: "premium", priceId: null };
}

/** Dueño de la suscripción: metadata (la pone nuestro checkout) → fila existente → cliente. */
async function resolveUser(admin: Admin, sub: Stripe.Subscription, hint: string | null): Promise<string | null> {
  const candidates = [sub.metadata?.user_id, hint];
  for (const candidate of candidates) {
    if (candidate && (await userExists(admin, candidate))) return candidate;
  }
  const existing = await findSubscriptionByProviderId(admin, sub.id);
  if (existing) return existing.user_id;
  const customerId = idOf(sub.customer);
  return customerId ? findUserByCustomer(admin, "stripe", customerId) : null;
}

async function syncSubscription(admin: Admin, sub: Stripe.Subscription, userHint: string | null = null): Promise<string> {
  const userId = await resolveUser(admin, sub, userHint);
  if (!userId) {
    // Sin dueño reconocible (p. ej. la cuenta se eliminó): se registra en logs y no se reintenta.
    console.warn("stripe_subscription_unmatched", { subscription: sub.id });
    return "unmatched";
  }
  const plan = await resolvePlan(admin, sub);
  const outcome = await upsertSubscription(admin, stripeSubscriptionSnapshot(sub, { userId, ...plan }));
  if (outcome.result === "skipped") console.warn("stripe_subscription_skipped", { subscription: sub.id, reason: outcome.reason });
  return outcome.result;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const fromParent = invoice.parent?.subscription_details?.subscription;
  if (fromParent) return idOf(fromParent);
  const legacy = invoice as unknown as { subscription?: string | { id: string } | null };
  return idOf(legacy.subscription ?? null);
}

async function syncInvoice(admin: Admin, invoice: Stripe.Invoice, paid: boolean, stripe: () => StripeSubscriptionsApi): Promise<string> {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return "ignored_no_subscription";
  const amount = paid ? invoice.amount_paid : invoice.amount_due;
  // La factura de 0 de la prueba gratis no es un cobro: no la mostramos en el historial.
  if (amount <= 0) return "ignored_zero";

  let existing = await findSubscriptionByProviderId(admin, subscriptionId);
  if (!existing) {
    // La factura puede llegar antes que `customer.subscription.created`: se sincroniza primero.
    try {
      await syncSubscription(admin, await stripe().subscriptions.retrieve(subscriptionId));
      existing = await findSubscriptionByProviderId(admin, subscriptionId);
    } catch (error) {
      console.warn("stripe_invoice_subscription_fetch_failed", { reason: error instanceof Error ? error.name : "unknown" });
    }
  }
  const metaUser = invoice.parent?.subscription_details?.metadata?.user_id ?? null;
  const userId =
    existing?.user_id ??
    (metaUser && (await userExists(admin, metaUser)) ? metaUser : null) ??
    (idOf(invoice.customer) ? await findUserByCustomer(admin, "stripe", idOf(invoice.customer)!) : null);
  if (!userId) {
    console.warn("stripe_invoice_unmatched", { invoice: invoice.id });
    return "unmatched";
  }
  if (!invoice.id) return "ignored_no_id";
  return recordPayment(admin, {
    userId,
    provider: "stripe",
    providerPaymentId: invoice.id,
    providerSubscriptionId: subscriptionId,
    amountCents: amount,
    currencyCode: invoice.currency.toUpperCase(),
    status: paid ? "succeeded" : "failed",
    paidAt: paid ? (toIso(invoice.status_transitions?.paid_at) ?? new Date().toISOString()) : null,
  });
}

/**
 * Procesa un evento ya verificado. Lanza si algo falla (el webhook libera el evento y responde 500
 * para que Stripe lo reintente). Devuelve qué se hizo (solo para logs y pruebas).
 */
export async function processStripeEvent(
  event: Stripe.Event,
  deps: { admin: Admin; stripe?: () => StripeSubscriptionsApi },
): Promise<string> {
  const { admin } = deps;
  const stripe = deps.stripe ?? (() => getStripe());

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode !== "subscription") return "ignored_mode";
      const subscriptionId = idOf(session.subscription);
      if (!subscriptionId) return "ignored_no_subscription";
      const sub = await stripe().subscriptions.retrieve(subscriptionId);
      return syncSubscription(admin, sub, session.client_reference_id ?? session.metadata?.user_id ?? null);
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      return syncSubscription(admin, event.data.object);
    case "invoice.paid":
      return syncInvoice(admin, event.data.object, true, stripe);
    case "invoice.payment_failed":
      return syncInvoice(admin, event.data.object, false, stripe);
    default:
      return "ignored_type";
  }
}

export type StripeWebhookDeps = {
  admin: Admin;
  webhookSecret: string | undefined;
  stripe: () => StripeSubscriptionsApi;
};

/** Webhook de Stripe: firma con el cuerpo crudo → idempotencia → procesamiento. */
export async function handleStripeWebhook(request: Request, overrides: Partial<StripeWebhookDeps> = {}): Promise<Response> {
  const secret = "webhookSecret" in overrides ? overrides.webhookSecret : serverEnv().STRIPE_WEBHOOK_SECRET;
  if (!secret) return billingError(503, "BILLING_NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE);

  const signature = request.headers.get("stripe-signature");
  if (!signature) return billingError(400, "INVALID_SIGNATURE", "Falta la firma de Stripe.");
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = Stripe.webhooks.constructEvent(payload, signature, secret);
  } catch {
    return billingError(400, "INVALID_SIGNATURE", "La firma de Stripe no es válida.");
  }

  let admin: Admin;
  try {
    admin = overrides.admin ?? createSupabaseAdminClient();
  } catch {
    return billingError(503, "BILLING_NOT_CONFIGURED", "Falta la clave de servicio de la base de datos.");
  }

  let claim: "claimed" | "duplicate";
  try {
    claim = await claimBillingEvent(admin, "stripe", event.id, event.type);
  } catch (error) {
    console.error("stripe_webhook_claim_failed", { event: event.id, reason: error instanceof Error ? error.message : "unknown" });
    return billingError(500, "WEBHOOK_FAILED", "No pudimos registrar el evento.");
  }
  if (claim === "duplicate") return billingJson(200, { received: true, duplicate: true });

  try {
    const result = await processStripeEvent(event, { admin, stripe: overrides.stripe });
    return billingJson(200, { received: true, result });
  } catch (error) {
    await releaseBillingEvent(admin, "stripe", event.id).catch(() => undefined);
    console.error("stripe_webhook_failed", { event: event.id, type: event.type, reason: error instanceof Error ? error.message : "unknown" });
    return billingError(500, "WEBHOOK_FAILED", "No pudimos procesar el evento. Stripe lo reintentará.");
  }
}

// ---------------------------------------------------------------------------------------------
// Acciones de la persona (checkout, portal, cancelar)

function providerError(error: unknown): BillingError {
  if (error instanceof BillingError) return error;
  const type = error instanceof Stripe.errors.StripeError ? error.type : "unknown";
  console.error("stripe_request_failed", { type });
  return new BillingError(502, "PROVIDER_ERROR", "Stripe no respondió como esperábamos. Inténtalo de nuevo en un momento.");
}

export async function createStripeCheckout(input: CheckoutInput): Promise<CheckoutSession> {
  if (!isStripeConfigured()) throw new BillingError(503, "BILLING_NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE);
  if (!input.price.stripe_price_id) {
    throw new BillingError(503, "PRICE_NOT_CONFIGURED", "Este precio todavía no está configurado en Stripe.");
  }
  const metadata = { user_id: input.user.id, price_id: input.price.id, plan_id: input.price.plan_id };
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: input.price.stripe_price_id, quantity: 1 }],
      client_reference_id: input.user.id,
      metadata,
      ...(input.customerId ? { customer: input.customerId } : input.user.email ? { customer_email: input.user.email } : {}),
      subscription_data: {
        metadata,
        ...(input.trialDays > 0 ? { trial_period_days: input.trialDays } : {}),
      },
      locale: "es-419",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });
    if (!session.url) throw new BillingError(502, "PROVIDER_ERROR", "Stripe no devolvió la página de pago.");
    return { url: session.url, providerReference: session.id };
  } catch (error) {
    throw providerError(error);
  }
}

export async function createStripePortalUrl(input: { subscription: SubscriptionRow; returnUrl: string }): Promise<string> {
  if (!isStripeConfigured()) throw new BillingError(503, "BILLING_NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE);
  const customer = input.subscription.provider_customer_id;
  if (!customer) throw new BillingError(409, "NO_CUSTOMER", "No encontramos tu cliente en Stripe. Escríbenos y lo revisamos.");
  try {
    const portal = await getStripe().billingPortal.sessions.create({ customer, return_url: input.returnUrl, locale: "es-419" });
    return portal.url;
  } catch (error) {
    throw providerError(error);
  }
}

/** Cancela al final del periodo: la persona conserva Premium hasta la fecha ya pagada. */
export async function cancelStripeSubscription(subscription: SubscriptionRow): Promise<SubscriptionSnapshot> {
  if (!isStripeConfigured()) throw new BillingError(503, "BILLING_NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE);
  if (!subscription.provider_subscription_id) {
    throw new BillingError(409, "NO_PROVIDER_SUBSCRIPTION", "Esta suscripción no tiene referencia en Stripe.");
  }
  try {
    const updated = await getStripe().subscriptions.update(subscription.provider_subscription_id, { cancel_at_period_end: true });
    return stripeSubscriptionSnapshot(updated, {
      userId: subscription.user_id,
      planId: subscription.plan_id,
      priceId: subscription.price_id,
    });
  } catch (error) {
    throw providerError(error);
  }
}

export const stripeProvider: BillingProvider = {
  id: "stripe",
  label: "Tarjeta (Stripe)",
  isConfigured: isStripeConfigured,
  createCheckout: createStripeCheckout,
  createPortalOrManageUrl: createStripePortalUrl,
  cancelSubscription: cancelStripeSubscription,
  handleWebhook: (request) => handleStripeWebhook(request),
};
