"use client";

import * as React from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { formatKg, formatNumber, formatShortDate } from "@/lib/format";
import { comparePeriods, type PeriodSummary, type WeightEntry } from "@/lib/nutrition";
import { periodWindows } from "../lib/analytics";

type Days = "7" | "30" | "90";

function Column({ title, summary, from, to }: { title: string; summary: PeriodSummary | null; from: string; to: string }) {
  return (
    <div className="grid content-start gap-1 rounded-xl border border-border p-4" data-numeric="">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">
        {formatShortDate(from)} – {formatShortDate(to)}
      </p>
      {summary ? (
        <>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{formatKg(summary.averageKg)}</p>
          <p className="text-xs text-muted-foreground">
            promedio de {summary.count} {summary.count === 1 ? "pesaje" : "pesajes"} · mín. {formatNumber(summary.minKg, 1)} · máx.{" "}
            {formatNumber(summary.maxKg, 1)}
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">Sin pesajes en este periodo.</p>
      )}
    </div>
  );
}

/** Compara el promedio de peso del periodo actual con el anterior (7, 30 o 90 días). Premium. */
export function PeriodComparison({ entries, today }: { entries: WeightEntry[]; today: string }) {
  const [days, setDays] = React.useState<Days>("7");
  const windows = periodWindows(today, Number(days));
  const result = comparePeriods(entries, windows.previous, windows.current);
  const delta = result.deltaKg;

  return (
    <div className="grid gap-3">
      <SegmentedControl
        aria-label="Largo de los periodos"
        size="sm"
        value={days}
        onValueChange={setDays}
        options={[
          { value: "7", label: "7 días" },
          { value: "30", label: "30 días" },
          { value: "90", label: "90 días" },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <Column title="Periodo anterior" summary={result.a} from={windows.previous.from} to={windows.previous.to} />
        <Column title="Periodo actual" summary={result.b} from={windows.current.from} to={windows.current.to} />
      </div>
      <p className="text-sm" aria-live="polite">
        {delta == null
          ? "Necesitas pesajes en ambos periodos para compararlos."
          : delta === 0
            ? "El promedio no cambió entre ambos periodos."
            : `Diferencia de promedios: ${delta > 0 ? "+" : "−"}${formatNumber(Math.abs(delta), 2)} kg (${result.deltaPct != null ? `${delta > 0 ? "+" : "−"}${formatNumber(Math.abs(result.deltaPct), 1)} %` : "—"}).`}
      </p>
    </div>
  );
}
