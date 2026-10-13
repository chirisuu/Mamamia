import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { siteUrl } from "@/lib/env";
import { NOT_CONFIGURED_MESSAGE } from "@/lib/billing/http";
import { getBillingProvider } from "@/lib/billing/provider";
import { describeSubscription, type SubscriptionView } from "@/lib/billing/status";
import { upsertSubscription } from "@/lib/billing/sync";
import { BillingError, type SubscriptionRow } from "@/lib/billing/types";
import { createNotification } from "@/lib/notifications/notify";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBillingOverview } from "../queries";

type Client = SupabaseClient<Database>;

function adminOrThrow(): Client {
  try {
    return createSupabaseAdminClient();
  } catch {
    throw new BillingError(503, "BILLING_NOT_CONFIGURED", "Falta la clave de servicio en el servidor: aún no podemos cambiar suscripciones.");
  }
}

/**
 * Cancela la renovación de la suscripción vigente de la persona (al final del periodo cuando el
 * proveedor lo permite). El cambio se pide al proveedor y se guarda con service role; el webhook
 * posterior lo confirma (idempotente).
 */
export async function cancelSubscriptionForUser(params: { supabase: Client; userId: string }): Promise<{
  view: SubscriptionView;
  provider: SubscriptionRow["provider"];
}> {
  const overview = await getBillingOverview(params.supabase, params.userId, { paymentsLimit: 1 });
  const now = new Date();
  const target =
    (overview.current && describeSubscription(overview.current, now).canCancel ? overview.current : null) ??
    overview.subscriptions.find((s) => describeSubscription(s, now).canCancel) ??
    null;
  if (!target) {
    if (overview.current?.cancel_at_period_end && overview.view?.hasAccess) {
      throw new BillingError(409, "ALREADY_CANCELED", "Tu suscripción ya está cancelada: no se renovará.");
    }
    throw new BillingError(404, "NO_ACTIVE_SUBSCRIPTION", "No tienes una suscripción que se pueda cancelar.");
  }

  const provider = getBillingProvider(target.provider);
  if (!provider.isConfigured()) throw new BillingError(503, "BILLING_NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE);
  const admin = adminOrThrow();

  const snapshot = await provider.cancelSubscription(target);
  const outcome = await upsertSubscription(admin, snapshot);
  if (outcome.result === "skipped") console.warn("billing_cancel_upsert_skipped", { reason: outcome.reason });

  const view = describeSubscription({
    status: snapshot.status,
    current_period_end: snapshot.currentPeriodEnd,
    trial_end: snapshot.trialEnd,
    cancel_at_period_end: snapshot.cancelAtPeriodEnd,
  });
  await createNotification(admin, params.userId, {
    type: "billing.canceled",
    title: "Cancelaste la renovación de Premium",
    body: view.hasAccess
      ? "No se harán más cobros. Mantienes Premium hasta el final del periodo que ya pagaste."
      : "Tu suscripción quedó cancelada y no se harán más cobros.",
    url: "/app/perfil/suscripcion",
  });
  return { view, provider: target.provider };
}

/**
 * URL para gestionar el medio de pago: Billing Portal de Stripe (sesión de un solo uso) o el panel
 * de suscripciones de Mercado Pago.
 */
export async function manageUrlForUser(params: { supabase: Client; userId: string }): Promise<string> {
  const overview = await getBillingOverview(params.supabase, params.userId, { paymentsLimit: 1 });
  const sub = overview.current;
  if (!sub) throw new BillingError(404, "NO_SUBSCRIPTION", "Todavía no tienes una suscripción.");
  const provider = getBillingProvider(sub.provider);
  if (!provider.isConfigured() || !provider.createPortalOrManageUrl) {
    throw new BillingError(503, "BILLING_NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE);
  }
  return provider.createPortalOrManageUrl({ subscription: sub, returnUrl: `${siteUrl().replace(/\/+$/, "")}/app/perfil/suscripcion` });
}
