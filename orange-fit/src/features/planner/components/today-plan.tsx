"use client";

import * as React from "react";
import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { LogToDiaryDialog } from "@/features/recipes/components/log-to-diary-dialog";
import { logPlanItemAction } from "../actions";
import { planSlots } from "../lib/plan";
import type { DraftItem } from "../lib/types";

/** Comidas de hoy del plan activo, con "Registrar esta comida" (source 'plan'). */
export function TodayPlan({
  planId,
  planName,
  mealsPerDay,
  items,
  today,
  tomorrow,
}: {
  planId: string;
  planName: string;
  mealsPerDay: number;
  items: DraftItem[];
  today: string;
  tomorrow: string;
}) {
  const [logKey, setLogKey] = React.useState<string | null>(null);
  const slots = planSlots(mealsPerDay);
  const logItem = items.find((i) => i.key === logKey) ?? null;
  const amount = (it: DraftItem) =>
    it.kind === "recipe" ? `${formatNumber(it.servings ?? 1, Number.isInteger(it.servings ?? 1) ? 0 : 2)} porc.` : `${formatNumber(it.grams ?? 0)} g`;

  return (
    <section aria-labelledby="hoy-plan" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="hoy-plan" className="text-base font-semibold">
          Hoy en tu plan
        </h2>
        <Link href={`/app/plan/${planId}`} className="text-sm font-medium text-primary-strong underline-offset-4 hover:underline">
          {planName}
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tu plan activo no tiene comidas para hoy.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {[...items]
            .sort((a, b) => a.slotIndex - b.slotIndex)
            .map((it) => (
              <li key={it.key} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{slots[it.slotIndex]?.label ?? "Comida"}</p>
                  <p className="truncate font-medium">{it.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {amount(it)} · {formatNumber(it.kcal)} kcal
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setLogKey(it.key)} disabled={!it.id || (!it.recipeId && !it.foodId)}>
                  <NotebookPen aria-hidden="true" className="size-4" />
                  Registrar
                </Button>
              </li>
            ))}
        </ul>
      )}
      {logItem ? (
        <LogToDiaryDialog
          open
          onOpenChange={(o) => !o && setLogKey(null)}
          title={logItem.name}
          description={`${logItem.name} · ${amount(logItem)} (${formatNumber(logItem.kcal)} kcal)`}
          defaultDate={today}
          maxDate={tomorrow}
          defaultMeal={slots[logItem.slotIndex]?.mealType ?? "snack"}
          servingsEditable={false}
          amountLabel={amount(logItem)}
          onSubmit={(v) => logPlanItemAction({ itemId: logItem.id!, localDate: v.localDate, mealType: v.mealType })}
        />
      ) : null}
    </section>
  );
}
