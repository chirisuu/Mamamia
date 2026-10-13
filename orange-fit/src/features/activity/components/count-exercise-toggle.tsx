"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { setCountExerciseAction } from "../actions";

/**
 * «Sumar ejercicio a mi presupuesto» (profiles.count_exercise_calories). Apagado por defecto: el
 * nivel de actividad de la meta ya incluye el ejercicio habitual y sumarlo otra vez lo contaría dos veces.
 */
export function CountExerciseToggle({ initial }: { initial: boolean }) {
  const [value, setValue] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();
  const id = React.useId();

  function change(next: boolean) {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const res = await setCountExerciseAction(next);
      if (!res.ok) {
        setValue(previous);
        toast.error(res.error.message);
        return;
      }
      toast.success(next ? "Tu ejercicio ahora suma a tu presupuesto del día." : "Tu ejercicio ya no suma a tu presupuesto.");
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Label htmlFor={id} className="text-base font-medium">
            Sumar ejercicio a mi presupuesto
          </Label>
          <p id={`${id}-desc`} className="text-sm text-muted-foreground">
            Si lo activas, las calorías netas de tus sesiones se suman a tu meta del día.
          </p>
        </div>
        <Switch id={id} checked={value} onCheckedChange={change} disabled={pending} aria-describedby={`${id}-desc`} />
      </div>
      <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
        <strong className="font-semibold text-foreground">Ojo con el doble conteo:</strong> tu meta ya se calculó con tu nivel de
        actividad, que incluye el ejercicio que haces normalmente. Si además sumas cada sesión, ese ejercicio se contaría dos
        veces. Actívalo solo si tu nivel de actividad no incluye estos entrenamientos (por ejemplo, elegiste «sedentario»).
      </p>
    </div>
  );
}
