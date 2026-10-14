"use client";

import * as React from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatTile } from "@/components/ui/stat-tile";
import { formatMl, formatNumber, formatShortDate } from "@/lib/format";
import { summarizeWater, type WaterDay } from "../lib/water-stats";

type Range = "7" | "30";

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload?: WaterDay }[] }) {
  const d = active ? payload?.[0]?.payload : undefined;
  if (!d) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md" data-numeric="">
      <p className="font-semibold">{formatShortDate(d.date)}</p>
      <p className="text-muted-foreground">
        Agua: <span className="font-medium text-foreground">{d.ml == null ? "sin registro" : formatMl(d.ml)}</span>
      </p>
      {d.targetMl != null ? (
        <p className="text-muted-foreground">
          Meta: <span className="font-medium text-foreground">{formatMl(d.targetMl)}</span>
        </p>
      ) : null}
    </div>
  );
}

const shortLabel = (date: string) => formatShortDate(date).split(" ").slice(1).join(" ");
const compact = (v: number) => (v >= 1000 ? `${formatNumber(v / 1000, 1)} L` : `${formatNumber(v)}`);

/** Historial de agua de 7 o 30 días: barras por día (sin barra si no hubo registro) y línea de meta. */
export function WaterHistory({ history }: { history: WaterDay[] }) {
  const [range, setRange] = React.useState<Range>("7");
  const data = React.useMemo(() => history.slice(-Number(range)).map((d) => ({ ...d, label: shortLabel(d.date) })), [history, range]);
  const summary = summarizeWater(data);
  const hasTarget = data.some((d) => d.targetMl != null);

  return (
    <div className="grid gap-4">
      <SegmentedControl
        aria-label="Rango del historial"
        size="sm"
        value={range}
        onValueChange={setRange}
        options={[
          { value: "7", label: "7 días" },
          { value: "30", label: "30 días" },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Promedio por día" value={summary.averageMl == null ? null : formatMl(summary.averageMl)} hint={`${summary.daysLogged} de ${summary.days} días con registro`} />
        <StatTile
          label="Días en tu meta"
          value={hasTarget ? formatNumber(summary.daysReached) : null}
          hint={hasTarget ? `de ${summary.days} días` : "Sin meta de agua"}
        />
      </div>
      <figure className="grid gap-3">
        <div className="h-52 w-full" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -4 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                interval={range === "7" ? 0 : "preserveStartEnd"}
                minTickGap={16}
              />
              <YAxis
                width={44}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                tickFormatter={compact}
                allowDecimals={false}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)", opacity: 0.6 }} />
              <Bar dataKey="ml" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
              {hasTarget ? (
                <Line
                  dataKey="targetMl"
                  type="stepAfter"
                  stroke="var(--color-foreground)"
                  strokeOpacity={0.7}
                  strokeWidth={2}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <figcaption className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-sm bg-chart-1" />
            Agua registrada
          </span>
          {hasTarget ? (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-foreground/70" />
              Meta
            </span>
          ) : null}
        </figcaption>
        {/* sr-only en un div: una <table> ignora width:1px y desborda el ancho de la pantalla. */}
        <div className="sr-only">
          <table>
            <caption>Agua registrada por día</caption>
            <thead>
              <tr>
                <th scope="col">Día</th>
                <th scope="col">Agua</th>
                <th scope="col">Meta</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date}>
                  <th scope="row">{formatShortDate(d.date)}</th>
                  <td>{d.ml == null ? "Sin registro" : formatMl(d.ml)}</td>
                  <td>{d.targetMl == null ? "Sin meta" : formatMl(d.targetMl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </figure>
    </div>
  );
}
