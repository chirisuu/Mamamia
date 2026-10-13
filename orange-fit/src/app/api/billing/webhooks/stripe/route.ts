import { handleStripeWebhook } from "@/lib/billing/stripe";

export const dynamic = "force-dynamic";

/**
 * Webhook de Stripe (sin sesión: solo firma). Verifica `stripe-signature` con el cuerpo crudo y
 * STRIPE_WEBHOOK_SECRET (400 si no coincide), registra el evento en `billing_events` (idempotencia)
 * y actualiza `subscriptions`/`payments` con service role.
 */
export async function POST(request: Request) {
  return handleStripeWebhook(request);
}
