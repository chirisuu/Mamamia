import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { getAppSettings } from "@/lib/config/app-settings";
import { siteUrl } from "@/lib/env";
import { getProvidersAvailability } from "@/lib/billing/catalog";
import { NOT_CONFIGURED_MESSAGE } from "@/lib/billing/http";
import { priceSupportsProvider, trialDaysFor } from "@/lib/billing/pricing";
import { getBillingProvider } from "@/lib/billing/provider";
import { blocksNewCheckout } from "@/lib/billing/status";
import { BillingError } from "@/lib/billing/types";
import { getBillingOverview } from "../queries";
import type { CheckoutBody } from "../schemas";

type Client = SupabaseClient<Database>;

export type CheckoutResult = { url: string; provider: CheckoutBody["provider"]; trialDays: number };

/** URLs de retorno. Stripe reemplaza `{CHECKOUT_SESSION_ID}`; Mercado Pago agrega `preapproval_id`. */
export function checkoutReturnUrls(provider: CheckoutBody["provider"], base: string = siteUrl()) {
  const root = base.replace(/\/+$/, "");
  return {
    successUrl:
      provider === "stripe"
        ? `${root}/app/premium/gracias?provider=stripe&session_id={CHECKOUT_SESSION_ID}`
        : `${root}/app/premium/gracias?provider=mercadopago`,
    cancelUrl: `${root}/app/premium?cancelado=1`,
  };
}

/**
 * Crea la sesión de pago de la persona. Valida en el servidor: proveedor configurado y habilitado,
 * precio activo y cobrable con ese proveedor, que no tenga ya Premium, y si le corresponde prueba.
 * Lanza `BillingError` con el status HTTP y el código para la UI.
 */
export async function createCheckoutForUser(params: {
  supabase: Client;
  user: { id: string; email: string | null };
  body: CheckoutBody;
}): Promise<CheckoutResult> {
  const { supabase, user, body } = params;

  const availability = (await getProvidersAvailability())[body.provider];
  if (!availability.available) {
    const code = availability.reason?.code ?? "BILLING_NOT_CONFIGURED";
    throw new BillingError(503, code, code === "BILLING_NOT_CONFIGURED" ? NOT_CONFIGURED_MESSAGE : availability.reason!.message);
  }

  const { data: price, error: priceError } = await supabase.from("plan_prices").select("*").eq("id", body.priceId).maybeSingle();
  if (priceError) throw new Error(`price_read_failed:${priceError.code ?? "unknown"}`);
  if (!price || !price.is_active) throw new BillingError(404, "PRICE_NOT_FOUND", "Ese precio ya no está disponible. Recarga la página.");

  const { data: plan, error: planError } = await supabase.from("plans").select("id, name, is_active").eq("id", price.plan_id).maybeSingle();
  if (planError) throw new Error(`plan_read_failed:${planError.code ?? "unknown"}`);
  if (!plan || !plan.is_active || price.amount_cents <= 0) {
    throw new BillingError(400, "PRICE_NOT_PURCHASABLE", "Ese plan no se puede contratar.");
  }

  if (!priceSupportsProvider(price, body.provider)) {
    if (body.provider === "mercadopago") {
      throw new BillingError(400, "CURRENCY_NOT_SUPPORTED", "Mercado Pago solo cobra en soles. Elige el precio en soles.");
    }
    throw new BillingError(503, "PRICE_NOT_CONFIGURED", "Este precio todavía no está configurado en Stripe.");
  }

  const overview = await getBillingOverview(supabase, user.id, { paymentsLimit: 10 });
  const blocking = overview.subscriptions.find((s) => blocksNewCheckout(s));
  if (blocking) {
    throw new BillingError(
      409,
      "ALREADY_SUBSCRIBED",
      blocking.status === "past_due"
        ? "Tienes un cobro pendiente en tu suscripción actual. Resuélvelo desde Suscripción antes de contratar otra."
        : "Ya tienes Premium. Puedes ver o gestionar tu plan en Suscripción.",
    );
  }

  const settings = await getAppSettings();
  const trialDays = trialDaysFor(price, settings.defaultTrialDays, overview.trialEligible);
  // Reutiliza el cliente de Stripe de una suscripción anterior (evita clientes duplicados).
  const customerId =
    body.provider === "stripe"
      ? (overview.subscriptions.find((s) => s.provider === "stripe" && s.provider_customer_id)?.provider_customer_id ?? null)
      : null;

  const session = await getBillingProvider(body.provider).createCheckout({
    user: { id: user.id, email: user.email ?? null },
    price,
    planName: plan.name,
    appName: settings.appName,
    trialDays,
    customerId,
    ...checkoutReturnUrls(body.provider),
  });
  return { url: session.url, provider: body.provider, trialDays };
}
