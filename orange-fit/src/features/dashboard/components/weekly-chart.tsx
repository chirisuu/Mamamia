"use client";

import * as React from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber, formatShortDate } from "@/lib/format";
import type { WeeklyPoint } from "../lib/series";

type TooltipPayload = { payload?: WeeklyPoint }[];

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md" data-numeric="">
      <p className="font-semibold">{formatShortDate(point.date)}</p>
      <p className="text-muted-foreground">
        Consumido:{" "}
        <span className="font-medium text-foreground">{point.consumed == null ? "sin registro" : `${formatNumber(point.consumed)} kcal`}</span>
      </p>
      <p className="text-muted-foreground">
        Meta: <span className="font-medium text-foreground">{point.target == null ? "—" : `${formatNumber(point.target)} kcal`}</span>
      </p>
    </div>
  );
}

const compact = (v: number) => (v >= 1000 ? `${formatNumber(v / 1000, 1)}k` : formatNumber(v));

/**
 * kcal consumidas (barras) frente a la meta de cada día (línea). Un solo eje (kcal).
 * Los días sin registro no dibujan barra (no son 0 kcal). Incluye una tabla para lectores de pantalla.
 */
export function WeeklyChart({ data }: { data: WeeklyPoint[] }) {
  const hasTarget = data.some((d) => d.target != null);
  return (
    <figure className="grid gap-3">
      <div className="h-52 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeWidth={1} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
              interval={0}
            />
            <YAxis
              width={40}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
              tickFormatter={compact}
              allowDecimals={false}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-muted)", opacity: 0.6 }} />
            <Bar dataKey="consumed" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            {hasTarget ? (
              <Line
                dataKey="target"
                type="stepAfter"
                stroke="var(--color-foreground)"
                strokeOpacity={0.7}
                strokeWidth={2}
                dot={false}
                activeDot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-chart-1" />
          Consumido
        </span>
        {hasTarget ? (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-foreground/70" />
            Meta del día
          </span>
        ) : null}
      </figcaption>
      {/* sr-only en un div: una <table> ignora width:1px y desborda el ancho de la pantalla. */}
      <div className="sr-only">
        <table>
          <caption>Calorías consumidas y meta de los últimos 7 días</caption>
          <thead>
            <tr>
              <th scope="col">Día</th>
              <th scope="col">Consumido</th>
              <th scope="col">Meta</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date}>
                <th scope="row">{formatShortDate(d.date)}</th>
                <td>{d.consumed == null ? "Sin registro" : `${formatNumber(d.consumed)} kcal`}</td>
                <td>{d.target == null ? "Sin meta" : `${formatNumber(d.target)} kcal`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
