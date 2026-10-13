"use client";

import * as React from "react";
import Link from "next/link";
import { Calculator, Check, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { addDays } from "@/lib/dates";
import { formatKcal, formatNumber } from "@/lib/format";
import {
  EXERCISE_CATALOG_SOURCE,
  EXERCISE_CATEGORY_LABELS,
  EXERCISE_INTENSITY_LABELS,
  estimateExercise,
  findActivity,
  intensityFromMet,
  searchActivities,
  type ExerciseCategory,
  type ExerciseIntensity,
} from "@/lib/nutrition";
import { cn } from "@/lib/utils";
import { logExerciseAction } from "../actions";
import { MANUAL_KCAL_MAX } from "../schemas";

type Props = {
  today: string;
  backfillDays: number;
  /** Peso con el que el servidor estimará (solo para la vista previa). */
  weight: { weightKg: number; source: "log" | "goal" } | null;
  /** Con antecedente de TCA no mostramos el número de peso. */
  hideWeight: boolean;
};

type Mode = "catalog" | "manual";
type IntensityFilter = "all" | ExerciseIntensity;

const CATEGORIES = Object.keys(EXERCISE_CATEGORY_LABELS) as ExerciseCategory[];
const INTENSITIES: ExerciseIntensity[] = ["light", "moderate", "vigorous"];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

export function ExerciseForm({ today, backfillDays, weight, hideWeight }: Props) {
  const [mode, setMode] = React.useState<Mode>("catalog");
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<ExerciseCategory | "all">("all");
  const [intensityFilter, setIntensityFilter] = React.useState<IntensityFilter>("all");
  const [code, setCode] = React.useState<string | null>(null);
  const [duration, setDuration] = React.useState(30);
  const [date, setDate] = React.useState(today);
  const [note, setNote] = React.useState("");
  const [manualName, setManualName] = React.useState("");
  const [manualIntensity, setManualIntensity] = React.useState<ExerciseIntensity>("moderate");
  const [manualKcal, setManualKcal] = React.useState<number>(150);
  const [pending, startTransition] = React.useTransition();
  const id = React.useId();

  const results = React.useMemo(
    () =>
      searchActivities(query, category === "all" ? {} : { category }).filter(
        (a) => intensityFilter === "all" || intensityFromMet(a.met) === intensityFilter,
      ),
    [query, category, intensityFilter],
  );
  const selected = code ? findActivity(code) : null;
  let estimate: ReturnType<typeof estimateExercise> | null = null;
  if (mode === "catalog" && selected && weight) {
    try {
      estimate = estimateExercise({ code: selected.code, weightKg: weight.weightKg, durationMin: duration });
    } catch {
      estimate = null;
    }
  }

  function reset() {
    setCode(null);
    setNote("");
    setManualName("");
  }

  function submit() {
    startTransition(async () => {
      const common = { localDate: date, durationMin: duration, note: note.trim() || null };
      const res =
        mode === "catalog"
          ? await logExerciseAction({ mode: "catalog", code: code ?? "", ...common })
          : await logExerciseAction({ mode: "manual", name: manualName, intensity: manualIntensity, energyKcal: manualKcal, ...common });
      if (!res.ok) {
        const first = Object.values(res.error.fieldErrors ?? {})[0]?.[0];
        toast.error(first ?? res.error.message);
        return;
      }
      toast.success(`Guardamos ${res.data.activityName}: ${formatKcal(res.data.energyKcal)}.`);
      reset();
    });
  }

  const canSubmit = mode === "catalog" ? Boolean(selected && weight) : manualName.trim().length >= 2;

  return (
    <div className="grid gap-5">
      <SegmentedControl
        aria-label="Cómo registrar"
        value={mode}
        onValueChange={setMode}
        options={[
          { value: "catalog", label: "Buscar actividad" },
          { value: "manual", label: "De mi reloj o app" },
        ]}
      />

      {mode === "catalog" ? (
        <div className="grid gap-3">
          <div className="relative">
            <Label htmlFor={`${id}-q`} className="sr-only">
              Buscar actividad
            </Label>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id={`${id}-q`}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Caminar, correr, fútbol…"
              className="pl-10"
              autoComplete="off"
            />
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none" role="group" aria-label="Categoría">
            <Chip active={category === "all"} onClick={() => setCategory("all")}>
              Todas
            </Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                {EXERCISE_CATEGORY_LABELS[c]}
              </Chip>
            ))}
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none" role="group" aria-label="Intensidad">
            <Chip active={intensityFilter === "all"} onClick={() => setIntensityFilter("all")}>
              Cualquier intensidad
            </Chip>
            {INTENSITIES.map((i) => (
              <Chip key={i} active={intensityFilter === i} onClick={() => setIntensityFilter(i)}>
                {EXERCISE_INTENSITY_LABELS[i]}
              </Chip>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            La intensidad depende de la actividad: si fue más suave o más fuerte, elige esa variante (por ejemplo, caminar lento o
            rápido).
          </p>
          {results.length === 0 ? (
            <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
              No encontramos esa actividad. Prueba con otra palabra o regístrala con las calorías de tu reloj o app.
            </p>
          ) : (
            <ul className="grid max-h-80 gap-1 overflow-y-auto rounded-xl border border-border p-1" aria-label="Actividades">
              {results.map((a) => {
                const active = a.code === code;
                const intensity = intensityFromMet(a.met);
                return (
                  <li key={a.code}>
                    <button
                      type="button"
                      onClick={() => setCode(a.code)}
                      aria-pressed={active}
                      className={cn(
                        "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active ? "bg-accent" : "hover:bg-muted/60",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{a.nameEs}</span>
                        <span className="text-xs text-muted-foreground">
                          {EXERCISE_CATEGORY_LABELS[a.category]} · {formatNumber(a.met, 1)} MET
                        </span>
                      </span>
                      <Badge variant={intensity === "vigorous" ? "soft" : "secondary"}>{EXERCISE_INTENSITY_LABELS[intensity]}</Badge>
                      {active ? <Check className="size-5 text-primary-strong" aria-hidden="true" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-name`}>Actividad</Label>
            <Input
              id={`${id}-name`}
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              maxLength={120}
              placeholder="Clase de spinning, crossfit…"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-int`}>Intensidad</Label>
            <Select value={manualIntensity} onValueChange={(v) => setManualIntensity(v as ExerciseIntensity)}>
              <SelectTrigger id={`${id}-int`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTENSITIES.map((i) => (
                  <SelectItem key={i} value={i}>
                    {EXERCISE_INTENSITY_LABELS[i]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <NumberStepper
            label="Calorías activas que marcó tu reloj o app"
            value={manualKcal}
            onValueChange={setManualKcal}
            min={0}
            max={MANUAL_KCAL_MAX}
            step={10}
            unit="kcal"
          />
          <p className="text-xs text-muted-foreground">
            Las guardamos tal cual, marcadas como «dato manual». Usa las calorías activas (no las totales del día) para no contar
            tu gasto en reposo.
          </p>
        </div>
      )}

      <NumberStepper label="Duración" value={duration} onValueChange={setDuration} min={1} max={600} step={5} decimals={0} unit="min" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-date`}>Fecha</Label>
          <Input id={`${id}-date`} type="date" value={date} max={today} min={addDays(today, -backfillDays)} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-note`}>Nota (opcional)</Label>
          <Input id={`${id}-note`} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Con mi grupo del parque…" />
        </div>
      </div>

      {mode === "catalog" ? (
        weight ? (
          estimate ? (
            <div className="grid gap-2 rounded-xl bg-muted/50 p-4 text-sm" aria-live="polite">
              <p className="flex items-center gap-2 text-base font-semibold" data-numeric="">
                <Calculator className="size-5 text-primary-strong" aria-hidden="true" />≈ {formatKcal(Math.round(estimate.netKcal))} netas
              </p>
              <p className="text-muted-foreground">
                {hideWeight
                  ? `Se calcula con el MET de la actividad (${formatNumber(estimate.met, 1)}), tu último peso registrado y la duración.`
                  : `Cálculo: ${estimate.netFormula} = ${formatNumber(estimate.netKcal, 1)} kcal (brutas: ${formatNumber(estimate.grossKcal, 1)} kcal).`}
                {!hideWeight && weight.source === "goal" ? " Usamos el peso de tu objetivo porque aún no registras tu peso." : ""}
              </p>
              <p className="text-muted-foreground">{estimate.explanation}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Elige una actividad para ver las calorías estimadas.</p>
          )
        ) : (
          <p className="rounded-xl bg-muted/50 p-4 text-sm">
            Para estimar las calorías necesitamos tu peso.{" "}
            <Link href="/app/progreso" className="font-medium text-primary-strong underline-offset-4 hover:underline">
              Registra tu peso
            </Link>{" "}
            o usa la opción «De mi reloj o app».
          </p>
        )
      ) : null}

      <Button size="lg" onClick={submit} loading={pending} disabled={!canSubmit}>
        Guardar actividad
      </Button>
      {mode === "catalog" && !EXERCISE_CATALOG_SOURCE.verified ? (
        <p className="text-xs text-muted-foreground">
          Valores MET de referencia del Compendium of Physical Activities, pendientes de cotejo con la tabla oficial. Son
          estimaciones.
        </p>
      ) : null}
    </div>
  );
}
