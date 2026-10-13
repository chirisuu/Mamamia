import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, ShieldCheck, Wallet } from "lucide-react";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getAppSettings } from "@/lib/config/app-settings";
import { getBillingCatalog, getProvidersAvailability } from "@/lib/billing/catalog";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BillingFaq } from "@/features/billing/components/billing-faq";
import { FeatureComparison } from "@/features/billing/components/feature-comparison";
import { PricingTable } from "@/features/billing/components/pricing-table";
import { buildCatalogView, type CatalogView } from "@/features/billing/catalog-view";
import { PROVIDER_LABELS } from "@/features/billing/labels";

export const metadata: Metadata = {
  title: "Precios",
  description: "Plan gratis para registrar lo que comes y Premium con registro por foto, voz e IA, planes de comidas y lista de compras.",
};

async function loadCatalog(defaultTrialDays: number): Promise<CatalogView | null> {
  try {
    const supabase = await createSupabaseServerClient();
    return buildCatalogView(await getBillingCatalog(supabase), defaultTrialDays);
  } catch {
    // Sin datos reales no mostramos precios: la página lo dice.
    return null;
  }
}

/** Precios públicos: Gratis vs Premium desde `plans` y `plan_prices`. */
export default async function PricingPage() {
  const settings = await getAppSettings();
  const [view, availability] = await Promise.all([loadCatalog(settings.defaultTrialDays), getProvidersAvailability()]);
  const paymentsAvailable = Object.values(availability).some((a) => a.available);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader appName={settings.appName} />
      <main id="contenido" className="mx-auto grid w-full max-w-5xl flex-1 gap-12 px-4 py-10 sm:px-6 sm:py-14">
        <header className="mx-auto grid max-w-2xl gap-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Planes y precios</h1>
          <p className="text-base text-muted-foreground">
            Empieza gratis con lo esencial. Pasa a Premium cuando quieras registrar más rápido con IA y planificar tu semana.
          </p>
        </header>

        {view && (view.free || view.premium) ? (
          <>
            <PricingTable {...view} paymentsAvailable={paymentsAvailable} />

            {view.free && view.premium ? (
              <section aria-labelledby="comparar" className="grid gap-3">
                <h2 id="comparar" className="text-xl font-semibold tracking-tight">
                  Compara los planes
                </h2>
                <FeatureComparison free={view.free} premium={view.premium} />
              </section>
            ) : null}
          </>
        ) : (
          <Alert variant="destructive">
            <AlertTitle>No pudimos cargar los precios</AlertTitle>
            <AlertDescription>
              <p>Es un problema temporal de nuestro lado. Vuelve a intentarlo en unos minutos.</p>
              <Link href="/precios" className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary-strong underline-offset-4 hover:underline">
                Reintentar
              </Link>
            </AlertDescription>
          </Alert>
        )}

        <section aria-labelledby="formas-de-pago" className="grid gap-3">
          <h2 id="formas-de-pago" className="text-xl font-semibold tracking-tight">
            Formas de pago
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {(["mercadopago", "stripe"] as const).map((id) => {
              const a = availability[id];
              const Icon = id === "stripe" ? CreditCard : Wallet;
              return (
                <li key={id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary-strong">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="grid gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{PROVIDER_LABELS[id].name}</p>
                      {a.available ? null : <Badge variant="secondary">{a.reason?.message ?? "No disponible"}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{PROVIDER_LABELS[id].detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Pagas en la página segura del proveedor. No guardamos los datos de tu tarjeta.
          </p>
        </section>

        <BillingFaq />

        <p className="text-center text-xs text-muted-foreground">
          {settings.appName} te ayuda a registrar y entender lo que comes. No promete resultados ni reemplaza a un profesional de la
          salud.
        </p>
      </main>
      <SiteFooter appName={settings.appName} supportEmail={settings.supportEmail} />
    </div>
  );
}
