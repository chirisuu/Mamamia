import Link from "next/link";
import { CalendarClock, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { formatKg, formatLongDate, formatNumber } from "@/lib/format";
import { FLAT_RATE_KG_PER_WEEK, type GoalProjection, type WeightTrend } from "@/lib/nutrition";

const CONFIDENCE_TEXT: Record<WeightTrend["confidence"], string> = {
  insufficient: "Aún faltan pesajes para calcular tu tendencia (al menos 3 en una semana).",
  low: "Confianza baja: con más pesajes en las próximas semanas la tendencia será más clara.",
  ok: "Calculada con el promedio de 7 días de las últimas semanas.",
};

function rateText(rate: number): string {
  if (Math.abs(rate) < FLAT_RATE_KG_PER_WEEK) return "Estable";
  const sign = rate > 0 ? "+" : "−";
  return `${sign}${formatNumber(Math.abs(rate), 2)}`;
}

/** Tendencia (regresión sobre el promedio de 7 días), ritmo semanal y fecha estimada a la meta. */
export function TrendCard({
  trend,
  projection,
  goalKg,
}: {
  trend: WeightTrend;
  projection: GoalProjection | null;
  goalKg: number | null;
}) {
  const rate = trend.weeklyRateKg;
  const RateIcon = rate == null || Math.abs(rate) < FLAT_RATE_KG_PER_WEEK ? Minus : rate > 0 ? TrendingUp : TrendingDown;
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Tendencia</CardTitle>
        <CardDescription>{CONFIDENCE_TEXT[trend.confidence]}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label="Ritmo semanal"
            icon={RateIcon}
            value={rate == null ? null : rateText(rate)}
            unit={rate != null && Math.abs(rate) >= FLAT_RATE_KG_PER_WEEK ? "kg/sem" : undefined}
            hint={rate == null ? "Sin datos suficientes" : "Según tu promedio de 7 días"}
          />
          <StatTile
            label="Peso de tendencia"
            value={trend.trendWeightKg == null ? null : formatNumber(trend.trendWeightKg, 1)}
            unit="kg"
            hint={trend.latestAverageKg == null ? "Sin promedio aún" : `Promedio 7 días: ${formatKg(trend.latestAverageKg)}`}
          />
        </div>
        <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-4">
          <CalendarClock className="mt-0.5 size-5 shrink-0 text-primary-strong" aria-hidden="true" />
          <div className="grid gap-1 text-sm">
            {goalKg == null ? (
              <p>
                No tienes un peso meta.{" "}
                <Link href="/app/perfil/metas" className="font-medium text-primary-strong underline-offset-4 hover:underline">
                  Defínelo en tus metas
                </Link>{" "}
                si quieres ver una fecha estimada.
              </p>
            ) : projection ? (
              <>
                <p className="font-medium">
                  {projection.reason === "on_track" && projection.date
                    ? `Fecha estimada para ${formatKg(goalKg)}: ${formatLongDate(projection.date)}`
                    : projection.reason === "reached"
                      ? `Tu tendencia ya está en tu meta de ${formatKg(goalKg)}.`
                      : `Meta: ${formatKg(goalKg)} · sin fecha estimada`}
                </p>
                <p className="text-muted-foreground">{projection.message}</p>
              </>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          El peso diario sube y baja por agua, sal y digestión: mira la tendencia, no el número de un día. Esto no es una promesa
          de resultados.
        </p>
      </CardContent>
    </Card>
  );
}
