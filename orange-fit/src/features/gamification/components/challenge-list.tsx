"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Flag, LogOut, Trophy } from "lucide-react";
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
import { localDateInTz } from "@/lib/dates";
import { formatMl, formatNumber, formatShortDate } from "@/lib/format";
import type { ChallengeKind } from "@/lib/nutrition";
import { abandonChallengeAction, joinChallengeAction } from "../actions";
import { VEGETABLE_SERVING_G } from "../lib/vegetables";
import type { ChallengeView } from "../server/sync";

/** Qué cuenta como «día logrado» en cada tipo de reto. */
export function dailyGoalText(kind: ChallengeKind, target: number): string {
  switch (kind) {
    case "water":
      return `Día logrado: ${formatMl(target)} de agua o más.`;
    case "logging":
      return target <= 1 ? "Día logrado: al menos un alimento registrado." : `Día logrado: ${formatNumber(target)} alimentos registrados.`;
    case "protein":
      return `Día logrado: ${formatNumber(target)} % de tu meta de proteína.`;
    case "vegetables":
      return `Día logrado: ${formatNumber(target, 1)} porciones de verdura (${formatNumber(target * VEGETABLE_SERVING_G)} g).`;
    case "activity":
      return `Día logrado: ${formatNumber(target)} minutos de actividad.`;
  }
}

const KIND_NOTES: Partial<Record<ChallengeKind, string>> = {
  vegetables: "Reconocemos las verduras por el nombre del alimento registrado: es una aproximación.",
  protein: "Necesitas tener una meta de proteína definida.",
  water: "Si tienes una meta de agua, se usa esa.",
};

function ChallengeCard({ c, today, timeZone }: { c: ChallengeView; today: string; timeZone: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [confirm, setConfirm] = React.useState(false);
  const active = c.active;
  const pct = active ? Math.round(active.progress.progress * 100) : 0;

  function join() {
    startTransition(async () => {
      const res = await joinChallengeAction(c.id);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`¡Te uniste a «${c.title}»! Cada día que lo logres suma.`);
      router.refresh();
    });
  }

  function leave() {
    if (!active) return;
    startTransition(async () => {
      const res = await abandonChallengeAction(active.userChallengeId);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Dejaste el reto. Puedes volver cuando quieras.");
      setConfirm(false);
      router.refresh();
    });
  }

  return (
    <li className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="font-semibold">{c.title}</p>
          {c.description ? <p className="text-sm text-muted-foreground">{c.description}</p> : null}
        </div>
        {c.timesCompleted > 0 ? (
          <Badge variant="success" className="shrink-0">
            <Trophy aria-hidden="true" />
            {c.timesCompleted === 1 ? "Completado" : `${c.timesCompleted} veces`}
          </Badge>
        ) : null}
      </div>
      <p className="text-sm">
        {dailyGoalText(c.kind, c.dailyTarget)} Meta: {c.durationDays} {c.durationDays === 1 ? "día" : "días"}, no tienen que ser seguidos.
      </p>
      {KIND_NOTES[c.kind] ? <p className="text-xs text-muted-foreground">{KIND_NOTES[c.kind]}</p> : null}

      {active ? (
        <div className="grid gap-2">
          <div
            role="progressbar"
            aria-label={`Avance de ${c.title}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-valuetext={`${active.progress.qualifyingDays} de ${active.progress.requiredDays} días`}
            className="h-2.5 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-sm font-medium tabular-nums">
            {active.progress.qualifyingDays} de {active.progress.requiredDays} días · desde el {formatShortDate(active.startedOn)}
          </p>
          <p className="text-sm text-muted-foreground">{active.progress.message}</p>
          <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setConfirm(true)} disabled={pending}>
            <LogOut aria-hidden="true" />
            Dejar reto
          </Button>
        </div>
      ) : (
        <Button variant={c.timesCompleted > 0 ? "outline" : "default"} onClick={join} loading={pending} className="justify-self-start">
          <Flag aria-hidden="true" />
          {c.timesCompleted > 0 ? "Hacerlo otra vez" : "Unirme al reto"}
        </Button>
      )}
      {!active && c.lastCompletedAt ? (
        <p className="text-xs text-muted-foreground">Lo completaste por última vez el {formatShortDate(localDateInTz(new Date(c.lastCompletedAt), timeZone))}.</p>
      ) : null}

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Dejar «{c.title}»?</DialogTitle>
            <DialogDescription>
              No pasa nada: los retos son voluntarios. Si vuelves a unirte, empezarás a sumar desde ese día (hoy es{" "}
              {formatShortDate(today)}).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Seguir en el reto</Button>
            </DialogClose>
            <Button variant="secondary" onClick={leave} loading={pending}>
              Dejar reto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}

export function ChallengeList({ challenges, today, timeZone }: { challenges: ChallengeView[]; today: string; timeZone: string }) {
  if (challenges.length === 0) {
    return <EmptyState icon={Flag} title="No hay retos disponibles por ahora" description="Cuando publiquemos nuevos retos, aparecerán aquí." />;
  }
  const sorted = [...challenges].sort((a, b) => Number(Boolean(b.active)) - Number(Boolean(a.active)));
  return (
    <ul className="grid gap-3">
      {sorted.map((c) => (
        <ChallengeCard key={c.id} c={c} today={today} timeZone={timeZone} />
      ))}
    </ul>
  );
}
