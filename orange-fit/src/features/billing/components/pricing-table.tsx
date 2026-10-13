"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { BillingInterval } from "@/lib/billing/types";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import { priceFor, primaryCurrency, savingsFor, type CatalogView } from "../catalog-view";
import { INTERVAL_LABELS } from "../labels";

type PricingTableProps = CatalogView & {
  /** Hay al menos un medio de pago disponible. */
  paymentsAvailable: boolean;
};

/** Gratis vs Premium con selector mensual/anual. Los montos salen de `plan_prices`. */
export function PricingTable({ free, premium, premiumPrices, paymentsAvailable }: PricingTableProps) {
  const currency = primaryCurrency(premiumPrices);
  const hasYear = premiumPrices.some((p) => p.interval === "year");
  const hasMonth = premiumPrices.some((p) => p.interval === "month");
  const [interval, setPeriod] = React.useState<BillingInterval>(hasMonth ? "month" : "year");
  const savings = currency ? savingsFor(premiumPrices, currency) : null;

  const main = currency ? priceFor(premiumPrices, interval, currency) : null;
  // Precio en otra moneda para el mismo intervalo (p. ej. US$ con tarjeta internacional).
  const alt = premiumPrices.find((p) => p.interval === interval && p.currency !== currency) ?? null;
  const yearSavings = interval === "year" && savings && savings.savedCents > 0 ? savings : null;

  return (
    <div className="grid gap-6">
      {hasMonth && hasYear ? (
        <div className="mx-auto w-full max-w-sm">
          <SegmentedControl
            aria-label="Periodo de pago"
            value={interval}
            onValueChange={setPeriod}
            options={[
              { value: "month", label: "Mensual" },
              {
                value: "year",
                label: savings && savings.percent > 0 ? `Anual · ahorra ${savings.percent} %` : "Anual",
              },
            ]}
          />
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
        {free ? (
          <Card className="h-full">
            <CardHeader>
              <CardTitle as="h2" className="text-xl">
                {free.name}
              </CardTitle>
              <CardDescription>{free.description ?? "Lo esencial para registrar y entender lo que comes."}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <p className="text-3xl font-semibold tracking-tight tabular-nums">
                {formatCents(0, currency ?? "PEN")}
                <span className="ml-1 text-base font-normal text-muted-foreground">para siempre</span>
              </p>
              <FeatureList items={free.features.map((f) => f.label)} />
            </CardContent>
            <CardFooter className="mt-auto">
              <Button asChild variant="outline" size="lg" className="w-full">
                <Link href="/onboarding">Empezar gratis</Link>
              </Button>
            </CardFooter>
          </Card>
        ) : null}

        {premium ? (
          <Card className="relative h-full border-primary/60 shadow-md">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle as="h2" className="text-xl">
                  {premium.name}
                </CardTitle>
                {main && main.trialDays > 0 ? (
                  <Badge variant="soft">
                    <Sparkles aria-hidden="true" />
                    {main.trialDays} días gratis
                  </Badge>
                ) : null}
              </div>
              <CardDescription>{premium.description ?? "Registra más rápido con IA y planifica tu semana."}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {main ? (
                <div className="grid gap-1">
                  <p className="text-3xl font-semibold tracking-tight tabular-nums">
                    {formatCents(main.amountCents, main.currency)}
                    <span className="ml-1 text-base font-normal text-muted-foreground">{INTERVAL_LABELS[interval].per}</span>
                  </p>
                  {yearSavings ? (
                    <p className="text-sm text-muted-foreground">
                      Equivale a {formatCents(yearSavings.monthlyEquivalentCents, main.currency)} al mes · ahorras{" "}
                      {formatCents(yearSavings.savedCents, main.currency)} frente a pagar mes a mes
                    </p>
                  ) : null}
                  {alt ? (
                    <p className="text-sm text-muted-foreground">
                      o {formatCents(alt.amountCents, alt.currency)} {INTERVAL_LABELS[interval].per} con tarjeta internacional
                    </p>
                  ) : null}
                  {main.trialDays > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Prueba gratis de {main.trialDays} días en tu primera suscripción. Si cancelas antes, no se te cobra.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">El precio de Premium todavía no está publicado.</p>
              )}
              <FeatureList items={["Todo lo del plan gratis", ...premium.features.filter((f) => f.premium).map((f) => f.label)]} highlight />
              {premium.aiLimits.length > 0 ? (
                <div className="grid gap-1.5">
                  <p className="text-sm font-medium">Incluye cada mes</p>
                  <ul className="grid gap-1 text-sm text-muted-foreground">
                    {premium.aiLimits.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
            <CardFooter className="mt-auto flex-col items-stretch gap-2">
              {main && paymentsAvailable ? (
                <Button asChild size="lg" className="w-full">
                  <Link href="/app/premium">{main.trialDays > 0 ? "Probar Premium gratis" : "Elegir Premium"}</Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" className="w-full" disabled>
                    Elegir Premium
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Los pagos en línea están pendientes de configurar. Mientras tanto, puedes usar el plan gratis.
                  </p>
                </>
              )}
            </CardFooter>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function FeatureList({ items, highlight = false }: { items: string[]; highlight?: boolean }) {
  return (
    <ul className="grid gap-2 text-sm">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <Check className={cn("mt-0.5 size-4 shrink-0", highlight ? "text-primary-strong" : "text-muted-foreground")} aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
