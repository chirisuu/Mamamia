import { billingJson } from "@/lib/billing/http";
import { manageUrlForUser } from "@/features/billing/server/manage";
import { billingErrorResponse, getBillingSession } from "@/features/billing/server/http";

export const dynamic = "force-dynamic";

/**
 * POST → 200 { url } para gestionar el medio de pago (Billing Portal de Stripe o panel de Mercado
 * Pago). 401 sin sesión · 404 sin suscripción · 503 proveedor sin configurar.
 */
export async function POST(request: Request) {
  const session = await getBillingSession(request);
  if (session instanceof Response) return session;
  try {
    const url = await manageUrlForUser({ supabase: session.supabase, userId: session.user.id });
    return billingJson(200, { url });
  } catch (error) {
    return billingErrorResponse(error, "billing_portal_failed");
  }
}
