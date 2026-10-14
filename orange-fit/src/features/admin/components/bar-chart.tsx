"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/lib/format";
import { formatUsd } from "../lib/metrics";

export type BarDatum = { label: string; value: number; hint?: string };

type TooltipPayload = { payload?: BarDatum }[];

const SERIES = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

function ChartTooltip({ active, payload, format }: { active?: boolean; payload?: TooltipPayload; format: (n: number) => string }) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md" data-numeric="">
      <p className="font-semibold">{point.label}</p>
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">{format(point.value)}</span>
        {point.hint ? ` · ${point.hint}` : null}
      </p>
    </div>
  );
}

const compact = (v: number) => (v >= 1000 ? `${formatNumber(v / 1000, 1)}k` : formatNumber(v));

/**
 * Barras simples con etiqueta en el eje (el color no es la única señal) y una tabla para lectores
 * de pantalla con los mismos números.
 */
/**
 * Formato de los valores. Es un nombre y no una función porque las páginas que lo usan son de
 * servidor: una función no se puede pasar como prop a un componente de cliente.
 */
export type BarValueFormat = "number" | "usd";
const FORMATTERS: Record<BarValueFormat, (n: number) => string> = {
  number: (n) => formatNumber(n),
  usd: (n) => formatUsd(n),
};

export function SimpleBarChart({
  data,
  caption,
  valueLabel,
  valueFormat = "number",
  multicolor = false,
}: {
  data: BarDatum[];
  caption: string;
  valueLabel: string;
  valueFormat?: BarValueFormat;
  multicolor?: boolean;
}) {
  const format = FORMATTERS[valueFormat];
  const empty = data.every((d) => d.value === 0);
  return (
    <figure className="grid gap-3">
      {empty ? (
        <p className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">Sin datos en este periodo.</p>
      ) : (
        <div className="h-56 w-full" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeWidth={1} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} interval={0} />
              <YAxis width={44} tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} tickFormatter={compact} allowDecimals={false} />
              <Tooltip content={<ChartTooltip format={format} />} cursor={{ fill: "var(--color-muted)", opacity: 0.6 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48} isAnimationActive={false}>
                {data.map((d, i) => (
                  <Cell key={d.label} fill={multicolor ? SERIES[i % SERIES.length] : SERIES[0]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <figcaption className="text-xs text-muted-foreground">{caption}</figcaption>
      {/* sr-only en un div: una <table> ignora width:1px y desborda el ancho de la pantalla. */}
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Categoría</th>
              <th scope="col">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <th scope="row">{d.label}</th>
                <td>{format(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
