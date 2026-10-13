import Link from "next/link";
import { ChartLine, Droplet, Flame, Scale } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { StatTile } from "@/components/ui/stat-tile";
import { formatMl, formatNumber, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardData } from "../queries";

const tileLink = cn(
  "block rounded-2xl outline-none transition-transform duration-150 active:scale-[0.99]",
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "[&_[data-slot=stat-tile]]:h-full [&_[data-slot=stat-tile]]:transition-colors hover:[&_[data-slot=stat-tile]]:border-primary/50",
);

function trendText(rate: number | null, confidence: string): string {
  if (rate == null || confidence === "insufficient") return "Faltan pesajes para ver tu tendencia";
  const sign = rate > 0 ? "+" : rate < 0 ? "−" : "±";
  const conf = confidence === "low" ? " (aún poca data)" : "";
  return `Tendencia ${sign}${formatNumber(Math.abs(rate), 2)} kg/sem${conf}`;
}

/** Agua, peso (último, promedio de 7 días y tendencia) y rachas sin castigo. */
export function StatusTiles({ data }: { data: DashboardData }) {
  const { water, weight, streaks, showWeight } = data;
  const waterPct = water?.targetMl ? Math.min(100, Math.round((water.ml / water.targetMl) * 100)) : null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <Link href="/app/agua" className={tileLink}>
        <StatTile
          label="Agua"
          icon={Droplet}
          value={water ? formatMl(water.ml) : null}
          hint={
            !water ? (
              "No disponible ahora"
            ) : water.targetMl ? (
              <span className="grid gap-1.5">
                <span>
                  de {formatMl(water.targetMl)} · {waterPct} %
                </span>
                <Progress value={waterPct ?? 0} aria-hidden="true" className="h-1.5" />
              </span>
            ) : (
              "Sin meta de agua"
            )
          }
        />
      </Link>

      {showWeight ? (
        <Link href="/app/progreso" className={tileLink}>
          <StatTile
            label="Peso"
            icon={Scale}
            value={weight?.latestKg != null ? formatNumber(weight.latestKg, 1) : null}
            unit="kg"
            hint={
              !weight ? (
                "No disponible ahora"
              ) : weight.latestKg == null ? (
                "Aún sin pesajes"
              ) : (
                <span className="grid gap-0.5">
                  <span>
                    {weight.latestDate ? `${formatShortDate(weight.latestDate)}` : ""}
                    {weight.avg7Kg != null ? ` · prom. 7 días ${formatNumber(weight.avg7Kg, 1)} kg` : ""}
                  </span>
                  <span>{trendText(weight.weeklyRateKg, weight.confidence)}</span>
                </span>
              )
            }
          />
        </Link>
      ) : (
        <Link href="/app/progreso" className={tileLink}>
          <StatTile label="Progreso" icon={ChartLine} value="Ver" hint="Tus hábitos y avances" />
        </Link>
      )}

      <Link href={`/app/diario/${data.today}`} className={cn(tileLink, "col-span-2 lg:col-span-1")}>
        <StatTile
          label="Racha de registro"
          icon={Flame}
          tone="primary"
          value={streaks ? formatNumber(streaks.logging.current) : "0"}
          unit={streaks?.logging.current === 1 ? "día" : "días"}
          hint={
            !streaks || streaks.logging.current === 0
              ? "Registra algo hoy para empezar. Cada día cuenta por separado."
              : `Metas cumplidas: ${streaks.goals.current} ${streaks.goals.current === 1 ? "día" : "días"} seguidos · mejor racha ${streaks.logging.longest}${
                  streaks.logging.todayCounts ? "" : " · registra hoy para sumar"
                }`
          }
        />
      </Link>
    </div>
  );
}
