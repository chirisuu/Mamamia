import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { isMercadoPagoConfigured, syncMercadoPagoPreapprovalForUser } from "@/lib/billing/mercadopago";
import { isStripeConfigured, syncStripeCheckoutForUser } from "@/lib/billing/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBillingOverview } from "../queries";
import type { ConfirmBody } from "../schemas";
import { withinRateLimit } from "./http";

type Client = SupabaseClient<Database>;

export type ConfirmState = "confirmed" | "payment_issue" | "pending";

export type ConfirmResult = {
  state: ConfirmState;
  /** Texto corto del estado real (null si aún no hay suscripción). */
  label: string | null;
};

async function readState(supabase: Client, userId: string): Promise<ConfirmResult> {
  const overview = await getBillingOverview(supabase, userId, { paymentsLimit: 1 });
  if (overview.view?.hasAccess) return { state: "confirmed", label: overview.view.label };
  if (overview.current?.status === "past_due") return { state: "payment_issue", label: overview.view?.label ?? null };
  return { state: "pending", label: overview.view?.label ?? null };
}

/**
 * ¿Ya está confirmado el pago? Lee el estado REAL guardado. Si todavía no hay acceso y la URL de
 * retorno trajo la referencia del proveedor, consulta al proveedor (solo si es de esta persona) y
 * sincroniza: así no depende únicamente de que el webhook llegue rápido. Nunca inventa un "listo".
 */
export async function confirmCheckoutForUser(params: { supabase: Client; userId: string; body: ConfirmBody }): Promise<ConfirmResult> {
  const { supabase, userId, body } = params;
  const before = await readState(supabase, userId);
  if (before.state === "confirmed") return before;

  const wantsStripe = Boolean(body.sessionId) && isStripeConfigured();
  const wantsMp = Boolean(body.preapprovalId) && isMercadoPagoConfigured();
  if (!wantsStripe && !wantsMp) return before;

  // La página consulta cada pocos segundos: se limita la consulta al proveedor, no la lectura.
  const allowed = await withinRateLimit(supabase, "billing:confirm", 40, 600);
  if (!allowed) return before;

  let admin: Client;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return before;
  }
  try {
    if (wantsStripe) await syncStripeCheckoutForUser(admin, { sessionId: body.sessionId!, userId });
    else await syncMercadoPagoPreapprovalForUser(admin, { preapprovalId: body.preapprovalId!, userId });
  } catch (error) {
    // Si el proveedor no responde, seguimos esperando al webhook.
    console.warn("billing_confirm_sync_failed", { reason: error instanceof Error ? error.name : "unknown" });
    return before;
  }
  return readState(supabase, userId);
}
