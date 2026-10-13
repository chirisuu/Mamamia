"use client";

import * as React from "react";
import { Activity, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/sonner";
import { formatDuration, formatKcal, formatLongDate } from "@/lib/format";
import { EXERCISE_INTENSITY_LABELS } from "@/lib/nutrition";
import { deleteExerciseAction } from "../actions";
import type { ExerciseLog } from "../server/activity";

const SOURCE_LABELS: Record<ExerciseLog["energySource"], string> = {
  met_estimate: "Estimado",
  manual: "Dato manual",
  device: "Dispositivo",
};

export function ExerciseHistory({ logs }: { logs: ExerciseLog[] }) {
  const [pending, setPending] = React.useState<ExerciseLog | null>(null);
  const [busy, startTransition] = React.useTransition();

  const byDate = React.useMemo(() => {
    const map = new Map<string, ExerciseLog[]>();
    for (const l of logs) map.set(l.localDate, [...(map.get(l.localDate) ?? []), l]);
    return [...map.entries()];
  }, [logs]);

  function confirm() {
    if (!pending) return;
    const target = pending;
    startTransition(async () => {
      const res = await deleteExerciseAction(target.id);
      if (!res.ok) toast.error(res.error.message);
      else toast.success("Actividad borrada.");
      setPending(null);
    });
  }

  if (logs.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="Aún no registras actividad"
        description="Caminar también cuenta. Cuando registres una sesión, la verás aquí."
      />
    );
  }

  return (
    <div className="grid gap-4">
      {byDate.map(([date, list]) => (
        <section key={date} className="grid gap-2" aria-label={formatLongDate(date)}>
          <h3 className="text-sm font-medium text-muted-foreground">{formatLongDate(date)}</h3>
          <ul className="grid gap-2">
            {list.map((l) => (
              <li key={l.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{l.activityName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDuration(l.durationMin)}
                    {l.intensity ? ` · ${EXERCISE_INTENSITY_LABELS[l.intensity]}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium tabular-nums">{formatKcal(Math.round(l.energyKcal))}</p>
                  <Badge variant="secondary">{SOURCE_LABELS[l.energySource]}</Badge>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label={`Borrar ${l.activityName}`} onClick={() => setPending(l)}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Dialog open={pending !== null} onOpenChange={(open) => (!open ? setPending(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Borrar esta actividad?</DialogTitle>
            <DialogDescription>
              {pending ? `${pending.activityName}, ${formatDuration(pending.durationMin)}.` : ""} Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirm} loading={busy}>
              Borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
