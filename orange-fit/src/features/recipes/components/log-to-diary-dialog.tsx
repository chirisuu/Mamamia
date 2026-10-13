"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import { toast } from "@/components/ui/sonner";
import type { ActionResult } from "@/lib/action-result";
import { isIsoDate } from "@/lib/dates";
import { RECIPE_MEAL_TYPE_LABELS, RECIPE_MEAL_TYPES, type RecipeMealType } from "../lib/labels";
import { ToggleChip } from "./toggle-chip";

export interface LogValues {
  localDate: string;
  mealType: RecipeMealType;
  servings: number;
}

/**
 * Registrar en el diario: fecha (hasta mañana), comida y porciones. Lo usan la receta y el plan.
 * La acción la decide quien lo usa (`onSubmit`); los nutrientes los calcula el servidor.
 */
export function LogToDiaryDialog({
  open,
  onOpenChange,
  title,
  description,
  defaultDate,
  maxDate,
  defaultMeal,
  initialServings = 1,
  servingsEditable = true,
  amountLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  defaultDate: string;
  maxDate: string;
  defaultMeal: RecipeMealType;
  initialServings?: number;
  servingsEditable?: boolean;
  /** Texto fijo de la cantidad cuando no se editan porciones (p. ej. "120 g"). */
  amountLabel?: string;
  onSubmit: (values: LogValues) => Promise<ActionResult<unknown>>;
}) {
  const [date, setDate] = React.useState(defaultDate);
  const [meal, setMeal] = React.useState<RecipeMealType>(defaultMeal);
  const [servings, setServings] = React.useState(initialServings);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [done, setDone] = React.useState<string | null>(null);
  const dateId = React.useId();

  // Al abrir, vuelve a los valores sugeridos.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDate(defaultDate);
      setMeal(defaultMeal);
      setServings(initialServings);
      setError(null);
      setDone(null);
    }
  }

  const submit = () => {
    if (!isIsoDate(date) || date > maxDate) {
      setError("Elige una fecha hasta mañana.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await onSubmit({ localDate: date, mealType: meal, servings });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      toast.success(`Registrado en ${RECIPE_MEAL_TYPE_LABELS[meal].toLowerCase()}`);
      setDone(date);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar en el diario</DialogTitle>
          <DialogDescription>{description ?? title}</DialogDescription>
        </DialogHeader>
        {done ? (
          <div className="flex flex-col gap-4" role="status">
            <p className="text-sm">Listo: quedó registrado en tu diario con los valores calculados desde sus ingredientes.</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Seguir aquí
              </Button>
              <Button asChild>
                <Link href={`/app/diario/${done}`}>Ver diario</Link>
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor={dateId}>Fecha</Label>
              <Input id={dateId} type="date" value={date} max={maxDate} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">Comida</legend>
              <div className="flex flex-wrap gap-2">
                {RECIPE_MEAL_TYPES.map((m) => (
                  <ToggleChip key={m} pressed={meal === m} onPressedChange={() => setMeal(m)}>
                    {RECIPE_MEAL_TYPE_LABELS[m]}
                  </ToggleChip>
                ))}
              </div>
            </fieldset>
            {servingsEditable ? (
              <NumberStepper label="Porciones" value={servings} onValueChange={setServings} min={0.25} max={20} step={0.25} unit="porciones" />
            ) : amountLabel ? (
              <p className="text-sm">
                Cantidad: <span className="font-semibold">{amountLabel}</span>
              </p>
            ) : null}
            {error ? (
              <p className="text-sm font-medium text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={pending}>
                Registrar
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
