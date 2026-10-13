import { z } from "zod";

/** Proveedores con los que se puede pagar (mismo enum que `billing_provider`). */
export const billingProviderSchema = z.enum(["stripe", "mercadopago"]);

/** POST /api/billing/checkout */
export const checkoutBodySchema = z.object({
  priceId: z.uuid("Elige un plan válido."),
  provider: billingProviderSchema,
});
export type CheckoutBody = z.infer<typeof checkoutBodySchema>;

/**
 * POST /api/billing/confirm — referencias que el proveedor agrega a la URL de retorno.
 * Stripe: `session_id` (cs_…). Mercado Pago: `preapproval_id`.
 */
export const confirmBodySchema = z.object({
  sessionId: z
    .string()
    .regex(/^cs_[A-Za-z0-9_]{8,250}$/)
    .optional(),
  preapprovalId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{6,64}$/)
    .optional(),
});
export type ConfirmBody = z.infer<typeof confirmBodySchema>;
