import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { getAppSettings, type FeatureFlags } from "@/lib/config/app-settings";
import { isMercadoPagoConfigured } from "./mercadopago";
import { isStripeConfigured } from "./stripe";
import type { BillingProviderId, PlanPriceRow, PlanRow } from "./types";

type Client = SupabaseClient<Database>;

export type ProviderAvailability = {
  id: BillingProviderId;
  /** Tiene clave de API y secreto del webhook. */
  configured: boolean;
  /** No está apagado por el admin (`feature_flags.payments_<proveedor>`). */
  enabled: boolean;
  /** Se puede cobrar con él ahora mismo. */
  available: boolean;
  /** Código y motivo cuando no está disponible (para la UI y la API). */
  reason: { code: "BILLING_NOT_CONFIGURED" | "PROVIDER_DISABLED"; message: string } | null;
};

export const PROVIDER_FLAG: Record<BillingProviderId, string> = {
  stripe: "payments_stripe",
  mercadopago: "payments_mercadopago",
};

/** Disponibilidad de un proveedor (pura: credenciales + bandera del admin). */
export function providerAvailability(id: BillingProviderId, configured: boolean, flags: FeatureFlags): ProviderAvailability {
  // Solo un `false` explícito lo apaga: sin bandera, manda la configuración.
  const enabled = flags[PROVIDER_FLAG[id]] !== false;
  if (!configured) {
    return {
      id,
      configured,
      enabled,
      available: false,
      reason: { code: "BILLING_NOT_CONFIGURED", message: "Pagos pendientes de configurar." },
    };
  }
  if (!enabled) {
    return {
      id,
      configured,
      enabled,
      available: false,
      reason: { code: "PROVIDER_DISABLED", message: "Este medio de pago no está disponible por ahora." },
    };
  }
  return { id, configured, enabled, available: true, reason: null };
}

/** Estado real de cada proveedor de pago. */
export async function getProvidersAvailability(): Promise<Record<BillingProviderId, ProviderAvailability>> {
  const { featureFlags } = await getAppSettings();
  return {
    stripe: providerAvailability("stripe", isStripeConfigured(), featureFlags),
    mercadopago: providerAvailability("mercadopago", isMercadoPagoConfigured(), featureFlags),
  };
}

export type BillingCatalog = {
  plans: PlanRow[];
  /** Precios activos, ordenados por plan, intervalo y moneda. */
  prices: PlanPriceRow[];
};

/**
 * Planes y precios activos (lectura pública por RLS). Lanza si la BD falla: la página muestra el
 * error en vez de inventar precios.
 */
export async function getBillingCatalog(supabase: Client): Promise<BillingCatalog> {
  const [plans, prices] = await Promise.all([
    supabase.from("plans").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
    supabase
      .from("plan_prices")
      .select("*")
      .eq("is_active", true)
      .order("plan_id", { ascending: true })
      .order("interval", { ascending: true })
      .order("currency_code", { ascending: true }),
  ]);
  if (plans.error) throw new Error(`plans_read_failed:${plans.error.code ?? "unknown"}`);
  if (prices.error) throw new Error(`prices_read_failed:${prices.error.code ?? "unknown"}`);
  return { plans: plans.data ?? [], prices: prices.data ?? [] };
}
