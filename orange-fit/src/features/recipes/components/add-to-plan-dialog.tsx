"use client";

import * as React from "react";
import Link from "next/link";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { addRecipeToPlanAction } from "@/features/planner/actions";
import { dayLabelFor } from "@/features/planner/lib/diagnostics";
import { planSlots } from "@/features/planner/lib/plan";
import { PLAN_STATUS_LABELS, type PlanStatus } from "@/features/planner/lib/types";

export interface PlanChoice {
  id: string;
  name: string;
  startDate: string;
  days: number;
  status: PlanStatus;
  mealsPerDay: number;
}

/** "Añadir al plan": elige plan, día y comida. Los nutrientes los calcula el servidor. */
export function AddToPlanDialog({
  open,
  onOpenChange,
  recipe,
  plans,
  canPlan,
  initialServings = 1,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: { id: string; title: string; mealTypes: string[] };
  plans: PlanChoice[];
  canPlan: boolean;
  initialServings?: number;
}) {
  const [planId, setPlanId] = React.useState(plans[0]?.id ?? "");
  const plan = plans.find((p) => p.id === planId) ?? plans[0];
  const slots = plan ? planSlots(plan.mealsPerDay) : [];
  const preferredSlot = slots.find((s) => recipe.mealTypes.includes(s.mealType))?.index ?? 0;
  const [day, setDay] = React.useState(0);
  const [slot, setSlot] = React.useState(preferredSlot);
  const [servings, setServings] = React.useState(initialServings);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [addedTo, setAddedTo] = React.useState<string | null>(null);

  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setError(null);
      setAddedTo(null);
      setServings(initialServings);
    }
  }

  const choosePlan = (id: string) => {
    setPlanId(id);
    const next = plans.find((p) => p.id === id);
    if (!next) return;
    setDay((d) => Math.min(d, next.days - 1));
    setSlot(planSlots(next.mealsPerDay).find((s) => recipe.mealTypes.includes(s.mealType))?.index ?? 0);
  };

  const submit = () => {
    if (!plan) return;
    setError(null);
    startTransition(async () => {
      const res = await addRecipeToPlanAction({ planId: plan.id, recipeId: recipe.id, dayIndex: day, slotIndex: slot, servings });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      toast.success("Receta agregada al plan");
      setAddedTo(plan.id);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir al plan</DialogTitle>
          <DialogDescription>{recipe.title}</DialogDescription>
        </DialogHeader>
        {!canPlan ? (
          <div className="flex flex-col items-start gap-3">
            <p className="flex items-center gap-2 text-sm">
              <Crown className="size-5 text-primary-strong" aria-hidden="true" />
              Los planes de comidas son parte de Premium.
            </p>
            <Button asChild>
              <Link href="/app/premium">Ver Premium</Link>
            </Button>
          </div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">Aún no tienes planes en borrador o activos.</p>
            <Button asChild>
              <Link href="/app/plan/nuevo">Crear un plan</Link>
            </Button>
          </div>
        ) : addedTo ? (
          <div className="flex flex-col gap-4" role="status">
            <p className="text-sm">Listo, la receta ya está en tu plan.</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Seguir aquí
              </Button>
              <Button asChild>
                <Link href={`/app/plan/${addedTo}`}>Ver plan</Link>
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="plan-choice">Plan</Label>
              <Select value={plan?.id} onValueChange={choosePlan}>
                <SelectTrigger id="plan-choice">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {PLAN_STATUS_LABELS[p.status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {plan ? (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="plan-day">Día</Label>
                  <Select value={String(day)} onValueChange={(v) => setDay(Number(v))}>
                    <SelectTrigger id="plan-day">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: plan.days }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {dayLabelFor(plan.startDate, i)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="plan-slot">Comida</Label>
                  <Select value={String(slot)} onValueChange={(v) => setSlot(Number(v))}>
                    <SelectTrigger id="plan-slot">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {slots.map((s) => (
                        <SelectItem key={s.index} value={String(s.index)}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : null}
            <NumberStepper label="Porciones" value={servings} onValueChange={setServings} min={0.25} max={5} step={0.25} unit="porciones" />
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
                Añadir
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
