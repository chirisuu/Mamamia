"use client";

import * as React from "react";
import Link from "next/link";
import { CupSoda, Droplet, GlassWater, Plus, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Progress } from "@/components/ui/progress";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import { formatMl } from "@/lib/format";
import { WATER_PRESETS_ML, waterProgress } from "@/lib/nutrition";
import { cn } from "@/lib/utils";
import { timeOfDay } from "@/features/notifications/lib/time";
import { addWaterAction, deleteWaterLogAction, undoLastWaterAction } from "../actions";
import { CUSTOM_WATER_LIMITS } from "../lib/water-stats";
import type { WaterLog } from "../server/water";

type Props = {
  consumedMl: number;
  targetMl: number | null;
  logs: WaterLog[];
  timeZone: string;
};

const PRESET_ICONS = [GlassWater, CupSoda, Droplet] as const;
/** Vaso, botella chica y botella mediana del motor (250 / 500 / 750 ml). */
const QUICK = WATER_PRESETS_ML.slice(0, 3);

export function WaterToday({ consumedMl, targetMl, logs, timeZone }: Props) {
  const [pending, startTransition] = React.useTransition();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [customOpen, setCustomOpen] = React.useState(false);
  const [customMl, setCustomMl] = React.useState(300);
  const progress = targetMl ? waterProgress(consumedMl, targetMl) : null;

  function add(amountMl: number, onDone?: () => void) {
    startTransition(async () => {
      const res = await addWaterAction({ amountMl });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      onDone?.();
      const id = res.data.id;
      toast.success(`Sumaste ${formatMl(amountMl)}`, {
        action: {
          label: "Deshacer",
          onClick: () => {
            void deleteWaterLogAction(id).then((r) => {
              if (r.ok) toast.success("Listo, lo quitamos.");
              else toast.error(r.error.message);
            });
          },
        },
      });
    });
  }

  function undo() {
    startTransition(async () => {
      const res = await undoLastWaterAction();
      if (!res.ok) toast.error(res.error.message);
      else if (!res.data) toast.info("Hoy aún no hay registros para deshacer.");
      else toast.success(`Quitamos ${formatMl(res.data.amountMl)}.`);
    });
  }

  async function remove(id: string) {
    setBusyId(id);
    const res = await deleteWaterLogAction(id);
    setBusyId(null);
    if (!res.ok) toast.error(res.error.message);
  }

  return (
    <div className="grid gap-4">
      <section aria-labelledby="agua-hoy" className="grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 id="agua-hoy" className="sr-only">
          Agua de hoy
        </h2>
        <div className="flex items-end justify-between gap-3" data-numeric="">
          <p>
            <span className="block text-4xl font-semibold tracking-tight">{formatMl(consumedMl)}</span>
            <span className="text-sm text-muted-foreground">{targetMl ? `de ${formatMl(targetMl)} hoy` : "tomados hoy"}</span>
          </p>
          {progress ? (
            <p className="text-right text-sm font-medium" aria-live="polite">
              {progress.reached ? "¡Llegaste a tu meta!" : `Te faltan ${formatMl(progress.remainingMl)}`}
            </p>
          ) : null}
        </div>
        {progress ? (
          <Progress
            value={Math.round(progress.progress * 100)}
            aria-label="Avance de tu meta de agua"
            aria-valuetext={`${formatMl(consumedMl)} de ${formatMl(targetMl)}`}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Aún no tienes una meta de agua.{" "}
            <Link href="/app/perfil/metas" className="font-medium text-primary-strong underline-offset-4 hover:underline">
              Revisa tus metas
            </Link>
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK.map((preset, i) => {
            const Icon = PRESET_ICONS[i] ?? GlassWater;
            return (
              <Button
                key={preset.ml}
                variant="outline"
                className="h-auto min-h-20 flex-col gap-1 py-3"
                onClick={() => add(preset.ml)}
                disabled={pending}
                aria-label={`Sumar ${preset.label.toLowerCase()}, ${preset.ml} ml`}
              >
                <Icon className="size-6 text-primary-strong" aria-hidden="true" />
                <span className="text-sm font-semibold">{preset.ml} ml</span>
                <span className="text-xs font-normal text-muted-foreground">{preset.label}</span>
              </Button>
            );
          })}
          <Button
            variant="outline"
            className="h-auto min-h-20 flex-col gap-1 py-3"
            onClick={() => setCustomOpen(true)}
            disabled={pending}
          >
            <Plus className="size-6 text-primary-strong" aria-hidden="true" />
            <span className="text-sm font-semibold">Otra cantidad</span>
            <span className="text-xs font-normal text-muted-foreground">Personalizado</span>
          </Button>
        </div>

        <Button variant="ghost" size="sm" onClick={undo} disabled={pending || logs.length === 0} className="justify-self-start">
          <Undo2 aria-hidden="true" />
          Deshacer el último
        </Button>
      </section>

      <section aria-labelledby="agua-registros" className="grid gap-2">
        <h2 id="agua-registros" className="text-base font-semibold">
          Registros de hoy
        </h2>
        {logs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Todavía no registras agua hoy. Toca un vaso o una botella para empezar.
          </p>
        ) : (
          <ul className="grid gap-1 rounded-2xl border border-border bg-card p-2 shadow-sm">
            {logs.map((log) => (
              <li key={log.id} className="flex min-h-12 items-center gap-3 rounded-xl px-3">
                <Droplet className="size-5 shrink-0 text-primary-strong" aria-hidden="true" />
                <span className="flex-1 font-medium" data-numeric="">
                  {formatMl(log.amountMl)}
                </span>
                <span className="text-sm text-muted-foreground">{timeOfDay(log.loggedAt, timeZone)}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void remove(log.id)}
                  loading={busyId === log.id}
                  aria-label={`Borrar ${formatMl(log.amountMl)} de las ${timeOfDay(log.loggedAt, timeZone)}`}
                  className={cn("rounded-full text-muted-foreground")}
                >
                  {busyId === log.id ? null : <Trash2 aria-hidden="true" />}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <BottomSheet open={customOpen} onOpenChange={setCustomOpen}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle>Otra cantidad</BottomSheetTitle>
            <BottomSheetDescription>
              Entre {CUSTOM_WATER_LIMITS.min} y {CUSTOM_WATER_LIMITS.max} ml.
            </BottomSheetDescription>
          </BottomSheetHeader>
          <div className="px-5 py-2">
            <NumberStepper
              label="Mililitros"
              value={customMl}
              onValueChange={setCustomMl}
              min={CUSTOM_WATER_LIMITS.min}
              max={CUSTOM_WATER_LIMITS.max}
              step={CUSTOM_WATER_LIMITS.step}
              unit="ml"
              size="lg"
            />
          </div>
          <BottomSheetFooter>
            <Button size="lg" onClick={() => add(customMl, () => setCustomOpen(false))} loading={pending}>
              Sumar {formatMl(customMl)}
            </Button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}
