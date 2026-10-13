"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { BellRing, CheckCircle2, Square, X } from "lucide-react";
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
import { toast } from "@/components/ui/sonner";
import { fastingStatus } from "@/lib/nutrition";
import { showLocalNotification } from "@/features/notifications/lib/browser-push";
import { timeOfDay } from "@/features/notifications/lib/time";
import { cancelFastingAction, endFastingAction } from "../actions";
import { formatClock, formatHours, protocolLabel } from "../lib/fasting-view";
import type { FastingSession } from "../server/fasting";

type Props = {
  session: FastingSession;
  /** Instante del servidor al renderizar (evita diferencias de hidratación). */
  nowIso: string;
  timeZone: string;
};

const NOTIFIED_KEY = (id: string) => `of:fasting-notified:${id}`;

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Sin almacenamiento (modo privado): a lo sumo se repite el aviso.
  }
}

/**
 * Temporizador del ayuno en curso. El estado vive en la base (started_at); aquí solo corre el reloj.
 * Al completar la meta, si la persona dio permiso, muestra un aviso local (con la app abierta).
 */
export function FastingTimer({ session, nowIso, timeZone }: Props) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [now, setNow] = React.useState(() => Date.parse(nowIso));
  const [confirm, setConfirm] = React.useState<"end" | "cancel" | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [permission, setPermission] = React.useState<NotificationPermission | "unsupported" | "unknown">("unknown");

  React.useEffect(() => {
    const tick = () => setNow(Date.now());
    // Primer ajuste al reloj del dispositivo apenas monta (sin bloquear el render).
    const first = window.setTimeout(() => {
      tick();
      setPermission("Notification" in window ? Notification.permission : "unsupported");
    }, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);

  const status = fastingStatus({ startedAt: session.startedAt, targetHours: session.targetHours, now: new Date(now) });

  // Aviso local una sola vez por ayuno, cuando se cumple la meta con la app abierta.
  React.useEffect(() => {
    if (!status.completed) return;
    const key = NOTIFIED_KEY(session.id);
    if (readFlag(key)) return;
    writeFlag(key);
    void showLocalNotification("Completaste tu ayuno", {
      body: `Llegaste a tus ${formatHours(session.targetHours)}. Termínalo cuando quieras y come con calma.`,
      url: "/app/ayuno",
      tag: `fasting-${session.id}`,
    });
  }, [status.completed, session.id, session.targetHours]);

  async function askPermission() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") toast.success("Te avisaremos en este dispositivo mientras la app esté abierta.");
    else toast.info("Sin permiso no podemos avisarte en este dispositivo.");
  }

  function run(kind: "end" | "cancel") {
    startTransition(async () => {
      if (kind === "end") {
        const res = await endFastingAction(session.id);
        if (!res.ok) {
          toast.error(res.error.message);
          return;
        }
        toast.success(
          res.data.reached
            ? `¡Bien! Ayunaste ${formatHours(res.data.hours)}.`
            : `Ayuno terminado: ${formatHours(res.data.hours)}. Escuchar a tu cuerpo también es avanzar.`,
        );
      } else {
        const res = await cancelFastingAction(session.id);
        if (!res.ok) {
          toast.error(res.error.message);
          return;
        }
        toast.success("Ayuno cancelado. No se cuenta en tus estadísticas.");
      }
      setConfirm(null);
      router.refresh();
    });
  }

  const size = 232;
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <section aria-labelledby="ayuno-en-curso" className="grid gap-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 id="ayuno-en-curso" className="text-base font-semibold">
          Ayuno en curso
        </h2>
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium">{protocolLabel(session.protocol, session.targetHours)}</span>
      </div>

      <div className="relative mx-auto" style={{ width: size, height: size }} role="group" aria-label="Avance del ayuno">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-muted" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            className="stroke-primary"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - status.progress)}
            style={reduceMotion ? undefined : { transition: "stroke-dashoffset 250ms cubic-bezier(0.22, 1, 0.36, 1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center" data-numeric="">
          <span className="text-xs text-muted-foreground">{status.completed ? "¡Meta cumplida!" : "Transcurrido"}</span>
          <span className="text-4xl font-semibold tracking-tight tabular-nums" aria-live="off">
            {formatClock(status.elapsedMs)}
          </span>
          <span className="mt-1 text-sm text-muted-foreground tabular-nums">
            {status.completed ? `+${formatClock(status.overtimeMs)} extra` : `Faltan ${formatClock(status.remainingMs)}`}
          </span>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {status.completed ? "Completaste tu meta de ayuno." : `Llevas ${formatHours(status.elapsedHours)} de ${formatHours(session.targetHours)}.`}
      </p>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-muted/50 p-3">
          <dt className="text-muted-foreground">Empezó</dt>
          <dd className="font-medium tabular-nums">{timeOfDay(session.startedAt, timeZone)}</dd>
        </div>
        <div className="rounded-xl bg-muted/50 p-3">
          <dt className="text-muted-foreground">Meta a las</dt>
          <dd className="font-medium tabular-nums">{timeOfDay(status.endsAt, timeZone)}</dd>
        </div>
      </dl>

      {status.completed ? (
        <p className="flex items-start gap-2 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
          Llegaste a tu meta. No hace falta alargarlo: termínalo y come algo equilibrado, con calma.
        </p>
      ) : null}

      {permission === "default" ? (
        <Button variant="ghost" size="sm" onClick={() => void askPermission()} className="justify-self-start">
          <BellRing aria-hidden="true" />
          Avisarme en este dispositivo al completar
        </Button>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={() => setConfirm("cancel")} disabled={pending}>
          <X aria-hidden="true" />
          Cancelar
        </Button>
        <Button onClick={() => setConfirm("end")} disabled={pending}>
          <Square aria-hidden="true" />
          Terminar ayuno
        </Button>
      </div>

      <Dialog open={confirm !== null} onOpenChange={(open) => (!open ? setConfirm(null) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm === "cancel" ? "¿Cancelar este ayuno?" : "¿Terminar tu ayuno ahora?"}</DialogTitle>
            <DialogDescription>
              {confirm === "cancel"
                ? "Úsalo si lo iniciaste por error: se guarda como cancelado y no cuenta en tus estadísticas."
                : status.completed
                  ? `Ayunaste ${formatHours(status.elapsedHours)}. Queda en tu historial.`
                  : `Llevas ${formatHours(status.elapsedHours)} de ${formatHours(session.targetHours)}. Si no te sientes bien, terminarlo es lo correcto. Queda en tu historial con su duración real.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Volver</Button>
            </DialogClose>
            <Button variant={confirm === "cancel" ? "destructive" : "default"} onClick={() => confirm && run(confirm)} loading={pending}>
              {confirm === "cancel" ? "Sí, cancelar" : "Sí, terminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
