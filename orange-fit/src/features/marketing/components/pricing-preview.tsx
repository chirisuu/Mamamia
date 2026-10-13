import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/format";
import type { Loaded, PricingSummary } from "../queries";

/**
 * Resumen de planes para la portada, con montos de `plan_prices`. Si no se pudieron leer, lo
 * decimos y enviamos a /precios: nunca mostramos un precio inventado.
 */
export function PricingPreview({ pricing }: { pricing: Loaded<PricingSummary> }) {
  if (!pricing.ok || (!pricing.data.view.free && !pricing.data.view.premium)) {
    return (
      <Alert>
        <AlertTitle>No pudimos cargar los precios en este momento</AlertTitle>
        <AlertDescription>
          <p>
            Puedes verlos en{" "}
            <Link href="/precios" className="font-medium text-primary-strong underline underline-offset-4">
              la página de precios
            </Link>
            .
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  const { view, monthly, yearly, savings, trialDays } = pricing.data;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {view.free ? (
        <article className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="grid gap-1">
            <h3 className="text-lg font-semibold">{view.free.name}</h3>
            <p className="flex items-baseline gap-1.5">
              <span className="text-3xl font-semibold tracking-tight" data-numeric>
                {formatCents(0, monthly?.currency ?? "PEN")}
              </span>
              <span className="text-sm text-muted-foreground">sin tarjeta</span>
            </p>
            {view.free.description ? <p className="text-sm text-muted-foreground">{view.free.description}</p> : null}
          </div>
          <FeatureList items={view.free.features.map((f) => f.label)} />
          <Button asChild variant="outline" className="mt-auto">
            <Link href="/onboarding">Empezar gratis</Link>
          </Button>
        </article>
      ) : null}

      {view.premium ? (
        <article className="relative flex flex-col gap-5 rounded-3xl border-2 border-primary bg-card p-6 shadow-md">
          <div className="grid gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold">{view.premium.name}</h3>
              {trialDays > 0 ? <Badge>{trialDays} días de prueba</Badge> : null}
            </div>
            {monthly ? (
              <p className="flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tracking-tight" data-numeric>
                  {formatCents(monthly.amountCents, monthly.currency)}
                </span>
                <span className="text-sm text-muted-foreground">al mes</span>
              </p>
            ) : null}
            {yearly ? (
              <p className="text-sm text-muted-foreground">
                o {formatCents(yearly.amountCents, yearly.currency)} al año
                {savings && savings.percent > 0 ? ` (ahorras ${savings.percent} %)` : ""}
              </p>
            ) : null}
            {!monthly && !yearly ? <p className="text-sm text-muted-foreground">Precio por confirmar.</p> : null}
            {trialDays > 0 ? (
              <p className="text-xs text-muted-foreground">La prueba gratis aplica a tu primera suscripción. Cancelas cuando quieras.</p>
            ) : null}
          </div>
          <FeatureList items={view.premium.features.filter((f) => f.premium).map((f) => f.label)} />
          <Button asChild variant="default" className="mt-auto">
            <Link href="/precios">
              Ver precios y formas de pago
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </article>
      ) : null}
    </div>
  );
}

function FeatureList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="grid gap-2.5 text-sm">
      {items.map((label) => (
        <li key={label} className="flex items-start gap-2.5">
          <Check className="mt-0.5 size-4 shrink-0 text-primary-strong" aria-hidden="true" />
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}
