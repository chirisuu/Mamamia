"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, Crown, PlugZap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { AiApiError } from "../lib/api-client";
import { ConsentCard } from "./consent-card";

/** Error de una llamada a /api/ai/* con el estado honesto y la acción que sí funciona. */
export function AiErrorView({
  error,
  what,
  onRetry,
  alternativeHref,
  alternativeLabel,
}: {
  error: unknown;
  /** "tus fotos de comida", "tu texto"… (para el consentimiento). */
  what: string;
  onRetry?: () => void;
  alternativeHref: string;
  alternativeLabel: string;
}) {
  const e = error instanceof AiApiError ? error : new AiApiError(0, "UNEXPECTED", "Algo salió mal. Inténtalo de nuevo.");
  const alternative = (
    <Button asChild variant="outline" size="sm">
      <Link href={alternativeHref}>{alternativeLabel}</Link>
    </Button>
  );

  if (e.code === "CONSENT_REQUIRED") return <ConsentCard what={what} onGranted={onRetry} />;

  if (e.code === "AI_NOT_CONFIGURED" || e.code === "TRANSCRIPTION_NOT_CONFIGURED") {
    return (
      <Alert variant="warning">
        <PlugZap aria-hidden="true" />
        <AlertTitle>{e.code === "AI_NOT_CONFIGURED" ? "IA pendiente de configurar" : "Transcripción pendiente de configurar"}</AlertTitle>
        <AlertDescription>
          <p>{e.message}</p>
          <div className="mt-1 flex flex-wrap gap-2">{alternative}</div>
        </AlertDescription>
      </Alert>
    );
  }

  if (e.code === "AI_QUOTA_EXCEEDED") {
    return (
      <Alert variant="warning">
        <CalendarClock aria-hidden="true" />
        <AlertTitle>Sin cupo este mes</AlertTitle>
        <AlertDescription>
          <p>
            {e.quota ? `Usaste ${formatNumber(e.quota.used)} de ${formatNumber(e.quota.limit)} este mes. ` : ""}
            {e.message}
          </p>
          <div className="mt-1 flex flex-wrap gap-2">{alternative}</div>
        </AlertDescription>
      </Alert>
    );
  }

  if (e.code === "PREMIUM_REQUIRED") {
    return (
      <Alert variant="warning">
        <Crown aria-hidden="true" />
        <AlertTitle>Función Premium</AlertTitle>
        <AlertDescription>
          <p>{e.message}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/app/premium">Ver Premium</Link>
            </Button>
            {alternative}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (e.code === "UNAUTHORIZED") {
    return (
      <Alert variant="destructive">
        <AlertTriangle aria-hidden="true" />
        <AlertTitle>Tu sesión terminó</AlertTitle>
        <AlertDescription>
          <p>Vuelve a ingresar para continuar. No se registró nada.</p>
          <Button asChild size="sm" className="mt-1">
            <Link href="/ingresar">Ingresar</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>{e.code === "AI_REFUSED" ? "La IA no pudo procesarlo" : "No pudimos completar el análisis"}</AlertTitle>
      <AlertDescription>
        <p>{e.message}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {onRetry && e.code !== "AI_REFUSED" ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Reintentar
            </Button>
          ) : null}
          {alternative}
        </div>
      </AlertDescription>
    </Alert>
  );
}
