import { FEATURE_LABELS, PREMIUM_FEATURES, type PremiumFeature } from "@/lib/billing/features";
import type { BillingInterval, BillingProviderId, PaymentStatus } from "@/lib/billing/types";
import { formatCents } from "@/lib/format";

/** Funciones del plan gratis (claves de `plans.features` que no son de pago). */
export const BASE_FEATURE_LABELS: Record<string, string> = {
  manual_logging: "Registro manual, búsqueda y código de barras",
  dashboard: "Panel diario con tu meta",
  macros: "Calorías y macros calculados para ti",
  water: "Registro de agua",
  basic_tracking: "Peso, medidas y progreso",
};

export function isPremiumFeature(code: string): code is PremiumFeature {
  return (PREMIUM_FEATURES as readonly string[]).includes(code);
}

/** Nombre visible de una función de un plan (null si la clave no se conoce: no se muestra). */
export function featureLabel(code: string): string | null {
  if (isPremiumFeature(code)) return FEATURE_LABELS[code];
  return BASE_FEATURE_LABELS[code] ?? null;
}

const AI_LIMIT_TEXT: Record<string, (n: number) => string> = {
  photo: (n) => `${n} registros con foto al mes`,
  voice: (n) => `${n} registros por voz al mes`,
  text: (n) => `${n} registros escribiendo al mes`,
  chat: (n) => `${n} mensajes al asistente al mes`,
};

/** Límites de IA de un plan en frases cortas (solo los que son > 0). */
export function aiLimitLines(limits: unknown): string[] {
  if (!limits || typeof limits !== "object" || Array.isArray(limits)) return [];
  const out: string[] = [];
  for (const key of ["photo", "voice", "text", "chat"]) {
    const value = (limits as Record<string, unknown>)[key];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) out.push(AI_LIMIT_TEXT[key]!(Math.floor(value)));
  }
  return out;
}

export const PROVIDER_LABELS: Record<BillingProviderId, { name: string; detail: string; secure: string }> = {
  stripe: {
    name: "Tarjeta internacional",
    detail: "Visa, Mastercard o Amex. Se cobra en dólares a través de Stripe.",
    secure: "Stripe",
  },
  mercadopago: {
    name: "Mercado Pago",
    detail: "En soles, con tarjeta o tu cuenta de Mercado Pago.",
    secure: "Mercado Pago",
  },
};

export const INTERVAL_LABELS: Record<BillingInterval, { name: string; per: string; short: string }> = {
  month: { name: "Mensual", per: "al mes", short: "/mes" },
  year: { name: "Anual", per: "al año", short: "/año" },
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  succeeded: "Pagado",
  pending: "Pendiente",
  failed: "No se pudo cobrar",
  refunded: "Reembolsado",
};

/** "S/ 29.90 al mes", "US$ 54.99 al año". */
export function formatPriceLine(amountCents: number, currency: string, interval: BillingInterval): string {
  return `${formatCents(amountCents, currency)} ${INTERVAL_LABELS[interval].per}`;
}

/** Fecha de un instante en la zona horaria de la persona: "13 de octubre de 2026". */
export function formatBillingDate(iso: string | null | undefined, timeZone = "America/Lima"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric", timeZone });
  } catch {
    return d.toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Lima" });
  }
}
