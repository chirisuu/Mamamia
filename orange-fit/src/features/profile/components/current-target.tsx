import { Badge } from "@/components/ui/badge";
import { formatShortDate } from "@/lib/format";
import type { Tables } from "@/lib/db/database.types";
import { parseTargetInputs, targetSourceLabel } from "../target-inputs";
import { PlanSummary } from "./plan-summary";

/** Meta vigente con su origen (automática, manual o fijada por un profesional) y su explicación. */
export function CurrentTarget({ target, setBy }: { target: Tables<"nutrition_targets">; setBy: string | null }) {
  const explanation = parseTargetInputs(target.inputs);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant={target.source === "professional" ? "default" : "secondary"}>
          {target.source === "professional" && setBy ? `Fijada por ${setBy}` : targetSourceLabel(target.source)}
        </Badge>
        <span>Desde {formatShortDate(target.effective_from)}</span>
      </div>
      {target.notes ? (
        <blockquote className="rounded-2xl border-l-4 border-primary bg-card px-4 py-3 text-sm">
          <p className="font-medium">{target.source === "professional" ? "Nota de tu profesional" : "Tu nota"}</p>
          <p className="mt-1 whitespace-pre-line text-muted-foreground">{target.notes}</p>
        </blockquote>
      ) : null}
      <PlanSummary
        title="Meta diaria vigente"
        energyKcal={target.energy_kcal}
        proteinG={target.protein_g}
        carbsG={target.carbs_g}
        fatG={target.fat_g}
        fiberG={target.fiber_g}
        waterMl={target.water_ml}
        explanation={explanation}
      />
      {target.source !== "auto" && explanation.steps.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {target.source === "manual"
            ? "Es una meta escrita a mano: no tiene fórmula detrás."
            : "Es una meta definida por tu profesional según su evaluación."}
          {explanation.tdee != null ? ` Tu gasto estimado de referencia era ${explanation.tdee} kcal.` : ""}
        </p>
      ) : null}
    </div>
  );
}
