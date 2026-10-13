import type { Metadata } from "next";
import Link from "next/link";
import { Crown, Info, ShieldCheck, TriangleAlert } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getProfile, requireUser } from "@/lib/auth/session";
import { MERCADOPAGO_MANAGE_URL } from "@/lib/billing/mercadopago";
import { getBillingProvider } from "@/lib/billing/provider";
import { getAppSettings } from "@/lib/config/app-settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PaymentHistory } from "@/features/billing/components/payment-history";
import { SubscriptionActions } from "@/features/billing/components/subscription-actions";
import { formatBillingDate, formatPriceLine, PROVIDER_LABELS } from "@/features/billing/labels";
import { getBillingOverview } from "@/features/billing/queries";

export const metadata: Metadata = { title: "Suscripción" };

const TONE_VARIANT = { success: "success", info: "soft", warning: "warning", neutral: "secondary" } as const;

/**
 * Estado real de la suscripción, próximo cobro o fin de la prueba, cancelar la renovación y
 * gestionar el medio de pago. Carga y error: los de /app/perfil.
 */
export default async function SubscriptionPage() {
  const user = await requireUser("/app/perfil/suscripcion");
  const supabase = await createSupabaseServerClient();
  const [overview, profile, settings] = await Promise.all([
    getBillingOverview(supabase, user.id),
    getProfile(),
    getAppSettings(),
  ]);
  const tz = profile?.timezone ?? "America/Lima";
  const sub = overview.current;
  const view = overview.view;
  // Hasta cuándo conserva Premium si cancela hoy: fin de la prueba o del periodo pagado.
  const accessUntilIso = view ? (view.trialEndsAt ?? view.nextChargeAt ?? view.accessEndsAt) : null;

  let planName = "Premium";
  if (sub && sub.plan_id !== "premium") {
    const { data } = await supabase.from("plans").select("name").eq("id", sub.plan_id).maybeSingle();
    planName = data?.name ?? sub.plan_id;
  }

  return (
    <>
      <AppHeader title="Suscripción" backHref="/app/perfil" backLabel="Volver a Perfil" />
      <div className="grid gap-6 pb-8 pt-2">
        {!sub || !view ? (
          <Card>
            <CardHeader>
              <CardTitle as="h2">Estás en el plan gratis</CardTitle>
              <CardDescription>
                Registro manual, calorías, macros, agua y seguimiento, sin costo. Con Premium sumas registro con foto, voz y texto,
                asistente, planes de comidas y lista de compras.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="lg" className="w-full">
                <Link href="/app/premium">
                  <Crown aria-hidden="true" />
                  Ver Premium
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle as="h2" className="text-lg">
                    {planName}
                  </CardTitle>
                  <Badge variant={TONE_VARIANT[view.tone]}>{view.label}</Badge>
                </div>
                <CardDescription>
                  {view.hasAccess ? "Tienes acceso a todas las funciones de Premium." : "Ahora mismo no tienes acceso a Premium."}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                <dl className="grid gap-3 text-sm">
                  <Row label="Medio de pago" value={PROVIDER_LABELS[sub.provider].name} />
                  {overview.currentPrice ? (
                    <Row
                      label="Precio"
                      value={formatPriceLine(overview.currentPrice.amount_cents, overview.currentPrice.currency_code, overview.currentPrice.interval)}
                    />
                  ) : null}
                  {view.trialEndsAt ? <Row label="Prueba gratis hasta" value={formatBillingDate(view.trialEndsAt, tz)} /> : null}
                  {view.nextChargeAt ? <Row label="Próximo cobro" value={formatBillingDate(view.nextChargeAt, tz)} /> : null}
                  {view.accessEndsAt ? <Row label="Premium hasta" value={formatBillingDate(view.accessEndsAt, tz)} /> : null}
                  {sub.canceled_at && !view.hasAccess ? <Row label="Cancelada el" value={formatBillingDate(sub.canceled_at, tz)} /> : null}
                </dl>

                {sub.status === "past_due" ? (
                  <Alert variant="warning">
                    <TriangleAlert aria-hidden="true" />
                    <AlertTitle>No pudimos cobrar tu última renovación</AlertTitle>
                    <AlertDescription>
                      <p>
                        Actualiza tu medio de pago en {PROVIDER_LABELS[sub.provider].secure} para recuperar Premium. Tus registros siguen
                        a salvo.
                      </p>
                    </AlertDescription>
                  </Alert>
                ) : null}
                {view.hasAccess && sub.cancel_at_period_end ? (
                  <Alert variant="info">
                    <Info aria-hidden="true" />
                    <AlertTitle>Tu suscripción no se renovará</AlertTitle>
                    <AlertDescription>
                      <p>
                        Mantienes Premium hasta el {formatBillingDate(view.accessEndsAt, tz)} y no se harán más cobros.
                        {sub.provider === "stripe" ? " Si cambias de opinión, puedes reactivarla desde la gestión de Stripe antes de esa fecha." : ""}
                      </p>
                    </AlertDescription>
                  </Alert>
                ) : null}
                {sub.status === "incomplete" ? (
                  <Alert>
                    <Info aria-hidden="true" />
                    <AlertTitle>El pago no se completó</AlertTitle>
                    <AlertDescription>
                      <p>No se hizo ningún cobro. Si quieres Premium, puedes intentarlo otra vez.</p>
                    </AlertDescription>
                  </Alert>
                ) : null}

                <SubscriptionActions
                  provider={sub.provider}
                  status={sub.status}
                  canCancel={view.canCancel}
                  providerConfigured={getBillingProvider(sub.provider).isConfigured()}
                  accessUntil={accessUntilIso ? formatBillingDate(accessUntilIso, tz) : null}
                  manageHref={sub.provider === "mercadopago" ? MERCADOPAGO_MANAGE_URL : null}
                  supportEmail={settings.supportEmail}
                />

                {!view.hasAccess && sub.status !== "past_due" ? (
                  <Button asChild size="lg">
                    <Link href="/app/premium">
                      <Crown aria-hidden="true" />
                      Volver a Premium
                    </Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </>
        )}

        <section aria-labelledby="historial-pagos" className="grid gap-3">
          <h2 id="historial-pagos" className="text-lg font-semibold tracking-tight">
            Historial de pagos
          </h2>
          <PaymentHistory payments={overview.payments} timeZone={tz} />
        </section>

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          No guardamos los datos de tu tarjeta: los maneja Stripe o Mercado Pago. Aquí solo ves fechas, montos y estados.
        </p>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}
