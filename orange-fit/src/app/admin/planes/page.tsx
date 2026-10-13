import type { Metadata } from "next";
import { CreditCard } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { PREMIUM_FEATURES, type PremiumFeature } from "@/lib/billing/features";
import { formatCents } from "@/lib/format";
import { integrationStatus } from "@/lib/server-env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PlanForm, PlanPriceDialog } from "@/features/admin/components/plan-forms";
import { BILLING_INTERVAL_LABELS } from "@/features/admin/lib/labels";
import { aiLimitsFromRow, baseFeatures, listPlans } from "@/features/admin/server/plans";

export const metadata: Metadata = { title: "Planes y precios" };

export default async function AdminPlansPage() {
  await requireRole("admin");
  const supabase = await createSupabaseServerClient();
  const plans = await listPlans(supabase);
  const status = integrationStatus();

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Administración"
        title="Planes y precios"
        description="Qué incluye cada plan, sus cupos de IA y los precios que se ofrecen. Los cambios se ven en Precios y Premium."
      />
      {!status.stripe || !status.mercadopago ? (
        <Alert variant="warning">
          <AlertTitle>Cobros pendientes de configurar</AlertTitle>
          <AlertDescription>
            <p>
              {!status.stripe ? "Stripe no tiene credenciales. " : ""}
              {!status.mercadopago ? "Mercado Pago no tiene credenciales. " : ""}
              Puedes editar planes y precios, pero no se cobrará con ese medio hasta configurarlo (y encenderlo en Configuración).
            </p>
          </AlertDescription>
        </Alert>
      ) : null}
      {plans.length === 0 ? (
        <EmptyState icon={CreditCard} title="No hay planes" description="Los planes se crean con la semilla de la base de datos." />
      ) : (
        plans.map((plan) => {
          const premiumFeatures = plan.features.filter((f): f is PremiumFeature => (PREMIUM_FEATURES as readonly string[]).includes(f));
          return (
            <Card key={plan.id}>
              <CardHeader>
                <CardTitle as="h2" className="flex flex-wrap items-center gap-2">
                  {plan.name}
                  <Badge variant="outline" className="font-mono">
                    {plan.id}
                  </Badge>
                  {!plan.is_active ? <Badge variant="secondary">Inactivo</Badge> : null}
                </CardTitle>
                <CardDescription>{plan.description ?? "Sin descripción."}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6">
                <PlanForm
                  key={JSON.stringify([plan.name, plan.description, plan.features, plan.ai_monthly_limits, plan.is_active, plan.sort_order])}
                  baseFeatures={baseFeatures(plan.features)}
                  initial={{
                    planId: plan.id,
                    name: plan.name,
                    description: plan.description ?? "",
                    isActive: plan.is_active,
                    sortOrder: plan.sort_order,
                    premiumFeatures,
                    aiLimits: aiLimitsFromRow(plan.ai_monthly_limits),
                  }}
                />
                <section aria-labelledby={`precios-${plan.id}`} className="grid gap-3 border-t border-border pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 id={`precios-${plan.id}`} className="font-semibold">
                      Precios
                    </h3>
                    <PlanPriceDialog
                      mode="create"
                      planName={plan.name}
                      initial={{
                        priceId: null,
                        planId: plan.id,
                        interval: "month",
                        currencyCode: "PEN",
                        amountCents: null as unknown as number,
                        trialDays: 0,
                        stripePriceId: "",
                        mercadopagoPlanId: "",
                        isActive: true,
                      }}
                    />
                  </div>
                  {plan.prices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{plan.id === "free" ? "El plan gratis no necesita precios." : "Sin precios: este plan no se puede contratar."}</p>
                  ) : (
                    <ul className="grid gap-2">
                      {plan.prices.map((price) => (
                        <li key={price.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                          <div className="grid min-w-0 flex-1 gap-1">
                            <p className="font-medium" data-numeric="">
                              {formatCents(price.amount_cents, price.currency_code)} · {BILLING_INTERVAL_LABELS[price.interval]}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              <Badge variant={price.is_active ? "success" : "secondary"}>{price.is_active ? "Activo" : "Inactivo"}</Badge>
                              <span>{price.trial_days > 0 ? `${price.trial_days} días de prueba` : "Prueba por defecto"}</span>
                              <span>· Stripe: {price.stripe_price_id ? <span className="font-mono">{price.stripe_price_id}</span> : "pendiente de configurar"}</span>
                            </div>
                          </div>
                          <PlanPriceDialog
                            mode="edit"
                            planName={plan.name}
                            initial={{
                              priceId: price.id,
                              planId: plan.id,
                              interval: price.interval,
                              currencyCode: price.currency_code,
                              amountCents: price.amount_cents,
                              trialDays: price.trial_days,
                              stripePriceId: price.stripe_price_id ?? "",
                              mercadopagoPlanId: price.mercadopago_plan_id ?? "",
                              isActive: price.is_active,
                            }}
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
