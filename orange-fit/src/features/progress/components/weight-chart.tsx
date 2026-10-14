"use client";

import * as React from "react";
import Link from "next/link";
import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { addDays } from "@/lib/dates";
import { formatKg, formatNumber, formatShortDate } from "@/lib/format";
import { weightDomain, type WeightPoint } from "../lib/analytics";

type Range = "30" | "90" | "180" | "365";

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload?: WeightPoint }[] }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md" data-numeric="">
      <p className="font-semibold">{formatShortDate(p.date)}</p>
      <p className="text-muted-foreground">
        Peso: <span className="font-medium text-foreground">{formatKg(p.weightKg)}</span>
      </p>
      <p className="text-muted-foreground">
        Promedio 7 días: <span className="font-medium text-foreground">{p.average == null ? "faltan pesajes" : formatKg(p.average)}</span>
      </p>
    </div>
  );
}

/**
 * Peso diario (puntos), promedio móvil de 7 días (línea) y meta (línea punteada). Los rangos de 6
 * meses y 1 año son de Analítica avanzada (Premium).
 */
export function WeightChart({
  points,
  today,
  goalKg,
  advanced,
}: {
  points: WeightPoint[];
  today: string;
  goalKg: number | null;
  advanced: boolean;
}) {
  const [range, setRange] = React.useState<Range>("30");
  const from = addDays(today, -(Number(range) - 1));
  const data = React.useMemo(() => points.filter((p) => p.date >= from).map((p) => ({ ...p, t: Date.parse(`${p.date}T12:00:00Z`) })), [points, from]);
  const domain = weightDomain(data, goalKg);
  const xDomain: [number, number] = [Date.parse(`${from}T00:00:00Z`), Date.parse(`${today}T23:59:59Z`)];

  return (
    <div className="grid gap-3">
      <SegmentedControl
        aria-label="Rango del gráfico de peso"
        size="sm"
        value={range}
        onValueChange={setRange}
        options={[
          { value: "30", label: "30 d" },
          { value: "90", label: "90 d" },
          { value: "180", label: "6 m", disabled: !advanced },
          { value: "365", label: "1 año", disabled: !advanced },
        ]}
      />
      {!advanced ? (
        <p className="text-xs text-muted-foreground">
          Los rangos de 6 meses y 1 año son parte de{" "}
          <Link href="/app/premium" className="font-medium text-primary-strong underline-offset-4 hover:underline">
            Analítica avanzada (Premium)
          </Link>
          .
        </p>
      ) : null}
      {data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No hay pesajes en este rango. Registra tu peso para ver el gráfico.
        </p>
      ) : (
        <figure className="grid gap-3">
          <div className="h-60 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={xDomain}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                  tickFormatter={(t: number) => formatShortDate(new Date(t).toISOString().slice(0, 10)).split(" ").slice(1).join(" ")}
                  minTickGap={24}
                />
                <YAxis
                  width={40}
                  domain={domain ?? ["auto", "auto"]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                  tickFormatter={(v: number) => formatNumber(v, 0)}
                />
                <Tooltip content={<ChartTooltip />} />
                {goalKg != null ? (
                  <ReferenceLine y={goalKg} stroke="var(--color-foreground)" strokeOpacity={0.6} strokeDasharray="6 4" ifOverflow="extendDomain" />
                ) : null}
                <Scatter dataKey="weightKg" fill="var(--color-chart-4)" isAnimationActive={false} />
                <Line
                  dataKey="average"
                  type="monotone"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <figcaption className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-chart-4" />
              Pesaje del día
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-chart-1" />
              Promedio de 7 días
            </span>
            {goalKg != null ? (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-0 w-4 border-t-2 border-dashed border-foreground/60" />
                Meta ({formatKg(goalKg)})
              </span>
            ) : null}
          </figcaption>
          {/* sr-only en un div: una <table> ignora width:1px y desborda el ancho de la pantalla. */}
          <div className="sr-only">
            <table>
              <caption>Pesajes y promedio de 7 días</caption>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Peso</th>
                  <th scope="col">Promedio 7 días</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.date}>
                    <th scope="row">{formatShortDate(p.date)}</th>
                    <td>{formatKg(p.weightKg)}</td>
                    <td>{p.average == null ? "Sin promedio" : formatKg(p.average)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>
      )}
    </div>
  );
}
