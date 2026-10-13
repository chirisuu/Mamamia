import { revalidatePath } from "next/cache";
import { billingJson } from "@/lib/billing/http";
import { cancelSubscriptionForUser } from "@/features/billing/server/manage";
import { billingErrorResponse, getBillingSession } from "@/features/billing/server/http";

export const dynamic = "force-dynamic";

/**
 * POST → cancela la renovación (al final del periodo) de la suscripción vigente.
 * 200 { subscription } · 401 sin sesión · 404 nada que cancelar · 409 ya cancelada ·
 * 503 proveedor sin configurar · 502 el proveedor falló.
 */
export async function POST(request: Request) {
  const session = await getBillingSession(request);
  if (session instanceof Response) return session;
  try {
    const result = await cancelSubscriptionForUser({ supabase: session.supabase, userId: session.user.id });
    revalidatePath("/app/perfil/suscripcion");
    revalidatePath("/app/perfil");
    return billingJson(200, { subscription: result.view, provider: result.provider });
  } catch (error) {
    return billingErrorResponse(error, "billing_cancel_failed");
  }
}
