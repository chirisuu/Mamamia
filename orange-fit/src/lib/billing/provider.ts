import "server-only";
import { mercadoPagoProvider } from "./mercadopago";
import { stripeProvider } from "./stripe";
import type { BillingProviderId, PlanPriceRow, SubscriptionRow, SubscriptionSnapshot } from "./types";

export type CheckoutInput = {
  user: { id: string; email: string | null };
  price: PlanPriceRow;
  /** Nombre visible del plan (p. ej. "Premium"), para el detalle del cobro. */
  planName: string;
  appName: string;
  /** Días de prueba ya decididos por el servidor (0 = sin prueba). */
  trialDays: number;
  /** Cliente del proveedor de una suscripción anterior (evita duplicar clientes en Stripe). */
  customerId: string | null;
  successUrl: string;
  cancelUrl: string;
};

export type CheckoutSession = { url: string; providerReference: string | null };

/**
 * Adaptador de un proveedor de pagos. Los métodos lanzan `BillingError` con status HTTP y código
 * (503 BILLING_NOT_CONFIGURED sin credenciales, 502 PROVIDER_ERROR si el proveedor falla).
 */
export interface BillingProvider {
  id: BillingProviderId;
  /** Nombre para la UI. */
  label: string;
  /** Tiene las credenciales necesarias (clave de API + secreto del webhook). */
  isConfigured(): boolean;
  /** Crea la sesión de pago y devuelve la URL a la que se redirige a la persona. */
  createCheckout(input: CheckoutInput): Promise<CheckoutSession>;
  /** URL para gestionar el medio de pago (Stripe: Billing Portal; Mercado Pago: su panel). */
  createPortalOrManageUrl?(input: { subscription: SubscriptionRow; returnUrl: string }): Promise<string>;
  /** Cancela en el proveedor (al final del periodo cuando el proveedor lo permite) y devuelve el estado a guardar. */
  cancelSubscription(subscription: SubscriptionRow): Promise<SubscriptionSnapshot>;
  /** Verifica la firma, aplica idempotencia y procesa el evento. Siempre devuelve una respuesta HTTP. */
  handleWebhook(request: Request): Promise<Response>;
}

const PROVIDERS: Record<BillingProviderId, BillingProvider> = {
  stripe: stripeProvider,
  mercadopago: mercadoPagoProvider,
};

export function getBillingProvider(id: BillingProviderId): BillingProvider {
  return PROVIDERS[id];
}
