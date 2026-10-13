import Link from "next/link";
import { Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MacroBar } from "@/components/ui/macro-bar";
import { Progress } from "@/components/ui/progress";
import type { NutritionTargetRow } from "@/lib/data/targets";
import { formatGrams, formatNumber } from "@/lib/format";
import { WHO_SODIUM_LIMIT_MG } from "@/features/dashboard/lib/recommendations";
import type { DayTotals } from "../lib/day-totals";

/** Totales del día frente a la meta vigente en esa fecha. Pasarse se informa en tono neutro. */
export function DayTotalsCard({ totals, target }: { totals: DayTotals; target: NutritionTargetRow | null }) {
  const goal = target ? Number(target.energy_kcal) : null;
  const consumed = totals.energyKcal;
  const diff = goal != null ? goal - consumed : null;
  const pct = goal ? Math.min(100, (consumed / goal) * 100) : 0;
  const fiberIncomplete = totals.incomplete.includes("fiberG");

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle as="h2">Totales del día</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <div className="flex items-baseline justify-between gap-3" data-numeric="">
            <p className="text-2xl font-semibold tracking-tight">
              {formatNumber(consumed)} <span className="text-sm font-medium text-muted-foreground">kcal</span>
            </p>
            {goal != null && diff != null ? (
              <p className="text-sm text-muted-foreground">
                {diff >= 0 ? `${formatNumber(diff)} restantes de ${formatNumber(goal)}` : `${formatNumber(-diff)} sobre tu meta de ${formatNumber(goal)}`}
              </p>
            ) : (
              <Link href="/app/perfil/metas" className="text-sm font-semibold text-primary-strong underline-offset-4 hover:underline">
                Definir mi meta
              </Link>
            )}
          </div>
          {goal != null ? (
            <Progress
              value={pct}
              aria-label="Calorías del día"
              aria-valuetext={`${formatNumber(consumed)} de ${formatNumber(goal)} kcal`}
            />
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <MacroBar macro="protein" consumed={totals.proteinG} goal={target ? Number(target.protein_g) : null} />
          <MacroBar macro="carbs" consumed={totals.carbsG} goal={target ? Number(target.carbs_g) : null} />
          <MacroBar macro="fat" consumed={totals.fatG} goal={target ? Number(target.fat_g) : null} />
          <div className="grid gap-1">
            <MacroBar macro="fiber" consumed={totals.fiberG ?? 0} goal={target?.fiber_g != null ? Number(target.fiber_g) : null} />
            {fiberIncomplete && totals.itemsCount ? (
              <p className="text-xs text-muted-foreground">Mínimo: algunos alimentos no tienen dato de fibra.</p>
            ) : null}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Azúcar</dt>
            <dd className="font-semibold" data-numeric="">
              {totals.sugarG == null ? "Sin datos" : `${totals.incomplete.includes("sugarG") ? "≥ " : ""}${formatGrams(totals.sugarG, 1)}`}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Sodio</dt>
            <dd className="font-semibold" data-numeric="">
              {totals.sodiumMg == null
                ? "Sin datos"
                : `${totals.incomplete.includes("sodiumMg") ? "≥ " : ""}${formatNumber(totals.sodiumMg)} mg`}
            </dd>
            <dd className="text-xs text-muted-foreground">Referencia OMS: menos de {formatNumber(WHO_SODIUM_LIMIT_MG)} mg</dd>
          </div>
        </dl>
        {(totals.incomplete.includes("sugarG") || totals.incomplete.includes("sodiumMg")) && totals.itemsCount ? (
          <p className="flex gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            «≥» indica un mínimo: algunos alimentos no traen ese dato en la base.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
