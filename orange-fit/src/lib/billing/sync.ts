import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { createNotification } from "@/lib/notifications/notify";
import { isTerminalStatus } from "./status";
import type { BillingProviderId, PaymentSnapshot, SubscriptionRow, SubscriptionSnapshot } from "./types";

/**
 * Escrituras de pagos. TODAS con el cliente de service role (`subscriptions`, `payments` y
 * `billing_events` no aceptan escrituras de usuarios): solo las llaman los webhooks y las
 * acciones de servidor que ya validaron la sesión.
 */
type Admin = SupabaseClient<Database>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_RE.test(value);

/**
 * Idempotencia de webhooks: reserva el evento en `billing_events` (único por proveedor + id).
 * Si ya existía, el evento se procesó (o se está procesando) y no se repite.
 */
export async function claimBillingEvent(
  admin: Admin,
  provider: BillingProviderId,
  eventId: string,
  type: string,
): Promise<"claimed" | "duplicate"> {
  const { error } = await admin.from("billing_events").insert({ provider, event_id: eventId, type: type.slice(0, 120) });
  if (!error) return "claimed";
  if (error.code === "23505") return "duplicate";
  throw new Error(`billing_event_claim_failed:${error.code ?? "unknown"}`);
}

/** Libera la reserva si el procesamiento falló, para que el reintento del proveedor lo vuelva a intentar. */
export async function releaseBillingEvent(admin: Admin, provider: BillingProviderId, eventId: string): Promise<void> {
  await admin.from("billing_events").delete().eq("provider", provider).eq("event_id", eventId);
}

export async function findSubscriptionByProviderId(admin: Admin, providerSubscriptionId: string): Promise<SubscriptionRow | null> {
  const { data, error } = await admin
    .from("subscriptions")
    .select("*")
    .eq("provider_subscription_id", providerSubscriptionId)
    .maybeSingle();
  if (error) throw new Error(`subscription_read_failed:${error.code ?? "unknown"}`);
  return data;
}

/** Usuario dueño de un cliente del proveedor (por suscripciones anteriores). */
export async function findUserByCustomer(admin: Admin, provider: BillingProviderId, customerId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("provider", provider)
    .eq("provider_customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`subscription_read_failed:${error.code ?? "unknown"}`);
  return data?.[0]?.user_id ?? null;
}

/** ¿Existe la cuenta? (un webhook puede llegar después de que la persona borró su cuenta). */
export async function userExists(admin: Admin, userId: string): Promise<boolean> {
  if (!isUuid(userId)) return false;
  const { data, error } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (error) throw new Error(`profile_read_failed:${error.code ?? "unknown"}`);
  return Boolean(data);
}

/** Precio local (`plan_prices`) que corresponde a un precio de Stripe. */
export async function findPriceByStripeId(admin: Admin, stripePriceId: string): Promise<{ id: string; plan_id: string } | null> {
  const { data, error } = await admin
    .from("plan_prices")
    .select("id, plan_id")
    .eq("stripe_price_id", stripePriceId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`price_read_failed:${error.code ?? "unknown"}`);
  return data?.[0] ?? null;
}

export async function findPriceById(admin: Admin, priceId: string): Promise<{ id: string; plan_id: string } | null> {
  if (!isUuid(priceId)) return null;
  const { data, error } = await admin.from("plan_prices").select("id, plan_id").eq("id", priceId).maybeSingle();
  if (error) throw new Error(`price_read_failed:${error.code ?? "unknown"}`);
  return data;
}

/** Precio en soles que coincide con un monto e intervalo de Mercado Pago. */
export async function findPriceByAmount(
  admin: Admin,
  query: { currency: string; amountCents: number; interval: "month" | "year" },
): Promise<{ id: string; plan_id: string } | null> {
  const { data, error } = await admin
    .from("plan_prices")
    .select("id, plan_id")
    .eq("currency_code", query.currency)
    .eq("amount_cents", query.amountCents)
    .eq("interval", query.interval)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`price_read_failed:${error.code ?? "unknown"}`);
  return data?.[0] ?? null;
}

export type UpsertOutcome =
  | { result: "saved"; id: string }
  | { result: "skipped"; reason: "terminal" | "owner_mismatch"; id: string };

/**
 * Crea o actualiza la suscripción por `provider_subscription_id`.
 * - Una suscripción cancelada/vencida no se "revive" con un evento viejo que llegó tarde.
 * - Nunca cambia de dueño: si el evento dice otro usuario, se ignora.
 */
export async function upsertSubscription(admin: Admin, snap: SubscriptionSnapshot): Promise<UpsertOutcome> {
  const existing = await findSubscriptionByProviderId(admin, snap.providerSubscriptionId);
  if (existing) {
    if (existing.user_id !== snap.userId) return { result: "skipped", reason: "owner_mismatch", id: existing.id };
    if (isTerminalStatus(existing.status) && !isTerminalStatus(snap.status)) {
      return { result: "skipped", reason: "terminal", id: existing.id };
    }
  }

  const row = {
    user_id: snap.userId,
    provider: snap.provider,
    provider_subscription_id: snap.providerSubscriptionId,
    provider_customer_id: snap.providerCustomerId ?? existing?.provider_customer_id ?? null,
    plan_id: snap.planId,
    price_id: snap.priceId ?? existing?.price_id ?? null,
    status: snap.status,
    current_period_start: snap.currentPeriodStart,
    current_period_end: snap.currentPeriodEnd,
    trial_end: snap.trialEnd,
    cancel_at_period_end: snap.cancelAtPeriodEnd,
    canceled_at: snap.canceledAt,
  };
  const { data, error } = await admin
    .from("subscriptions")
    .upsert(row, { onConflict: "provider_subscription_id" })
    .select("id")
    .single();
  if (error) throw new Error(`subscription_upsert_failed:${error.code ?? "unknown"}`);
  return { result: "saved", id: data.id };
}

/** Cambia solo el estado (p. ej. a `past_due` cuando Mercado Pago está reintentando el cobro). */
export async function setSubscriptionStatus(
  admin: Admin,
  providerSubscriptionId: string,
  status: SubscriptionRow["status"],
  onlyFrom: SubscriptionRow["status"][],
): Promise<void> {
  const { error } = await admin
    .from("subscriptions")
    .update({ status })
    .eq("provider_subscription_id", providerSubscriptionId)
    .in("status", onlyFrom);
  if (error) throw new Error(`subscription_update_failed:${error.code ?? "unknown"}`);
}

const PAYMENT_RANK: Record<PaymentSnapshot["status"], number> = { pending: 0, failed: 1, succeeded: 2, refunded: 3 };

/**
 * Registra o actualiza un cobro por `provider_payment_id`. Un cobro no "retrocede": un aviso
 * de fallo que llega tarde no pisa un cobro ya exitoso (ni uno exitoso pisa un reembolso).
 */
export async function recordPayment(admin: Admin, snap: PaymentSnapshot): Promise<"saved" | "skipped"> {
  const { data: existing, error: readError } = await admin
    .from("payments")
    .select("id, status, user_id, subscription_id")
    .eq("provider_payment_id", snap.providerPaymentId)
    .maybeSingle();
  if (readError) throw new Error(`payment_read_failed:${readError.code ?? "unknown"}`);
  if (existing) {
    if (existing.user_id !== snap.userId) return "skipped";
    const before = PAYMENT_RANK[existing.status as PaymentSnapshot["status"]] ?? 0;
    if (before > PAYMENT_RANK[snap.status]) return "skipped";
  }

  let subscriptionId: string | null = existing?.subscription_id ?? null;
  if (!subscriptionId && snap.providerSubscriptionId) {
    const sub = await findSubscriptionByProviderId(admin, snap.providerSubscriptionId);
    if (sub && sub.user_id === snap.userId) subscriptionId = sub.id;
  }

  const { error } = await admin.from("payments").upsert(
    {
      user_id: snap.userId,
      subscription_id: subscriptionId,
      provider: snap.provider,
      provider_payment_id: snap.providerPaymentId,
      amount_cents: Math.max(0, Math.round(snap.amountCents)),
      currency_code: snap.currencyCode.toUpperCase().slice(0, 3),
      status: snap.status,
      paid_at: snap.paidAt,
    },
    { onConflict: "provider_payment_id" },
  );
  if (error) throw new Error(`payment_upsert_failed:${error.code ?? "unknown"}`);
  return "saved";
}

/**
 * Aviso dentro de la app cuando un cobro falla (es lo único accionable: actualizar el medio de pago).
 * `createNotification` nunca lanza: un aviso que falla no rompe el webhook.
 */
export async function notifyPaymentFailed(admin: Admin, userId: string): Promise<void> {
  await createNotification(admin, userId, {
    type: "billing.payment_failed",
    title: "No pudimos cobrar tu suscripción",
    body: "Revisa tu medio de pago para mantener Premium. Mientras tanto, tus registros siguen a salvo.",
    url: "/app/perfil/suscripcion",
  });
}
