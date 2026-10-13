/**
 * Interruptores (`app_settings.feature_flags`) con significado conocido. Puro: sirve en cliente y
 * servidor. Las claves de pagos son las mismas que lee `src/lib/billing/catalog.ts`
 * (`PROVIDER_FLAG`); un test comprueba que no se desalineen.
 */

export type FlagEntry = { key: string; enabled: boolean };

export const PAYMENT_FLAGS = [
  {
    key: "payments_stripe",
    provider: "stripe",
    label: "Tarjeta internacional (Stripe)",
    hint: "Cobros con tarjeta en dólares.",
  },
  {
    key: "payments_mercadopago",
    provider: "mercadopago",
    label: "Mercado Pago",
    hint: "Cobros en soles.",
  },
] as const;

export type PaymentFlagKey = (typeof PAYMENT_FLAGS)[number]["key"];
export const PAYMENT_FLAG_KEYS: readonly string[] = PAYMENT_FLAGS.map((f) => f.key);

/** Claves que hoy lee alguna parte de la app. El resto se guarda, pero no cambia nada todavía. */
export const FLAGS_IN_USE: Record<string, string> = {
  payments_stripe: "Precios, Premium y checkout",
  payments_mercadopago: "Precios, Premium y checkout",
};

export function isPaymentFlag(key: string): boolean {
  return PAYMENT_FLAG_KEYS.includes(key);
}

/**
 * Asegura que los interruptores de pagos estén en la lista. Sin bandera, el proveedor está
 * habilitado (solo un `false` explícito lo apaga, igual que `providerAvailability`).
 */
export function ensurePaymentFlags(flags: readonly FlagEntry[]): FlagEntry[] {
  const out = [...flags];
  for (const f of PAYMENT_FLAGS) {
    if (!out.some((x) => x.key === f.key)) out.push({ key: f.key, enabled: true });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

/** Claves cuyo valor cambió (para la auditoría: solo nombres, nunca valores sensibles). */
export function changedFlagKeys(before: Record<string, unknown>, after: Record<string, boolean>): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((k) => before[k] !== after[k]).sort();
}
