import { billingError, billingJson } from "@/lib/billing/http";
import { confirmCheckoutForUser } from "@/features/billing/server/confirm";
import { billingErrorResponse, getBillingSession, readJson } from "@/features/billing/server/http";
import { confirmBodySchema } from "@/features/billing/schemas";

export const dynamic = "force-dynamic";

/**
 * POST { sessionId? | preapprovalId? } → 200 { state: "confirmed" | "payment_issue" | "pending", label }.
 * Lo consulta /app/premium/gracias mientras espera la confirmación real del pago.
 */
export async function POST(request: Request) {
  const session = await getBillingSession(request);
  if (session instanceof Response) return session;
  const parsed = confirmBodySchema.safeParse((await readJson(request)) ?? {});
  if (!parsed.success) return billingError(400, "VALIDATION", "Referencia de pago inválida.");
  try {
    const result = await confirmCheckoutForUser({ supabase: session.supabase, userId: session.user.id, body: parsed.data });
    return billingJson(200, result);
  } catch (error) {
    return billingErrorResponse(error, "billing_confirm_failed");
  }
}
