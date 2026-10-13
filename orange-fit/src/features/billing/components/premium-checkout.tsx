"use client";

import * as React from "react";
import Link from "next/link";
import { CreditCard, Lock, TriangleAlert, Wallet } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { BillingInterval, BillingProviderId } from "@/lib/billing/types";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/utils";
import { optionForProvider, savingsFor, type PriceOption } from "../catalog-view";
import { INTERVAL_LABELS, PROVIDER_LABELS } from "../labels";

export type ProviderState = { available: boolean; reason: string | null };

type PremiumCheckoutProps = {
  prices: PriceOption[];
  providers: Record<BillingProviderId, ProviderState>;
  /** Primera suscripción: se ofrece la prueba gratis. */
  trialEligible: boolean;
};

type ApiError = { code: string; message: string };

const PROVIDER_ORDER: BillingProviderId[] = ["mercadopago", "stripe"];
const PROVIDER_ICON = { stripe: CreditCard, mercadopago: Wallet } as const;

/** Elegir periodo y medio de pago → POST /api/billing/checkout → página segura del proveedor. */
export function PremiumCheckout({ prices, providers, trialEligible }: PremiumCheckoutProps) {
  const hasMonth = prices.some((p) => p.interval === "month");
  const hasYear = prices.some((p) => p.interval === "year");
  const [interval, setPeriod] = React.useState<BillingInterval>(hasMonth ? "month" : "year");

  const options = PROVIDER_ORDER.map((id) => {
    const price = optionForProvider(prices, interval, id);
    const state = providers[id];
    const reason = !state.available
      ? (state.reason ?? "No disponible por ahora.")
      : !price
        ? id === "stripe"
          ? "Precio pendiente de configurar en Stripe."
          : "Sin precio en soles para este periodo."
        : null;
    return { id, price, reason };
  });
  const firstEnabled = options.find((o) => !o.reason)?.id ?? null;
  const [provider, setProvider] = React.useState<BillingProviderId | null>(firstEnabled);
  const selected = options.find((o) => o.id === provider && !o.reason) ?? null;
  // Si al cambiar de periodo el medio elegido deja de estar disponible, se pasa al primero que sí.
  const effective = selected ?? options.find((o) => !o.reason) ?? null;

  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<ApiError | null>(null);

  const savingsPen = savingsFor(prices, "PEN");
  const savingsAny = savingsPen ?? savingsFor(prices, "USD");
  const trialDays = trialEligible && effective?.price ? effective.price.trialDays : 0;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!effective?.price) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priceId: effective.price.id, provider: effective.id }),
      });
      const body = (await res.json().catch(() => null)) as { url?: string; error?: ApiError } | null;
      if (res.ok && body?.url) {
        // Vamos a la página del proveedor: el botón queda cargando hasta que el navegador salga.
        window.location.assign(body.url);
        return;
      }
      setError(body?.error ?? { code: "UNKNOWN", message: "No pudimos iniciar el pago. Inténtalo de nuevo." });
    } catch {
      setError({ code: "NETWORK", message: "No pudimos conectar con el servidor. Revisa tu conexión." });
    }
    setPending(false);
  }

  const noneAvailable = options.every((o) => o.reason);

  return (
    <form onSubmit={onSubmit} className="grid gap-5" aria-describedby="checkout-nota">
      {hasMonth && hasYear ? (
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Periodo</legend>
          <SegmentedControl
            aria-label="Periodo de pago"
            value={interval}
            onValueChange={setPeriod}
            options={[
              { value: "month", label: "Mensual" },
              { value: "year", label: savingsAny && savingsAny.percent > 0 ? `Anual · ahorra ${savingsAny.percent} %` : "Anual" },
            ]}
          />
        </fieldset>
      ) : null}

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Medio de pago</legend>
        <RadioGroup
          value={effective?.id ?? ""}
          onValueChange={(v) => setProvider(v as BillingProviderId)}
          aria-label="Medio de pago"
          className="gap-3"
        >
          {options.map((o) => {
            const Icon = PROVIDER_ICON[o.id];
            const disabled = Boolean(o.reason) || pending;
            const inputId = `pago-${o.id}`;
            const yearSaving = interval === "year" && o.price ? savingsFor(prices, o.price.currency) : null;
            return (
              <div
                key={o.id}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border border-input bg-card p-4 transition-colors",
                  effective?.id === o.id && !o.reason && "border-primary ring-1 ring-primary",
                  o.reason && "opacity-70",
                )}
              >
                <RadioGroupItem id={inputId} value={o.id} disabled={disabled} className="mt-1" aria-describedby={`${inputId}-detalle`} />
                <Label htmlFor={inputId} className="grid flex-1 cursor-pointer gap-1 font-normal">
                  <span className="flex items-center gap-2 font-semibold">
                    <Icon className="size-5 text-primary-strong" aria-hidden="true" />
                    {PROVIDER_LABELS[o.id].name}
                  </span>
                  <span id={`${inputId}-detalle`} className="grid gap-1 text-sm text-muted-foreground">
                    <span>{PROVIDER_LABELS[o.id].detail}</span>
                    {o.price ? (
                      <span className="font-medium text-foreground tabular-nums">
                        {formatCents(o.price.amountCents, o.price.currency)} {INTERVAL_LABELS[interval].per}
                        {yearSaving && yearSaving.monthlyEquivalentCents > 0
                          ? ` · equivale a ${formatCents(yearSaving.monthlyEquivalentCents, o.price.currency)} al mes`
                          : ""}
                      </span>
                    ) : null}
                    {o.reason ? <span className="font-medium text-foreground">{o.reason}</span> : null}
                  </span>
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </fieldset>

      {effective?.price ? (
        <div className="grid gap-1 rounded-2xl bg-muted p-4 text-sm">
          {trialDays > 0 ? (
            <>
              <p className="font-semibold">Hoy no pagas nada: tienes {trialDays} días de prueba gratis.</p>
              <p className="text-muted-foreground">
                Al terminar la prueba se cobra {formatCents(effective.price.amountCents, effective.price.currency)}{" "}
                {INTERVAL_LABELS[interval].per}. Si cancelas antes, no se te cobra.
              </p>
            </>
          ) : (
            <p className="font-semibold">
              Pagas {formatCents(effective.price.amountCents, effective.price.currency)} {INTERVAL_LABELS[interval].per}. Se renueva
              sola hasta que la canceles.
            </p>
          )}
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>No se inició el pago</AlertTitle>
          <AlertDescription>
            <p>{error.message}</p>
            {error.code === "ALREADY_SUBSCRIBED" ? (
              <Link href="/app/perfil/suscripcion" className="font-medium text-primary-strong underline underline-offset-4">
                Ir a mi suscripción
              </Link>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={!effective?.price} loading={pending}>
        {noneAvailable ? "Pagos pendientes de configurar" : trialDays > 0 ? "Empezar prueba gratis" : "Continuar al pago"}
      </Button>
      <p id="checkout-nota" className="flex items-start gap-2 text-xs text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {effective
          ? `Te llevaremos a la página segura de ${PROVIDER_LABELS[effective.id].secure}. No guardamos los datos de tu tarjeta.`
          : "Cuando los pagos estén configurados podrás pagar con Mercado Pago (soles) o con tarjeta internacional."}
      </p>
    </form>
  );
}
