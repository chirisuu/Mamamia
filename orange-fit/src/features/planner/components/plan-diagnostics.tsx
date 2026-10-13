"use client";

import { CheckCircle2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DraftDiagnostics } from "../lib/diagnostics";
import type { GenerationSummary } from "../lib/types";

/**
 * Diagnóstico del plan: kcal y proteína por día contra la meta, costo contra presupuesto y avisos.
 * Fuera de la tolerancia no se pinta en rojo: se informa con texto.
 */
export function PlanDiagnostics({
  diagnostics,
  generation,
  selectedDay,
  onSelectDay,
  floorNote,
}: {
  diagnostics: DraftDiagnostics;
  generation: GenerationSummary | null;
  selectedDay: number;
  onSelectDay: (day: number) => void;
  floorNote?: string | null;
}) {
  const d = diagnostics;
  const target = d.days[0]?.targetKcal ?? null;
  const proteinTarget = d.days[0]?.proteinTargetG ?? null;
  return (
    <section aria-labelledby="diagnostico" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="diagnostico" className="text-base font-semibold">
            Resumen de la semana
          </h2>
          <p className="text-sm text-muted-foreground" data-numeric>
            {target ? `Meta: ${formatNumber(target)} kcal${proteinTarget ? ` y ${formatNumber(proteinTarget)} g de proteína` : ""} al día · ` : ""}
            Promedio: {formatNumber(d.avgKcal)} kcal y {formatNumber(d.avgProteinG, 1)} g de proteína
          </p>
        </div>
        {d.allWithinTolerance === true ? (
          <Badge variant="success">
            <CheckCircle2 aria-hidden="true" />
            Todos los días dentro de ±{d.tolerancePct} %
          </Badge>
        ) : null}
      </div>

      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[22rem] text-sm">
          <caption className="sr-only">Calorías y proteína por día comparadas con tu meta</caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="py-1.5 pr-2 font-medium">
                Día
              </th>
              <th scope="col" className="py-1.5 pr-2 text-right font-medium">
                kcal
              </th>
              <th scope="col" className="py-1.5 pr-2 text-right font-medium">
                vs meta
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                Proteína
              </th>
            </tr>
          </thead>
          <tbody>
            {d.days.map((day) => (
              <tr key={day.dayIndex} className={cn("border-t border-border", selectedDay === day.dayIndex && "bg-accent/60")}>
                <th scope="row" className="py-1 pr-2 text-left font-normal">
                  <button
                    type="button"
                    onClick={() => onSelectDay(day.dayIndex)}
                    aria-current={selectedDay === day.dayIndex ? "true" : undefined}
                    className="min-h-11 rounded-lg text-left font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {day.label}
                  </button>
                </th>
                <td className="py-1 pr-2 text-right tabular-nums">{formatNumber(day.kcal)}</td>
                <td className="py-1 pr-2 text-right tabular-nums">
                  {day.deviationPct == null ? (
                    "—"
                  ) : (
                    <span className={day.withinTolerance ? "" : "font-semibold"}>
                      {day.deviationPct > 0 ? "+" : ""}
                      {formatNumber(day.deviationPct, 1)} %
                      {day.withinTolerance ? <span className="sr-only"> (dentro de la tolerancia)</span> : <span className="sr-only"> (fuera de la tolerancia)</span>}
                    </span>
                  )}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {formatNumber(day.proteinG)} g{day.proteinPct != null ? <span className="text-muted-foreground"> ({formatNumber(day.proteinPct)} %)</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        {d.estimatedCost != null ? (
          <p>
            Costo referencial: <span className="font-semibold tabular-nums">{formatMoney(d.estimatedCost, d.currency ?? "PEN")}</span>
            {d.costIsPartial ? " (parcial)" : ""}
            {d.budget != null ? ` · Presupuesto para estos días: ${formatMoney(d.budget, d.currency ?? "PEN")}` : ""}
          </p>
        ) : (
          <p className="text-muted-foreground">Sin costo referencial para estas comidas.</p>
        )}
        <p className="text-xs text-muted-foreground">Precios referenciales, no en tiempo real.</p>
      </div>

      {d.warnings.length || floorNote || generation?.warnings.length ? (
        <ul className="flex flex-col gap-1.5 text-sm">
          {[...(floorNote ? [floorNote] : []), ...d.warnings, ...(generation?.warnings ?? [])].map((w, i) => (
            <li key={i} className="flex gap-2">
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {generation ? (
        <p className="text-xs text-muted-foreground">
          Generado sin IA con {generation.recipesEligible} de {generation.recipesProvided} recetas
          {generation.excluded.allergens ? ` · ${generation.excluded.allergens} excluidas por alérgenos` : ""}
          {generation.excluded.diet ? ` · ${generation.excluded.diet} por tu dieta` : ""}
          {generation.excluded.prepTime ? ` · ${generation.excluded.prepTime} por tiempo` : ""}.
        </p>
      ) : null}
    </section>
  );
}
