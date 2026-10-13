import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/server-env";
import { billingError, billingJson, NOT_CONFIGURED_MESSAGE } from "./http";
import { amountToCents, centsToAmount } from "./pricing";
import type { BillingProvider, CheckoutInput, CheckoutSession } from "./provider";
import {
  mapMercadoPagoPaymentStatus,
  mapMercadoPagoPreapproval,
  type MercadoPagoPreapproval,
} from "./status";
import {
  claimBillingEvent,
  findPriceByAmount,
  findSubscriptionByProviderId,
  isUuid,
  notifyPaymentFailed,
  recordPayment,
  releaseBillingEvent,
  setSubscriptionStatus,
  upsertSubscription,
  userExists,
} from "./sync";
import { BillingError, type SubscriptionRow, type SubscriptionSnapshot } from "./types";

/**
 * Mercado Pago (suscripciones sin plan asociado, API REST con fetch).
 * Documentación: /preapproval (crear, consultar, cancelar) y /authorized_payments (cobros).
 */
export const MERCADOPAGO_API = "https://api.mercadopago.com";
/** Panel de Mercado Pago donde la persona ve y gestiona sus suscripciones (Perú). */
export const MERCADOPAGO_MANAGE_URL = "https://www.mercadopago.com.pe/subscriptions";
/**
 * Antigüedad máxima aceptada de la firma de un webhook (24 h). Es amplia a propósito: Mercado Pago
 * reintenta durante horas y no documenta si vuelve a firmar cada reintento. Reprocesar una
 * notificación vieja no es peligroso (siempre consultamos el recurso real y hay idempotencia por id);
 * la ventana solo descarta capturas antiguas.
 */
export const MERCADOPAGO_SIGNATURE_TOLERANCE_SECONDS = 24 * 60 * 60;

type Admin = SupabaseClient<Database>;
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type MercadoPagoClient = { accessToken: string; fetch: FetchLike };

export type MercadoPagoAuthorizedPayment = {
  id: number | string;
  preapproval_id?: string | null;
  status?: string | null;
  transaction_amount?: number | null;
  currency_id?: string | null;
  date_created?: string | null;
  last_modified?: string | null;
  debit_date?: string | null;
  payment?: { id?: number | string | null; status?: string | null } | null;
};

export function isMercadoPagoConfigured(): boolean {
  const env = serverEnv();
  return Boolean(env.MERCADOPAGO_ACCESS_TOKEN && env.MERCADOPAGO_WEBHOOK_SECRET);
}

function defaultClient(): MercadoPagoClient {
  const token = serverEnv().MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new BillingError(503, "BILLING_NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE);
  return { accessToken: token, fetch: (input, init) => fetch(input, init) };
}

async function mpRequest<T>(client: MercadoPagoClient, method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await client.fetch(`${MERCADOPAGO_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${client.accessToken}`,
        "Content-Type": "application/json",
        ...(method === "POST" ? { "X-Idempotency-Key": randomUUID() } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    console.error("mercadopago_request_failed", { method, path: path.split("/")[1], reason: "network" });
    throw new BillingError(502, "PROVIDER_ERROR", "No pudimos conectar con Mercado Pago. Inténtalo de nuevo en un momento.");
  }
  if (!response.ok) {
    console.error("mercadopago_request_failed", { method, path: path.split("/")[1], status: response.status });
    if (response.status === 401 || response.status === 403) {
      throw new BillingError(503, "BILLING_NOT_CONFIGURED", "Las credenciales de Mercado Pago no son válidas.");
    }
    if (response.status === 404) throw new BillingError(404, "PROVIDER_NOT_FOUND", "Mercado Pago no encontró el recurso.");
    throw new BillingError(502, "PROVIDER_ERROR", "Mercado Pago no respondió como esperábamos. Inténtalo de nuevo en un momento.");
  }
  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------------------------
// Checkout

/** Cuerpo de POST /preapproval (suscripción sin plan asociado, pago en el sitio de Mercado Pago). */
export function buildPreapprovalBody(input: CheckoutInput) {
  if (input.price.currency_code.toUpperCase() !== "PEN") {
    throw new BillingError(400, "CURRENCY_NOT_SUPPORTED", "Mercado Pago solo cobra en soles (PEN).");
  }
  if (!input.user.email) throw new BillingError(400, "EMAIL_REQUIRED", "Tu cuenta necesita un correo para pagar con Mercado Pago.");
  const yearly = input.price.interval === "year";
  return {
    reason: `${input.appName} ${input.planName} (${yearly ? "anual" : "mensual"})`.slice(0, 120),
    external_reference: input.user.id,
    payer_email: input.user.email,
    back_url: input.successUrl,
    status: "pending",
    auto_recurring: {
      // Mercado Pago no acepta "years": el plan anual se cobra cada 12 meses.
      frequency: yearly ? 12 : 1,
      frequency_type: "months",
      transaction_amount: centsToAmount(input.price.amount_cents),
      currency_id: "PEN",
      ...(input.trialDays > 0 ? { free_trial: { frequency: input.trialDays, frequency_type: "days" } } : {}),
    },
  };
}

export async function createMercadoPagoCheckout(input: CheckoutInput, client?: MercadoPagoClient): Promise<CheckoutSession> {
  if (!client && !isMercadoPagoConfigured()) throw new BillingError(503, "BILLING_NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE);
  const body = buildPreapprovalBody(input);
  const created = await mpRequest<{ id?: string; init_point?: string | null }>(client ?? defaultClient(), "POST", "/preapproval", body);
  if (!created.init_point) throw new BillingError(502, "PROVIDER_ERROR", "Mercado Pago no devolvió la página de pago.");
  return { url: created.init_point, providerReference: created.id ?? null };
}

/**
 * Cancela en Mercado Pago (los cobros futuros se detienen de inmediato). Lo ya pagado se respeta:
 * ver `mapMercadoPagoPreapproval` (queda `cancel_at_period_end` hasta el fin del periodo).
 */
export async function cancelMercadoPagoSubscription(subscription: SubscriptionRow, client?: MercadoPagoClient): Promise<SubscriptionSnapshot> {
  if (!client && !isMercadoPagoConfigured()) throw new BillingError(503, "BILLING_NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE);
  const id = subscription.provider_subscription_id;
  if (!id) throw new BillingError(409, "NO_PROVIDER_SUBSCRIPTION", "Esta suscripción no tiene referencia en Mercado Pago.");
  const updated = await mpRequest<MercadoPagoPreapproval>(client ?? defaultClient(), "PUT", `/preapproval/${encodeURIComponent(id)}`, {
    status: "cancelled",
  });
  const mapped = mapMercadoPagoPreapproval(
    { ...updated, id: updated.id ?? id, status: updated.status ?? "cancelled" },
    { status: subscription.status, currentPeriodEnd: subscription.current_period_end, trialEnd: subscription.trial_end },
  );
  return {
    userId: subscription.user_id,
    provider: "mercadopago",
    providerSubscriptionId: id,
    providerCustomerId: subscription.provider_customer_id,
    planId: subscription.plan_id,
    priceId: subscription.price_id,
    ...mapped,
  };
}

// ---------------------------------------------------------------------------------------------
// Firma del webhook

export type SignatureCheck = { ok: true } | { ok: false; reason: "missing" | "malformed" | "mismatch" | "expired" };

/** Separa `x-signature: ts=…,v1=…`. */
export function parseSignatureHeader(header: string | null): { ts: string; v1: string } | null {
  if (!header) return null;
  let ts = "";
  let v1 = "";
  for (const part of header.split(",")) {
    const [key, ...rest] = part.split("=");
    const value = rest.join("=").trim();
    if (key?.trim() === "ts") ts = value;
    else if (key?.trim() === "v1") v1 = value;
  }
  return ts && v1 ? { ts, v1 } : null;
}

/** Manifiesto que firma Mercado Pago. Las partes ausentes se omiten (así lo indica su documentación). */
export function signatureManifest(dataId: string | null, requestId: string | null, ts: string): string {
  let manifest = "";
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;
  return manifest;
}

export function signManifest(manifest: string, secret: string): string {
  return createHmac("sha256", secret).update(manifest).digest("hex");
}

/**
 * Verifica `x-signature` (HMAC-SHA256 del manifiesto con MERCADOPAGO_WEBHOOK_SECRET), en tiempo
 * constante, y que la marca de tiempo no sea vieja (ts puede venir en segundos o milisegundos).
 */
export function verifyMercadoPagoSignature(input: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
  now?: Date;
  toleranceSeconds?: number;
}): SignatureCheck {
  if (!input.signatureHeader) return { ok: false, reason: "missing" };
  const parsed = parseSignatureHeader(input.signatureHeader);
  if (!parsed || !/^\d+$/.test(parsed.ts) || !/^[0-9a-f]{64}$/i.test(parsed.v1)) return { ok: false, reason: "malformed" };

  const expected = Buffer.from(signManifest(signatureManifest(input.dataId, input.requestId, parsed.ts), input.secret), "hex");
  const received = Buffer.from(parsed.v1.toLowerCase(), "hex");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return { ok: false, reason: "mismatch" };

  const tsNumber = Number(parsed.ts);
  const tsMs = tsNumber > 1e12 ? tsNumber : tsNumber * 1000;
  const tolerance = (input.toleranceSeconds ?? MERCADOPAGO_SIGNATURE_TOLERANCE_SECONDS) * 1000;
  const nowMs = (input.now ?? new Date()).getTime();
  if (Math.abs(nowMs - tsMs) > tolerance) return { ok: false, reason: "expired" };
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Procesamiento de notificaciones

async function fetchPreapproval(client: MercadoPagoClient, preapprovalId: string): Promise<MercadoPagoPreapproval> {
  const pre = await mpRequest<MercadoPagoPreapproval>(client, "GET", `/preapproval/${encodeURIComponent(preapprovalId)}`);
  return { ...pre, id: pre.id ?? preapprovalId };
}

/** Guarda el estado real de una preaprobación ya leída de Mercado Pago. */
async function applyPreapproval(admin: Admin, pre: MercadoPagoPreapproval): Promise<string> {
  const id = pre.id;
  const existing = await findSubscriptionByProviderId(admin, id);

  // El dueño es `external_reference` (lo pone nuestro checkout). Nunca se cambia de dueño.
  const reference = isUuid(pre.external_reference) ? pre.external_reference : null;
  const userId = existing?.user_id ?? (reference && (await userExists(admin, reference)) ? reference : null);
  if (!userId) {
    console.warn("mercadopago_preapproval_unmatched", { preapproval: id });
    return "unmatched";
  }

  let planId = existing?.plan_id ?? "premium";
  let priceId = existing?.price_id ?? null;
  const amount = pre.auto_recurring?.transaction_amount;
  if (!priceId && typeof amount === "number") {
    const months = Number(pre.auto_recurring?.frequency ?? 1);
    const interval = pre.auto_recurring?.frequency_type === "years" || months >= 12 ? "year" : "month";
    const price = await findPriceByAmount(admin, {
      currency: (pre.auto_recurring?.currency_id ?? "PEN").toUpperCase(),
      amountCents: amountToCents(amount),
      interval,
    });
    if (price) {
      planId = price.plan_id;
      priceId = price.id;
    }
  }

  const mapped = mapMercadoPagoPreapproval(
    pre,
    existing ? { status: existing.status, currentPeriodEnd: existing.current_period_end, trialEnd: existing.trial_end } : null,
  );
  const outcome = await upsertSubscription(admin, {
    userId,
    provider: "mercadopago",
    providerSubscriptionId: id,
    providerCustomerId: pre.payer_id != null ? String(pre.payer_id) : null,
    planId,
    priceId,
    ...mapped,
  });
  if (outcome.result === "skipped") console.warn("mercadopago_preapproval_skipped", { preapproval: id, reason: outcome.reason });
  return outcome.result;
}

async function syncPreapproval(admin: Admin, client: MercadoPagoClient, preapprovalId: string): Promise<string> {
  return applyPreapproval(admin, await fetchPreapproval(client, preapprovalId));
}

/**
 * Confirmación activa al volver de Mercado Pago (`preapproval_id` en la URL de retorno), por si la
 * notificación se demora. Solo sincroniza si la preaprobación es de esta persona.
 */
export async function syncMercadoPagoPreapprovalForUser(
  admin: Admin,
  input: { preapprovalId: string; userId: string },
  client?: MercadoPagoClient,
): Promise<"synced" | "not_owner" | "unmatched" | "skipped"> {
  if (!client && !isMercadoPagoConfigured()) throw new BillingError(503, "BILLING_NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE);
  let pre: MercadoPagoPreapproval;
  try {
    pre = await fetchPreapproval(client ?? defaultClient(), input.preapprovalId);
  } catch (error) {
    if (error instanceof BillingError && error.code === "PROVIDER_NOT_FOUND") return "not_owner";
    throw error;
  }
  if (pre.external_reference !== input.userId) return "not_owner";
  const result = await applyPreapproval(admin, pre);
  return result === "saved" ? "synced" : result === "unmatched" ? "unmatched" : "skipped";
}

async function syncAuthorizedPayment(admin: Admin, client: MercadoPagoClient, authorizedPaymentId: string): Promise<string> {
  const ap = await mpRequest<MercadoPagoAuthorizedPayment>(client, "GET", `/authorized_payments/${encodeURIComponent(authorizedPaymentId)}`);
  const preapprovalId = ap.preapproval_id;
  if (!preapprovalId) return "ignored_no_preapproval";

  // Primero el estado real de la suscripción; luego el cobro.
  await syncPreapproval(admin, client, preapprovalId);
  const sub = await findSubscriptionByProviderId(admin, preapprovalId);
  if (!sub) return "unmatched";

  // "scheduled" es un cobro futuro: todavía no es un pago.
  if (ap.status === "scheduled" && !ap.payment?.status) return "ignored_scheduled";
  const status = ap.payment?.status
    ? mapMercadoPagoPaymentStatus(ap.payment.status)
    : ap.status === "processed"
      ? "succeeded"
      : ap.status === "recycling" || ap.status === "cancelled"
        ? "failed"
        : "pending";

  if (ap.status === "recycling") {
    // Mercado Pago está reintentando un cobro fallido: sin acceso hasta que se pague.
    await setSubscriptionStatus(admin, preapprovalId, "past_due", ["active"]);
  }

  const result = await recordPayment(admin, {
    userId: sub.user_id,
    provider: "mercadopago",
    providerPaymentId: String(ap.id),
    providerSubscriptionId: preapprovalId,
    amountCents: amountToCents(Number(ap.transaction_amount ?? 0)),
    currencyCode: (ap.currency_id ?? "PEN").toUpperCase(),
    status,
    paidAt: status === "succeeded" ? (ap.last_modified ?? ap.debit_date ?? new Date().toISOString()) : null,
  });
  if (result === "saved" && status === "failed") await notifyPaymentFailed(admin, sub.user_id);
  return result;
}

/** Procesa una notificación verificada consultando SIEMPRE el recurso real en Mercado Pago. */
export async function processMercadoPagoNotification(
  notification: { type: string; dataId: string },
  deps: { admin: Admin; client: MercadoPagoClient },
): Promise<string> {
  switch (notification.type) {
    case "subscription_preapproval":
    case "preapproval":
      return syncPreapproval(deps.admin, deps.client, notification.dataId);
    case "subscription_authorized_payment":
    case "authorized_payment":
      return syncAuthorizedPayment(deps.admin, deps.client, notification.dataId);
    default:
      return "ignored_type";
  }
}

export type MercadoPagoWebhookDeps = {
  admin: Admin;
  client: MercadoPagoClient;
  webhookSecret: string | undefined;
  now: Date;
};

/** Webhook de Mercado Pago: firma `x-signature` → idempotencia → consulta del recurso real. */
export async function handleMercadoPagoWebhook(request: Request, overrides: Partial<MercadoPagoWebhookDeps> = {}): Promise<Response> {
  const secret = "webhookSecret" in overrides ? overrides.webhookSecret : serverEnv().MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return billingError(503, "BILLING_NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE);

  const url = new URL(request.url);
  const raw = await request.text();
  let body: { id?: number | string; type?: string; topic?: string; action?: string; data?: { id?: number | string } } = {};
  if (raw.trim()) {
    try {
      body = JSON.parse(raw) as typeof body;
    } catch {
      return billingError(400, "INVALID_BODY", "Cuerpo inválido.");
    }
  }

  const queryDataId = url.searchParams.get("data.id");
  const bodyDataId = body.data?.id != null ? String(body.data.id) : null;
  const dataId = queryDataId ?? bodyDataId ?? url.searchParams.get("id");
  const type = body.type ?? url.searchParams.get("type") ?? body.topic ?? url.searchParams.get("topic") ?? "";
  const requestId = request.headers.get("x-request-id");

  const check = verifyMercadoPagoSignature({
    signatureHeader: request.headers.get("x-signature"),
    requestId,
    dataId: queryDataId ?? bodyDataId,
    secret,
    now: overrides.now,
  });
  if (!check.ok) return billingError(400, "INVALID_SIGNATURE", "La firma de Mercado Pago no es válida.");
  // El id procesado debe ser el firmado (si la URL y el cuerpo difieren, se rechaza).
  if (queryDataId && bodyDataId && queryDataId.toLowerCase() !== bodyDataId.toLowerCase()) {
    return billingError(400, "INVALID_SIGNATURE", "La notificación no coincide con su firma.");
  }
  if (!dataId || !type) return billingJson(200, { received: true, result: "ignored_incomplete" });

  let admin: Admin;
  let client: MercadoPagoClient;
  try {
    admin = overrides.admin ?? createSupabaseAdminClient();
    client = overrides.client ?? defaultClient();
  } catch {
    return billingError(503, "BILLING_NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE);
  }

  const eventId = body.id != null ? String(body.id) : `${type}:${dataId}:${requestId ?? "sin-request-id"}`;
  let claim: "claimed" | "duplicate";
  try {
    claim = await claimBillingEvent(admin, "mercadopago", eventId, `${type}${body.action ? `.${body.action}` : ""}`);
  } catch (error) {
    console.error("mercadopago_webhook_claim_failed", { reason: error instanceof Error ? error.message : "unknown" });
    return billingError(500, "WEBHOOK_FAILED", "No pudimos registrar el evento.");
  }
  if (claim === "duplicate") return billingJson(200, { received: true, duplicate: true });

  try {
    const result = await processMercadoPagoNotification({ type, dataId }, { admin, client });
    return billingJson(200, { received: true, result });
  } catch (error) {
    await releaseBillingEvent(admin, "mercadopago", eventId).catch(() => undefined);
    console.error("mercadopago_webhook_failed", { type, reason: error instanceof Error ? error.message : "unknown" });
    return billingError(500, "WEBHOOK_FAILED", "No pudimos procesar la notificación. Mercado Pago la reintentará.");
  }
}

export const mercadoPagoProvider: BillingProvider = {
  id: "mercadopago",
  label: "Mercado Pago (soles)",
  isConfigured: isMercadoPagoConfigured,
  createCheckout: (input) => createMercadoPagoCheckout(input),
  // Mercado Pago no tiene portal por sesión: la persona gestiona su suscripción en su cuenta.
  createPortalOrManageUrl: async () => MERCADOPAGO_MANAGE_URL,
  cancelSubscription: (subscription) => cancelMercadoPagoSubscription(subscription),
  handleWebhook: (request) => handleMercadoPagoWebhook(request),
};
