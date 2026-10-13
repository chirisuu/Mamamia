import { billingError, billingJson } from "@/lib/billing/http";
import { createCheckoutForUser } from "@/features/billing/server/checkout";
import { billingErrorResponse, getBillingSession, readJson, withinRateLimit } from "@/features/billing/server/http";
import { checkoutBodySchema } from "@/features/billing/schemas";

export const dynamic = "force-dynamic";

/**
 * POST { priceId, provider } → 200 { url } (página de pago del proveedor).
 * 401 sin sesión · 400 cuerpo o moneda inválidos · 404 precio inexistente/inactivo · 409 ya tiene
 * Premium · 429 demasiados intentos · 503 BILLING_NOT_CONFIGURED sin claves del proveedor.
 */
export async function POST(request: Request) {
  const session = await getBillingSession(request);
  if (session instanceof Response) return session;

  const parsed = checkoutBodySchema.safeParse(await readJson(request));
  if (!parsed.success) return billingError(400, "VALIDATION", "Elige un plan y un medio de pago válidos.");

  const allowed = await withinRateLimit(session.supabase, "billing:checkout", 10, 3600);
  if (allowed === null) return billingError(500, "RATE_LIMIT_ERROR", "No pudimos iniciar el pago. Inténtalo de nuevo.");
  if (!allowed) return billingError(429, "RATE_LIMITED", "Hiciste muchos intentos de pago seguidos. Espera unos minutos.");

  try {
    const result = await createCheckoutForUser({
      supabase: session.supabase,
      user: { id: session.user.id, email: session.user.email ?? null },
      body: parsed.data,
    });
    return billingJson(200, { url: result.url, provider: result.provider, trialDays: result.trialDays });
  } catch (error) {
    return billingErrorResponse(error, "billing_checkout_failed");
  }
}
