"use client";

import * as React from "react";
import Link from "next/link";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNumber, formatShortDate } from "@/lib/format";
import { measurementSeries, seriesChange, type MeasurementRow } from "../lib/analytics";
import { MEASUREMENT_FIELDS, type MeasurementColumn } from "../schemas";

/**
 * Evolución de una medida. En el plan gratis se ven los últimos 30 días; el historial largo es de
 * Analítica avanzada (Premium). El servidor ya recorta los datos según el plan.
 */
export function MeasurementsChart({ rows, advanced, since }: { rows: MeasurementRow[]; advanced: boolean; since: string | null }) {
  const available = MEASUREMENT_FIELDS.filter((f) => rows.some((r) => r[f.column] != null));
  const [column, setColumn] = React.useState<MeasurementColumn>(available[0]?.column ?? "waist_cm");
  const field = MEASUREMENT_FIELDS.find((f) => f.column === column) ?? MEASUREMENT_FIELDS[0];
  const series = measurementSeries(rows, column, since);
  const change = seriesChange(series);
  const id = React.useId();

  if (available.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Cuando registres tus medidas, aquí verás cómo cambian.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={id}>Medida</Label>
        <Select value={column} onValueChange={(v) => setColumn(v as MeasurementColumn)}>
          <SelectTrigger id={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {available.map((f) => (
              <SelectItem key={f.column} value={f.column}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {series.length === 0
          ? `Sin registros de ${field.label.toLowerCase()} en este rango.`
          : change == null
            ? `Un registro de ${field.label.toLowerCase()}: ${formatNumber(series[0]!.value, 1)} cm.`
            : `${field.label}: ${change === 0 ? "sin cambio" : `${change > 0 ? "+" : "−"}${formatNumber(Math.abs(change), 1)} cm`} desde el ${formatShortDate(series[0]!.date)}.`}
      </p>
      {series.length > 0 ? (
        <figure className="grid gap-2">
          <div className="h-48 w-full" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                <CartesianGrid vertical={false} stroke="var(--color-border)" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                  tickFormatter={(d: string) => formatShortDate(d).split(" ").slice(1).join(" ")}
                  minTickGap={24}
                />
                <YAxis
                  width={40}
                  domain={["dataMin - 2", "dataMax + 2"]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                  tickFormatter={(v: number) => formatNumber(v, 0)}
                />
                <Tooltip
                  formatter={(v) => [`${formatNumber(Number(v), 1)} cm`, field.label]}
                  labelFormatter={(d) => formatShortDate(String(d))}
                  contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12 }}
                />
                <Line dataKey="value" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* sr-only en un div: una <table> ignora width:1px y desborda el ancho de la pantalla. */}
          <div className="sr-only">
            <table>
              <caption>{field.label} por fecha</caption>
              <tbody>
                {series.map((p) => (
                  <tr key={p.date}>
                    <th scope="row">{formatShortDate(p.date)}</th>
                    <td>{formatNumber(p.value, 1)} cm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>
      ) : null}
      {!advanced ? (
        <p className="text-xs text-muted-foreground">
          Ves los últimos 30 días. El historial completo de medidas es parte de{" "}
          <Link href="/app/premium" className="font-medium text-primary-strong underline-offset-4 hover:underline">
            Analítica avanzada (Premium)
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
