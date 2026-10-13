import { handleMercadoPagoWebhook } from "@/lib/billing/mercadopago";

export const dynamic = "force-dynamic";

/**
 * Webhook de Mercado Pago (sin sesión: solo firma). Verifica `x-signature` (HMAC-SHA256 con
 * MERCADOPAGO_WEBHOOK_SECRET, 400 si falla), aplica idempotencia y consulta SIEMPRE el recurso real
 * (/preapproval o /authorized_payments) antes de escribir con service role.
 */
export async function POST(request: Request) {
  return handleMercadoPagoWebhook(request);
}
