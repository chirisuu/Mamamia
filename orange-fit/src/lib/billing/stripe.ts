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
  notifyPaymentFailed,
  recordPayment,
  releaseBillingEvent,
  upsertSubscription,
  userExists,
} from "./sync";
import { BillingError, type SubscriptionRow, type SubscriptionSnapshot } from "./types";

type Admin = SupabaseClient<Database>;

/**
 * Lo único que el webhook y la confirmación necesitan del cliente de Stripe (inyectable en pruebas).
 * `null` = no hay STRIPE_SECRET_KEY: el webhook trabaja solo con el contenido firmado del evento.
 */
export type StripeReadApi = {
  subscriptions: { retrieve(id: string): Promise<Stripe.Subscription> };
  checkout?: { sessions: { retrieve(id: string): Promise<Stripe.Checkout.Session> } };
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

/** Stripe no garantiza el orden de los eventos: si hay clave de API, se usa el estado ACTUAL. */
async function latestSubscription(api: StripeReadApi | null, fromEvent: Stripe.Subscription): Promise<Stripe.Subscription> {
  if (!api) return fromEvent;
  try {
    return await api.subscriptions.retrieve(fromEvent.id);
  } catch (error) {
    // Si Stripe ya no la tiene, el contenido firmado del evento es lo último que sabemos.
    if (error instanceof Stripe.errors.StripeError && error.code === "resource_missing") return fromEvent;
    throw error;
  }
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const fromParent = invoice.parent?.subscription_details?.subscription;
  if (fromParent) return idOf(fromParent);
  const legacy = invoice as unknown as { subscription?: string | { id: string } | null };
  return idOf(legacy.subscription ?? null);
}

async function syncInvoice(admin: Admin, invoice: Stripe.Invoice, paid: boolean, api: StripeReadApi | null): Promise<string> {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return "ignored_no_subscription";
  const amount = paid ? invoice.amount_paid : invoice.amount_due;
  // La factura de 0 de la prueba gratis no es un cobro: no la mostramos en el historial.
  if (amount <= 0) return "ignored_zero";
  if (!invoice.id) return "ignored_no_id";

  let existing = await findSubscriptionByProviderId(admin, subscriptionId);
  if (!existing && api) {
    // La factura puede llegar antes que `customer.subscription.created`: se sincroniza primero.
    try {
      await syncSubscription(admin, await api.subscriptions.retrieve(subscriptionId));
      existing = await findSubscriptionByProviderId(admin, subscriptionId);
    } catch (error) {
      // Si Stripe ya no la tiene, se sigue con los datos de la factura; otro error → reintento.
      if (!(error instanceof Stripe.errors.StripeError && error.code === "resource_missing")) throw error;
    }
  }
  const metaUser = invoice.parent?.subscription_details?.metadata?.user_id ?? null;
  const customerId = idOf(invoice.customer);
  const userId =
    existing?.user_id ??
    (metaUser && (await userExists(admin, metaUser)) ? metaUser : null) ??
    (customerId ? await findUserByCustomer(admin, "stripe", customerId) : null);
  if (!userId) {
    console.warn("stripe_invoice_unmatched", { invoice: invoice.id });
    return "unmatched";
  }
  const status = paid ? "succeeded" : "failed";
  const result = await recordPayment(admin, {
    userId,
    provider: "stripe",
    providerPaymentId: invoice.id,
    providerSubscriptionId: subscriptionId,
    amountCents: amount,
    currencyCode: invoice.currency.toUpperCase(),
    status,
    paidAt: paid ? (toIso(invoice.status_transitions?.paid_at) ?? new Date().toISOString()) : null,
  });
  if (result === "saved" && status === "failed") await notifyPaymentFailed(admin, userId);
  return result;
}

/** Cliente de lectura por defecto: el real si hay STRIPE_SECRET_KEY; si no, ninguno. */
function defaultReadApi(): StripeReadApi | null {
  return serverEnv().STRIPE_SECRET_KEY ? getStripe() : null;
}

/**
 * Procesa un evento ya verificado. Lanza si algo falla (el webhook libera el evento y responde 500
 * para que Stripe lo reintente). Devuelve qué se hizo (solo para logs y pruebas).
 */
export async function processStripeEvent(event: Stripe.Event, deps: { admin: Admin; stripe?: StripeReadApi | null }): Promise<string> {
  const { admin } = deps;
  const api = deps.stripe === undefined ? defaultReadApi() : deps.stripe;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode !== "subscription") return "ignored_mode";
      const subscriptionId = idOf(session.subscription);
      if (!subscriptionId) return "ignored_no_subscription";
      // Sin clave de API no se puede leer la suscripción: llegará en `customer.subscription.created`.
      if (!api) return "ignored_no_api";
      const sub = await api.subscriptions.retrieve(subscriptionId);
      return syncSubscription(admin, sub, session.client_reference_id ?? session.metadata?.user_id ?? null);
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      return syncSubscription(admin, await latestSubscription(api, event.data.object));
    case "invoice.paid":
      return syncInvoice(admin, event.data.object, true, api);
    case "invoice.payment_failed":
      return syncInvoice(admin, event.data.object, false, api);
    default:
      return "ignored_type";
  }
}

export type StripeWebhookDeps = {
  admin: Admin;
  webhookSecret: string | undefined;
  stripe: StripeReadApi | null;
};

/** Webhook de Stripe: firma con el cuerpo crudo → idempotencia → procesamiento. */
export async function handleStripeWebhook(request: Request, overrides: Partial<StripeWebhookDeps> = {}): Promise<Response> {
  const secret = "webhookSecret" in overrides ? overrides.webhookSecret : serverEnv().STRIPE_WEBHOOK_SECRET;
  if (!secret) return billingError(503, "BILLING_NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE);

  const signature = request.headers.get("stripe-signature");
  if (!signature) return billingError(400, "INVALID_SIGNATURE", "Falta la firma de Stripe.");
  // Cuerpo CRUDO: la firma se calcula sobre los bytes exactos que envió Stripe.
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
    const result = await processStripeEvent(event, { admin, stripe: "stripe" in overrides ? overrides.stripe : undefined });
    return billingJson(200, { received: true, result });
  } catch (error) {
    await releaseBillingEvent(admin, "stripe", event.id).catch(() => undefined);
    console.error("stripe_webhook_failed", { event: event.id, type: event.type, reason: error instanceof Error ? error.name : "unknown" });
    return billingError(500, "WEBHOOK_FAILED", "No pudimos procesar el evento. Stripe lo reintentará.");
  }
}

/**
 * Confirmación activa al volver del checkout (por si el webhook se demora): lee la sesión en
 * Stripe y, si es de esta persona y ya se completó, sincroniza la suscripción real.
 */
export async function syncStripeCheckoutForUser(
  admin: Admin,
  input: { sessionId: string; userId: string },
  api: StripeReadApi = getStripe(),
): Promise<"synced" | "not_owner" | "open" | "no_subscription" | "unmatched" | "skipped"> {
  if (!api.checkout) throw new BillingError(503, "BILLING_NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE);
  let session: Stripe.Checkout.Session;
  try {
    session = await api.checkout.sessions.retrieve(input.sessionId);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError && error.code === "resource_missing") return "not_owner";
    throw providerError(error);
  }
  // Solo la dueña de la sesión puede confirmarla (client_reference_id lo puso nuestro checkout).
  if (session.client_reference_id !== input.userId) return "not_owner";
  if (session.status !== "complete") return "open";
  const subscriptionId = idOf(session.subscription);
  if (!subscriptionId) return "no_subscription";
  let sub: Stripe.Subscription;
  try {
    sub = await api.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    throw providerError(error);
  }
  const result = await syncSubscription(admin, sub, input.userId);
  return result === "saved" ? "synced" : result === "unmatched" ? "unmatched" : "skipped";
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

/**
 * Cancela al final del periodo: la persona conserva Premium hasta la fecha ya pagada. Si el último
 * cobro falló (`past_due`, sin acceso), se cancela ya para que Stripe deje de reintentar el cobro.
 */
export async function cancelStripeSubscription(subscription: SubscriptionRow): Promise<SubscriptionSnapshot> {
  if (!isStripeConfigured()) throw new BillingError(503, "BILLING_NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE);
  if (!subscription.provider_subscription_id) {
    throw new BillingError(409, "NO_PROVIDER_SUBSCRIPTION", "Esta suscripción no tiene referencia en Stripe.");
  }
  try {
    const id = subscription.provider_subscription_id;
    const updated =
      subscription.status === "past_due"
        ? await getStripe().subscriptions.cancel(id)
        : await getStripe().subscriptions.update(id, { cancel_at_period_end: true });
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
