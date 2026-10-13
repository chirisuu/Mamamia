import type { Metadata } from "next";
import Link from "next/link";
import { Check, Crown, Info } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getProfile, requireUser } from "@/lib/auth/session";
import { getBillingCatalog, getProvidersAvailability } from "@/lib/billing/catalog";
import { getAppSettings } from "@/lib/config/app-settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildCatalogView } from "@/features/billing/catalog-view";
import { PremiumCheckout } from "@/features/billing/components/premium-checkout";
import { formatBillingDate } from "@/features/billing/labels";
import { getBillingOverview } from "@/features/billing/queries";

export const metadata: Metadata = { title: "Premium" };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Elegir plan, periodo y medio de pago. Si ya tiene Premium, muestra su estado real. */
export default async function PremiumPage({ searchParams }: PageProps) {
  const user = await requireUser("/app/premium");
  const sp = await searchParams;
  const canceled = sp.cancelado === "1";
  const supabase = await createSupabaseServerClient();
  const [settings, availability, catalog, overview, profile] = await Promise.all([
    getAppSettings(),
    getProvidersAvailability(),
    getBillingCatalog(supabase),
    getBillingOverview(supabase, user.id, { paymentsLimit: 5 }),
    getProfile(),
  ]);
  const view = buildCatalogView(catalog, settings.defaultTrialDays);
  const tz = profile?.timezone ?? "America/Lima";
  const premiumFeatures = view.premium?.features.filter((f) => f.premium) ?? [];

  const status = overview.view;
  const hasAccess = Boolean(status?.hasAccess);
  const pastDue = overview.current?.status === "past_due";

  return (
    <>
      <AppHeader title="Premium" subtitle="Registra más rápido y planifica tu semana" backHref="/app/perfil" backLabel="Volver a Perfil" />
      <div className="grid gap-6 pb-8 pt-2 lg:grid-cols-[1fr_24rem] lg:items-start">
        <div className="grid gap-6 lg:order-2">
          {canceled && !hasAccess ? (
            <Alert variant="info">
              <Info aria-hidden="true" />
              <AlertTitle>No se completó el pago</AlertTitle>
              <AlertDescription>
                <p>Volviste antes de terminar, así que no se hizo ningún cobro. Puedes intentarlo otra vez cuando quieras.</p>
              </AlertDescription>
            </Alert>
          ) : null}

          {hasAccess && status ? (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle as="h2">Ya tienes Premium</CardTitle>
                  <Badge variant={status.tone === "success" ? "success" : "soft"}>{status.label}</Badge>
                </div>
                <CardDescription>
                  {status.trialEndsAt && !status.accessEndsAt
                    ? `Tu prueba gratis termina el ${formatBillingDate(status.trialEndsAt, tz)}.`
                    : status.accessEndsAt
                      ? `Tienes Premium hasta el ${formatBillingDate(status.accessEndsAt, tz)}. No se renovará.`
                      : status.nextChargeAt
                        ? `Próximo cobro: ${formatBillingDate(status.nextChargeAt, tz)}.`
                        : "Tu suscripción está vigente."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/app/perfil/suscripcion">Ver mi suscripción</Link>
                </Button>
              </CardContent>
            </Card>
          ) : pastDue ? (
            <Alert variant="warning">
              <Info aria-hidden="true" />
              <AlertTitle>Tu último cobro no se pudo hacer</AlertTitle>
              <AlertDescription>
                <p>Actualiza tu medio de pago para recuperar Premium. No necesitas contratar de nuevo.</p>
                <Link href="/app/perfil/suscripcion" className="mt-1 inline-flex min-h-11 items-center font-semibold text-primary-strong underline-offset-4 hover:underline">
                  Ir a mi suscripción
                </Link>
              </AlertDescription>
            </Alert>
          ) : view.premium && view.premiumPrices.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Elige cómo pagar</CardTitle>
                <CardDescription>Cancelas cuando quieras desde Perfil → Suscripción.</CardDescription>
              </CardHeader>
              <CardContent>
                <PremiumCheckout
                  prices={view.premiumPrices}
                  trialEligible={overview.trialEligible}
                  providers={{
                    stripe: { available: availability.stripe.available, reason: availability.stripe.reason?.message ?? null },
                    mercadopago: {
                      available: availability.mercadopago.available,
                      reason: availability.mercadopago.reason?.message ?? null,
                    },
                  }}
                />
              </CardContent>
            </Card>
          ) : (
            <Alert>
              <Info aria-hidden="true" />
              <AlertTitle>Premium aún no tiene precio publicado</AlertTitle>
              <AlertDescription>
                <p>Cuando esté disponible lo verás aquí. Mientras tanto, el plan gratis sigue funcionando completo.</p>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <section aria-labelledby="incluye" className="grid gap-4 lg:order-1">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary-strong">
              <Crown className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h2 id="incluye" className="text-lg font-semibold tracking-tight">
                Qué incluye {view.premium?.name ?? "Premium"}
              </h2>
              <p className="text-sm text-muted-foreground">Además de todo lo del plan gratis.</p>
            </div>
          </div>
          <ul className="grid gap-2 rounded-2xl border border-border bg-card p-4 text-sm shadow-sm">
            {premiumFeatures.map((f) => (
              <li key={f.code} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-primary-strong" aria-hidden="true" />
                {f.label}
              </li>
            ))}
            {view.premium?.aiLimits.length ? (
              <li className="mt-2 border-t border-border pt-3 text-muted-foreground">Cada mes: {view.premium.aiLimits.join(" · ")}.</li>
            ) : null}
          </ul>
          <p className="text-xs text-muted-foreground">
            Premium te da herramientas para registrar y planificar con menos esfuerzo; no promete resultados. Las metas son
            estimaciones y no reemplazan a un profesional de la salud.{" "}
            <Link href="/precios" className="font-medium text-primary-strong underline-offset-4 hover:underline">
              Ver precios y preguntas frecuentes
            </Link>
          </p>
        </section>
      </div>
    </>
  );
}
