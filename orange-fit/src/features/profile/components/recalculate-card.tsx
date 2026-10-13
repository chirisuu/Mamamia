"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { formatKcal, formatKg, formatShortDate } from "@/lib/format";
import { recalculateTargets } from "../actions";

export type RecalcPreview =
  | {
      ok: true;
      energyKcal: number;
      proteinG: number;
      carbsG: number;
      fatG: number;
      weightKg: number;
      weightDate: string | null;
      weightKind: "weight_log" | "goal" | "onboarding";
      maintenanceByProfile: boolean;
    }
  | { ok: false; reason: string };

/** Vista previa del recálculo con el peso más reciente y botón para guardarlo como meta nueva. */
export function RecalculateCard({ preview, currentKcal }: { preview: RecalcPreview; currentKcal: number | null }) {
  const [pending, startTransition] = React.useTransition();

  if (!preview.ok) {
    return <p className="text-sm text-muted-foreground">{preview.reason}</p>;
  }
  const diff = currentKcal != null ? preview.energyKcal - currentKcal : null;

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Con tu peso de <span className="font-medium text-foreground">{formatKg(preview.weightKg)}</span>
        {preview.weightDate ? ` (${formatShortDate(preview.weightDate)})` : preview.weightKind === "goal" ? " (el de tu objetivo)" : ""}, tu
        meta sería:
      </p>
      <p className="flex items-baseline gap-2" data-numeric="">
        <span className="text-3xl font-semibold tracking-tight">{formatKcal(preview.energyKcal)}</span>
        {diff != null && diff !== 0 ? (
          <span className="text-sm text-muted-foreground">
            ({diff > 0 ? "+" : "−"}
            {formatKcal(Math.abs(diff))} vs. la actual)
          </span>
        ) : diff === 0 ? (
          <span className="text-sm text-muted-foreground">(igual a la actual)</span>
        ) : null}
      </p>
      <p className="text-sm text-muted-foreground" data-numeric="">
        Proteína {preview.proteinG} g · Carbohidratos {preview.carbsG} g · Grasas {preview.fatG} g
      </p>
      {preview.maintenanceByProfile ? (
        <p className="text-sm text-muted-foreground">Por tu perfil de salud, la meta automática es de mantenimiento.</p>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await recalculateTargets();
            if (result.ok) toast.success(`Nueva meta: ${formatKcal(result.data.energyKcal)} desde hoy.`);
            else toast.error(result.error.message);
          })
        }
      >
        {pending ? null : <RefreshCw aria-hidden="true" />}
        Guardar como mi nueva meta
      </Button>
    </div>
  );
}
