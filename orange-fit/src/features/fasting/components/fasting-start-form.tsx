"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Info, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { FASTING_HOURS_LIMITS, FASTING_PROTOCOLS } from "@/lib/nutrition";
import { cn } from "@/lib/utils";
import { startFastingAction } from "../actions";
import { CUSTOM_HOURS_STEP, formatHours, resolveTargetHours, STARTED_AGO_OPTIONS, type ProtocolCode } from "../lib/fasting-view";

const AGO_LABELS: Record<(typeof STARTED_AGO_OPTIONS)[number], string> = {
  0: "Ahora",
  30: "Hace 30 min",
  60: "Hace 1 h",
  120: "Hace 2 h",
  180: "Hace 3 h",
  240: "Hace 4 h",
};

/** Elegir protocolo e iniciar. Solo se muestra si el cribado lo permite (el servidor lo vuelve a revisar). */
export function FastingStartForm({ cautions }: { cautions: string[] }) {
  const router = useRouter();
  const [protocol, setProtocol] = React.useState<ProtocolCode>("12:12");
  const [customHours, setCustomHours] = React.useState<number>(13);
  const [ago, setAgo] = React.useState<(typeof STARTED_AGO_OPTIONS)[number]>(0);
  const [pending, startTransition] = React.useTransition();
  const id = React.useId();

  const target = resolveTargetHours(protocol, protocol === "custom" ? customHours : null);

  function start() {
    startTransition(async () => {
      const res = await startFastingAction({
        protocol,
        customHours: protocol === "custom" ? customHours : null,
        startedMinutesAgo: ago,
        note: null,
      });
      if (!res.ok) {
        toast.error(res.error.fieldErrors?.customHours?.[0] ?? res.error.message);
        return;
      }
      toast.success("Tu ayuno empezó. Puedes cerrar la app: el tiempo sigue contando.");
      router.refresh();
    });
  }

  const options: { code: ProtocolCode; title: string; description: string }[] = [
    ...FASTING_PROTOCOLS.map((p) => ({ code: p.code, title: p.label, description: p.description })),
    { code: "custom", title: "Personalizado", description: `Elige entre ${FASTING_HOURS_LIMITS.min} y ${FASTING_HOURS_LIMITS.max} horas.` },
  ];

  return (
    <div className="grid gap-5">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Protocolo</legend>
        <RadioGroup value={protocol} onValueChange={(v) => setProtocol(v as ProtocolCode)} className="grid gap-2">
          {options.map((o) => (
            <Label
              key={o.code}
              htmlFor={`${id}-${o.code}`}
              className={cn(
                "flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-4 font-normal transition-colors",
                protocol === o.code ? "border-primary bg-accent" : "border-border hover:bg-muted/50",
              )}
            >
              <RadioGroupItem id={`${id}-${o.code}`} value={o.code} className="mt-0.5" />
              <span className="grid gap-0.5">
                <span className="font-medium">{o.title}</span>
                <span className="text-sm text-muted-foreground">{o.description}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </fieldset>

      {protocol === "custom" ? (
        <NumberStepper
          label="Horas de ayuno"
          value={customHours}
          onValueChange={setCustomHours}
          min={FASTING_HOURS_LIMITS.min}
          max={FASTING_HOURS_LIMITS.max}
          step={CUSTOM_HOURS_STEP}
          decimals={1}
          unit="h"
        />
      ) : null}

      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-ago`}>¿Cuándo dejaste de comer?</Label>
        <Select value={String(ago)} onValueChange={(v) => setAgo(Number(v) as (typeof STARTED_AGO_OPTIONS)[number])}>
          <SelectTrigger id={`${id}-ago`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STARTED_AGO_OPTIONS.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {AGO_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {cautions.length > 0 ? (
        <ul className="grid gap-2 rounded-xl bg-muted/50 p-4 text-sm">
          {cautions.map((c) => (
            <li key={c} className="flex gap-2">
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {c}
            </li>
          ))}
        </ul>
      ) : null}

      <Button size="lg" onClick={start} loading={pending} disabled={target == null}>
        <Play aria-hidden="true" />
        {target != null ? `Iniciar ayuno de ${formatHours(target)}` : "Elige una duración válida"}
      </Button>
    </div>
  );
}
