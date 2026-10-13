import Link from "next/link";
import { CalendarClock, Crown, PlugZap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatNumber, formatShortDate } from "@/lib/format";

/** Estados honestos de la IA. Sin botones falsos: solo acciones que funcionan. */

export function AiNotConfiguredNotice({ alternativeHref, alternativeLabel }: { alternativeHref: string; alternativeLabel: string }) {
  return (
    <Alert variant="warning">
      <PlugZap aria-hidden="true" />
      <AlertTitle>IA pendiente de configurar</AlertTitle>
      <AlertDescription>
        <p>El servicio de IA todavía no está conectado en esta instalación, así que no podemos analizar nada por ahora. No es un problema de tu cuenta.</p>
        <Button asChild variant="outline" size="sm" className="mt-1">
          <Link href={alternativeHref}>{alternativeLabel}</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function AiQuotaNotice({
  used,
  limit,
  periodStart,
  alternativeHref,
  alternativeLabel,
}: {
  used: number;
  limit: number;
  periodStart: string;
  alternativeHref?: string;
  alternativeLabel?: string;
}) {
  const next = nextMonthStart(periodStart);
  return (
    <Alert variant="warning">
      <CalendarClock aria-hidden="true" />
      <AlertTitle>Sin cupo este mes</AlertTitle>
      <AlertDescription>
        <p>
          Usaste {formatNumber(used)} de {formatNumber(limit)} este mes. Tu cupo se renueva el {formatShortDate(next)}.
        </p>
        {alternativeHref && alternativeLabel ? (
          <Button asChild variant="outline" size="sm" className="mt-1">
            <Link href={alternativeHref}>{alternativeLabel}</Link>
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export function AiPlanWithoutQuotaNotice() {
  return (
    <Alert variant="warning">
      <Crown aria-hidden="true" />
      <AlertTitle>Tu plan no incluye cupo para esta función</AlertTitle>
      <AlertDescription>
        <p>Revisa tu plan en Premium.</p>
        <Button asChild variant="outline" size="sm" className="mt-1">
          <Link href="/app/premium">Ver Premium</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/** "Te quedan 118 de 120 este mes". */
export function QuotaLine({ used, limit, unit }: { used: number; limit: number; unit: string }) {
  const left = Math.max(0, limit - used);
  return (
    <p className="text-xs text-muted-foreground">
      Te quedan {formatNumber(left)} de {formatNumber(limit)} {unit} este mes.
    </p>
  );
}

function nextMonthStart(periodStart: string): string {
  const [y, m] = periodStart.split("-").map(Number) as [number, number];
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-01`;
}
