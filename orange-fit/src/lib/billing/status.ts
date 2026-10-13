import type { SubscriptionStatus } from "./types";

/** Estados de suscripción de Stripe → `subscription_status`. Lo desconocido no da acceso. */
export function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      // Ambos son cobros fallidos: sin acceso Premium hasta que se pague.
      return "past_due";
    case "canceled":
      return "canceled";
    case "incomplete":
      return "incomplete";
    case "incomplete_expired":
      return "expired";
    case "paused":
      return "paused";
    default:
      return "incomplete";
  }
}

/** Estados terminales: una suscripción así no vuelve a activarse (evita que un evento viejo la reviva). */
export function isTerminalStatus(status: SubscriptionStatus): boolean {
  return status === "canceled" || status === "expired";
}

/** Suscripción que todavía puede cobrar (la que hay que cancelar antes de borrar la cuenta). */
export function isBillableStatus(status: SubscriptionStatus): boolean {
  return status === "trialing" || status === "active" || status === "past_due";
}

// ---------------------------------------------------------------------------------------------
// Mercado Pago (/preapproval)

export type MercadoPagoPreapproval = {
  id: string;
  status?: string | null;
  external_reference?: string | null;
  payer_id?: number | string | null;
  payer_email?: string | null;
  date_created?: string | null;
  last_modified?: string | null;
  next_payment_date?: string | null;
  init_point?: string | null;
  auto_recurring?: {
    frequency?: number | null;
    frequency_type?: string | null;
    transaction_amount?: number | null;
    currency_id?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    free_trial?: { frequency?: number | null; frequency_type?: string | null } | null;
  } | null;
  summarized?: {
    charged_quantity?: number | null;
    last_charged_date?: string | null;
  } | null;
};

export type MappedPreapproval = {
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
};

function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function addPeriod(startIso: string, frequency: number, type: string | null | undefined): string {
  const d = new Date(startIso);
  if (type === "months") d.setUTCMonth(d.getUTCMonth() + frequency);
  else if (type === "years") d.setUTCFullYear(d.getUTCFullYear() + frequency);
  else d.setUTCDate(d.getUTCDate() + frequency);
  return d.toISOString();
}

/** Fin de la prueba gratis de una preaprobación (null si no tiene). */
export function preapprovalTrialEnd(pre: MercadoPagoPreapproval): string | null {
  const trial = pre.auto_recurring?.free_trial;
  const frequency = Number(trial?.frequency ?? 0);
  if (!trial || !Number.isFinite(frequency) || frequency <= 0) return null;
  const start = toIso(pre.auto_recurring?.start_date) ?? toIso(pre.date_created);
  if (!start) return null;
  return addPeriod(start, frequency, trial.frequency_type);
}

/**
 * Estado de una preaprobación de Mercado Pago → columnas de `subscriptions`.
 *
 * Mercado Pago no tiene "cancelar al final del periodo": cancelar detiene los cobros de inmediato.
 * Para no quitar lo ya pagado, si la suscripción tenía acceso (`previous.status` trialing/active)
 * y el periodo pagado (o la prueba) sigue vigente, se conserva el estado con
 * `cancel_at_period_end = true`; `is_premium()` deja de dar acceso sola al pasar esa fecha.
 */
export function mapMercadoPagoPreapproval(
  pre: MercadoPagoPreapproval,
  previous: { status: SubscriptionStatus; currentPeriodEnd: string | null; trialEnd: string | null } | null,
  now: Date = new Date(),
): MappedPreapproval {
  const trialEnd = preapprovalTrialEnd(pre);
  const charged = Number(pre.summarized?.charged_quantity ?? 0) || 0;
  const nowMs = now.getTime();
  const inTrial = Boolean(trialEnd && charged === 0 && new Date(trialEnd).getTime() > nowMs);
  const currentPeriodEnd = toIso(pre.next_payment_date) ?? previous?.currentPeriodEnd ?? null;
  const currentPeriodStart =
    toIso(pre.summarized?.last_charged_date) ?? toIso(pre.auto_recurring?.start_date) ?? toIso(pre.date_created);
  const base = { currentPeriodStart, currentPeriodEnd, trialEnd, cancelAtPeriodEnd: false, canceledAt: null as string | null };

  switch (pre.status) {
    case "authorized":
      return { ...base, status: inTrial ? "trialing" : "active" };
    case "pending":
      return { ...base, status: "incomplete" };
    case "paused":
      return { ...base, status: "paused" };
    case "finished":
      return { ...base, status: "expired" };
    case "cancelled": {
      const canceledAt = toIso(pre.last_modified) ?? now.toISOString();
      if (previous && (previous.status === "trialing" || previous.status === "active")) {
        const accessEnd =
          previous.status === "trialing" ? (previous.trialEnd ?? trialEnd ?? currentPeriodEnd) : (currentPeriodEnd ?? previous.currentPeriodEnd);
        if (accessEnd && new Date(accessEnd).getTime() > nowMs) {
          return {
            ...base,
            status: previous.status,
            trialEnd: previous.trialEnd ?? trialEnd,
            currentPeriodEnd: previous.status === "active" ? accessEnd : currentPeriodEnd,
            cancelAtPeriodEnd: true,
            canceledAt,
          };
        }
      }
      return { ...base, status: "canceled", canceledAt };
    }
    default:
      return { ...base, status: "incomplete" };
  }
}

/** Estado de un cobro de Mercado Pago (`payment.status`) → `payments.status`. */
export function mapMercadoPagoPaymentStatus(status: string | null | undefined): "succeeded" | "pending" | "failed" | "refunded" {
  switch (status) {
    case "approved":
    case "processed":
      return "succeeded";
    case "refunded":
    case "charged_back":
      return "refunded";
    case "rejected":
    case "cancelled":
      return "failed";
    default:
      return "pending";
  }
}

// ---------------------------------------------------------------------------------------------
// Presentación (UI)

export type SubscriptionView = {
  hasAccess: boolean;
  /** Título corto del estado. */
  label: string;
  /** Tono visual (el color nunca es la única señal: siempre va con `label`). */
  tone: "success" | "info" | "warning" | "neutral";
  /** Fecha (ISO) del próximo cobro, si va a haberlo. */
  nextChargeAt: string | null;
  /** Fecha (ISO) en que termina el acceso si no se renueva (cancelada al final del periodo). */
  accessEndsAt: string | null;
  /** Fin de la prueba gratis, si está en prueba. */
  trialEndsAt: string | null;
  /** Se puede cancelar desde la app (sigue cobrando y no está ya programada la cancelación). */
  canCancel: boolean;
};

type SubLike = {
  status: SubscriptionStatus;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
};

/** Cómo mostrar una suscripción: mismo criterio de vigencia que `is_premium()` en la BD. */
export function describeSubscription(sub: SubLike, now: Date = new Date()): SubscriptionView {
  const nowMs = now.getTime();
  const future = (iso: string | null) => iso == null || new Date(iso).getTime() > nowMs;
  const empty = { nextChargeAt: null, accessEndsAt: null, trialEndsAt: null };

  if (sub.status === "trialing") {
    const end = sub.trial_end ?? sub.current_period_end;
    if (!future(end)) {
      return { ...empty, hasAccess: false, label: sub.cancel_at_period_end ? "Prueba finalizada" : "Confirmando tu primer cobro", tone: "neutral", canCancel: false };
    }
    return sub.cancel_at_period_end
      ? { ...empty, hasAccess: true, label: "Prueba gratis (no se renovará)", tone: "info", trialEndsAt: end, accessEndsAt: end, canCancel: false }
      : { ...empty, hasAccess: true, label: "Prueba gratis", tone: "success", trialEndsAt: end, nextChargeAt: end, canCancel: true };
  }
  if (sub.status === "active") {
    const end = sub.current_period_end;
    if (!future(end)) {
      return { ...empty, hasAccess: false, label: sub.cancel_at_period_end ? "Finalizada" : "Confirmando la renovación", tone: "neutral", canCancel: false };
    }
    return sub.cancel_at_period_end
      ? { ...empty, hasAccess: true, label: "Activa (no se renovará)", tone: "info", accessEndsAt: end, canCancel: false }
      : { ...empty, hasAccess: true, label: "Activa", tone: "success", nextChargeAt: end, canCancel: true };
  }
  switch (sub.status) {
    case "past_due":
      return { ...empty, hasAccess: false, label: "Pago pendiente", tone: "warning", canCancel: !sub.cancel_at_period_end };
    case "incomplete":
      return { ...empty, hasAccess: false, label: "Pago sin completar", tone: "warning", canCancel: false };
    case "paused":
      return { ...empty, hasAccess: false, label: "En pausa", tone: "neutral", canCancel: false };
    case "canceled":
      return { ...empty, hasAccess: false, label: "Cancelada", tone: "neutral", canCancel: false };
    case "expired":
      return { ...empty, hasAccess: false, label: "Vencida", tone: "neutral", canCancel: false };
    default:
      return { ...empty, hasAccess: false, label: "Sin suscripción", tone: "neutral", canCancel: false };
  }
}

// ---------------------------------------------------------------------------------------------
// Selección y elegibilidad

type SubForPick = SubLike & { created_at: string };

/**
 * La suscripción que importa ahora: la que da acceso; si no hay, la que tiene un cobro pendiente;
 * si no, la más reciente. Así una suscripción vieja cancelada no tapa a la vigente.
 */
export function pickCurrentSubscription<T extends SubForPick>(subs: readonly T[], now: Date = new Date()): T | null {
  if (subs.length === 0) return null;
  const rank = (s: T) => (describeSubscription(s, now).hasAccess ? 0 : s.status === "past_due" ? 1 : 2);
  return [...subs].sort((a, b) => rank(a) - rank(b) || b.created_at.localeCompare(a.created_at))[0] ?? null;
}

/** ¿Bloquea una suscripción nueva? (ya tiene acceso o un cobro pendiente que resolver). */
export function blocksNewCheckout(sub: SubLike, now: Date = new Date()): boolean {
  return describeSubscription(sub, now).hasAccess || sub.status === "past_due";
}

/**
 * La prueba gratis es solo para quien nunca tuvo Premium: sin pruebas previas, sin suscripciones
 * que hayan llegado a activarse y sin cobros exitosos. Un checkout abandonado (`incomplete`) no cuenta.
 */
export function isTrialEligible(
  subs: ReadonlyArray<Pick<SubLike, "status" | "trial_end">>,
  hasSucceededPayment: boolean,
): boolean {
  if (hasSucceededPayment) return false;
  return !subs.some(
    (s) => s.trial_end != null || ["trialing", "active", "past_due", "canceled", "paused"].includes(s.status),
  );
}
