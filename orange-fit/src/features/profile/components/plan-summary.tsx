import * as React from "react";
import { ChevronDown, Droplet, HeartHandshake, Info, TriangleAlert, Wheat } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatGrams, formatKcal, formatMl, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TargetExplanation } from "@/features/profile/target-inputs";

export type PlanSummaryProps = {
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  waterMl: number | null;
  explanation?: Partial<
    Pick<TargetExplanation, "steps" | "assumptions" | "warnings" | "riskMessages" | "notes" | "expectedWeeklyChangeKg" | "riskLevel">
  >;
  /** Título de la tarjeta de calorías. */
  title?: string;
  showDisclaimer?: boolean;
  className?: string;
};

const MACRO_ROWS = [
  { key: "proteinG", label: "Proteína", kcalPerG: 4, dot: "bg-macro-protein" },
  { key: "carbsG", label: "Carbohidratos", kcalPerG: 4, dot: "bg-macro-carbs" },
  { key: "fatG", label: "Grasas", kcalPerG: 9, dot: "bg-macro-fat" },
] as const;

/**
 * Metas diarias con su explicación: fórmula paso a paso, supuestos, avisos y mensajes del cribado.
 * Sin hooks: sirve en Server Components y dentro del asistente (cliente).
 */
export function PlanSummary({
  energyKcal,
  proteinG,
  carbsG,
  fatG,
  fiberG,
  waterMl,
  explanation,
  title = "Tu meta diaria",
  showDisclaimer = true,
  className,
}: PlanSummaryProps) {
  const values = { proteinG, carbsG, fatG };
  const steps = explanation?.steps ?? [];
  const assumptions = explanation?.assumptions ?? [];
  const warnings = explanation?.warnings ?? [];
  const care = [...(explanation?.riskMessages ?? []), ...(explanation?.notes ?? [])];
  const professional = explanation?.riskLevel === "professional";
  const weekly = explanation?.expectedWeeklyChangeKg ?? null;

  return (
    <div className={cn("grid gap-4", className)}>
      <section aria-label={title} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="mt-1 flex items-baseline gap-1.5" data-numeric="">
          <span className="text-4xl font-semibold tracking-tight">{formatNumber(energyKcal)}</span>
          <span className="text-base font-medium text-muted-foreground">kcal</span>
        </p>
        {weekly != null && weekly < 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Ritmo esperado al inicio: unos {formatNumber(Math.abs(weekly), 2)} kg por semana. Es una estimación: el ritmo real varía.
          </p>
        ) : null}
        <ul className="mt-4 grid grid-cols-3 gap-2">
          {MACRO_ROWS.map((m) => {
            const grams = values[m.key];
            const pct = energyKcal > 0 ? Math.round((grams * m.kcalPerG * 100) / energyKcal) : 0;
            return (
              <li key={m.key} className="rounded-xl bg-muted/60 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", m.dot)} />
                  <span className="truncate">{m.label}</span>
                </p>
                <p className="mt-1 text-lg font-semibold tracking-tight" data-numeric="">
                  {formatGrams(grams)}
                </p>
                <p className="text-xs text-muted-foreground">{pct} % de las kcal</p>
              </li>
            );
          })}
        </ul>
        <ul className="mt-2 grid grid-cols-2 gap-2">
          <li className="flex items-center gap-2 rounded-xl bg-muted/60 p-3">
            <Wheat className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm">
              Fibra <span className="font-semibold" data-numeric="">{fiberG != null ? formatGrams(fiberG) : "—"}</span>
            </span>
          </li>
          <li className="flex items-center gap-2 rounded-xl bg-muted/60 p-3">
            <Droplet className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm">
              Agua <span className="font-semibold" data-numeric="">{waterMl != null ? formatMl(waterMl) : "—"}</span>
            </span>
          </li>
        </ul>
      </section>

      {care.length > 0 ? (
        <Alert variant="info">
          <HeartHandshake aria-hidden="true" />
          <AlertTitle>{professional ? "Te recomendamos acompañamiento profesional" : "Para cuidarte"}</AlertTitle>
          <AlertDescription>
            <ul className="grid list-disc gap-1.5 pl-4">
              {care.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {warnings.length > 0 ? (
        <Alert variant="warning">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Ten en cuenta</AlertTitle>
          <AlertDescription>
            <ul className="grid list-disc gap-1.5 pl-4">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {steps.length > 0 ? (
        <details className="group rounded-2xl border border-border bg-card shadow-sm">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-3 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            Cómo lo calculamos
            <ChevronDown aria-hidden="true" className="size-5 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <ol className="grid gap-3 px-5 pb-5">
            {steps.map((s, i) => (
              <li key={`${s.label}-${i}`} className="grid gap-0.5 border-t border-border pt-3 first:border-t-0 first:pt-0">
                <p className="flex items-baseline justify-between gap-3 text-sm font-medium">
                  <span>{s.label}</span>
                  <span className="shrink-0 font-semibold" data-numeric="">
                    {s.unit === "kcal" ? formatKcal(s.value) : s.unit === "ml" ? formatMl(s.value) : `${formatNumber(s.value, s.unit === "kg" ? 1 : 0)} ${s.unit}`}
                  </span>
                </p>
                <p className="font-mono text-xs leading-relaxed text-muted-foreground">{s.formula}</p>
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      {assumptions.length > 0 ? (
        <details className="group rounded-2xl border border-border bg-card shadow-sm">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-3 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
            Supuestos y fuentes
            <ChevronDown aria-hidden="true" className="size-5 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <ul className="grid list-disc gap-2 px-5 pb-5 pl-9 text-sm text-muted-foreground">
            {assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {showDisclaimer ? (
        <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Estas metas son una estimación de partida a partir de fórmulas validadas en población general. No son un diagnóstico
          ni reemplazan la evaluación de un profesional de la salud.
        </p>
      ) : null}
    </div>
  );
}
