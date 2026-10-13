"use client";

import * as React from "react";
import { CalendarPlus, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberStepper } from "@/components/ui/number-stepper";
import { formatNumber } from "@/lib/format";
import { logRecipeAction } from "../actions";
import type { RecipeServingNutrition } from "../lib/adapters";
import type { RecipeMealType } from "../lib/labels";
import { nutritionForServings, scaleIngredients } from "../lib/nutrition";
import { AddToPlanDialog, type PlanChoice } from "./add-to-plan-dialog";
import { LogToDiaryDialog } from "./log-to-diary-dialog";

export interface DetailIngredientView {
  id: string;
  name: string;
  grams: number;
  displayQuantity: number | null;
  displayUnit: string | null;
  note: string | null;
}

function quantityText(i: DetailIngredientView): string {
  const grams = `${formatNumber(i.grams, i.grams < 10 ? 1 : 0)} g`;
  if (i.displayQuantity != null && i.displayUnit) {
    return `${formatNumber(i.displayQuantity, Number.isInteger(i.displayQuantity) ? 0 : 2)} ${i.displayUnit} (${grams})`;
  }
  return grams;
}

/**
 * Porciones ajustables: reescala ingredientes (`scaleRecipe`) y nutrientes. Desde aquí se registra
 * en el diario o se agrega a un plan con las porciones elegidas.
 */
export function RecipeDetailView({
  recipe,
  perServing,
  ingredients,
  today,
  maxDate,
  defaultMeal,
  plans,
  canPlan,
}: {
  recipe: { id: string; title: string; servings: number; mealTypes: string[] };
  perServing: RecipeServingNutrition | null;
  ingredients: DetailIngredientView[];
  today: string;
  maxDate: string;
  defaultMeal: RecipeMealType;
  plans: PlanChoice[];
  canPlan: boolean;
}) {
  const [servings, setServings] = React.useState(recipe.servings);
  const [logOpen, setLogOpen] = React.useState(false);
  const [planOpen, setPlanOpen] = React.useState(false);
  const scaled = React.useMemo(() => scaleIngredients(ingredients, recipe.servings, servings), [ingredients, recipe.servings, servings]);
  const total = perServing ? nutritionForServings(perServing, servings) : null;
  const one = perServing ? nutritionForServings(perServing, 1) : null;
  const mealDefault: RecipeMealType = recipe.mealTypes.includes(defaultMeal)
    ? defaultMeal
    : ((recipe.mealTypes.find((m) => m !== "custom") as RecipeMealType | undefined) ?? defaultMeal);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" className="flex-1" onClick={() => setLogOpen(true)} disabled={!perServing}>
          <NotebookPen aria-hidden="true" />
          Añadir al diario
        </Button>
        <Button type="button" variant="outline" className="flex-1" onClick={() => setPlanOpen(true)} disabled={!perServing}>
          <CalendarPlus aria-hidden="true" />
          Añadir al plan
        </Button>
      </div>
      {!perServing ? <p className="text-sm text-muted-foreground">Esta receta aún no tiene ingredientes, así que no se puede registrar ni planificar.</p> : null}

      <section aria-labelledby="nutricion" className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 id="nutricion" className="text-base font-semibold">
          Nutrición por porción
        </h2>
        {one ? (
          <>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5" data-numeric>
              <Stat label="Energía" value={`${formatNumber(one.kcal)} kcal`} strong />
              <Stat label="Proteína" value={`${formatNumber(one.proteinG, 1)} g`} />
              <Stat label="Carbohidratos" value={`${formatNumber(one.carbsG, 1)} g`} />
              <Stat label="Grasas" value={`${formatNumber(one.fatG, 1)} g`} />
              <Stat label="Fibra" value={`${one.fiberIncomplete ? "≥ " : ""}${formatNumber(one.fiberG, 1)} g`} />
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              Calculada desde ingredientes (gramos × valores por 100 g de la base de alimentos). Valores aproximados
              {one.fiberIncomplete ? "; la fibra es un mínimo porque algún ingrediente no tiene el dato" : ""}. Una porción ≈{" "}
              {formatNumber(one.grams)} g.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Sin ingredientes no se puede calcular.</p>
        )}
      </section>

      <section aria-labelledby="ingredientes" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="ingredientes" className="text-lg font-semibold tracking-tight">
            Ingredientes
          </h2>
          <NumberStepper
            label="Porciones"
            value={servings}
            onValueChange={setServings}
            min={0.5}
            max={50}
            step={0.5}
            unit={servings === 1 ? "porción" : "porciones"}
            className="w-full sm:w-64"
          />
        </div>
        {servings !== recipe.servings ? (
          <p className="text-sm text-muted-foreground" role="status">
            Cantidades para {formatNumber(servings, Number.isInteger(servings) ? 0 : 1)} porciones (la receta original es para{" "}
            {formatNumber(recipe.servings, Number.isInteger(recipe.servings) ? 0 : 1)}).
            {total ? ` Total: ${formatNumber(total.kcal)} kcal y ${formatNumber(total.proteinG, 1)} g de proteína.` : ""}
          </p>
        ) : null}
        {scaled.length ? (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {scaled.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{i.name}</p>
                  {i.note ? <p className="text-sm text-muted-foreground">{i.note}</p> : null}
                </div>
                <p className="shrink-0 text-right text-sm tabular-nums text-muted-foreground">{quantityText(i)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Sin ingredientes.</p>
        )}
      </section>

      <LogToDiaryDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        title={recipe.title}
        description={`${recipe.title}: elige la fecha, la comida y cuántas porciones comiste.`}
        defaultDate={today}
        maxDate={maxDate}
        defaultMeal={mealDefault}
        initialServings={1}
        onSubmit={(v) => logRecipeAction({ recipeId: recipe.id, localDate: v.localDate, mealType: v.mealType, servings: v.servings })}
      />
      <AddToPlanDialog open={planOpen} onOpenChange={setPlanOpen} recipe={recipe} plans={plans} canPlan={canPlan} />
    </div>
  );
}

function Stat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-muted px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={strong ? "text-lg font-semibold tabular-nums" : "text-base font-medium tabular-nums"}>{value}</dd>
    </div>
  );
}
