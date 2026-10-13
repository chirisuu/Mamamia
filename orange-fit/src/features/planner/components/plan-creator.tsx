"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarRange, PencilRuler, ShieldAlert, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { formatMoney, formatNumber, formatShortDate } from "@/lib/format";
import { NutritionInputError } from "@/lib/nutrition";
import { ToggleChip } from "@/features/recipes/components/toggle-chip";
import { allergenLabel, dietTagLabel } from "@/features/recipes/lib/labels";
import { emptyDraft, generateDraft, MAX_PLAN_DAYS, newSeed } from "../lib/plan";
import type { PlanDraft, PlanParams, PlanRecipeOption } from "../lib/types";
import { PlanEditor } from "./plan-editor";

const TIME_OPTIONS = [20, 30, 45, 60] as const;

/**
 * Crear un plan: generarlo con el motor (determinista, sin IA; la semilla queda guardada) o
 * armarlo a mano. El resultado se revisa y edita antes de guardar.
 */
export function PlanCreator({
  defaults,
  pool,
  today,
  tomorrow,
  autoPlansBlocked,
  riskMessages,
  targetNotes,
  budgetNote,
  canExport,
  canShop,
}: {
  defaults: PlanParams;
  pool: PlanRecipeOption[];
  today: string;
  tomorrow: string;
  autoPlansBlocked: boolean;
  riskMessages: string[];
  targetNotes: string[];
  budgetNote: string | null;
  canExport: boolean;
  canShop: boolean;
}) {
  const [name, setName] = React.useState(`Plan del ${formatShortDate(today)}`);
  const [startDate, setStartDate] = React.useState(today);
  const [days, setDays] = React.useState(7);
  const [mealsPerDay, setMealsPerDay] = React.useState(String(defaults.mealsPerDay) as "3" | "4" | "5");
  const [maxMinutes, setMaxMinutes] = React.useState<number | null>(null);
  const [useBudget, setUseBudget] = React.useState(defaults.weeklyBudget != null);
  const [draft, setDraft] = React.useState<PlanDraft | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const hasTargets = defaults.targetKcal != null;
  const canGenerate = hasTargets && !autoPlansBlocked && pool.length > 0;
  const params = (): PlanParams => ({
    ...defaults,
    mealsPerDay: Number(mealsPerDay),
    maxPrepMinutes: maxMinutes,
    weeklyBudget: useBudget ? defaults.weeklyBudget : null,
  });
  const validName = name.trim() || "Mi plan";

  if (draft) {
    return (
      <div className="flex flex-col gap-4">
        <Button type="button" variant="link" className="self-start" onClick={() => setDraft(null)}>
          ← Cambiar las opciones
        </Button>
        <PlanEditor
          initialDraft={draft}
          pool={pool}
          planId={null}
          shareToken={null}
          today={today}
          tomorrow={tomorrow}
          canRegenerate={canGenerate}
          canExport={canExport}
          canShop={canShop}
          floorNote={targetNotes[0] ?? null}
        />
      </div>
    );
  }

  const generate = () => {
    setError(null);
    try {
      const d = generateDraft({ pool, params: params(), days, name: validName, startDate, seed: newSeed() });
      setDraft(d);
    } catch (e) {
      const message = e instanceof NutritionInputError ? e.message : "No pudimos generar el plan con estos datos.";
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      {autoPlansBlocked ? (
        <Alert variant="warning">
          <ShieldAlert aria-hidden="true" />
          <AlertTitle>Planes automáticos con revisión profesional</AlertTitle>
          <AlertDescription>
            {riskMessages.map((m, i) => (
              <p key={i}>{m}</p>
            ))}
            <p>Puedes armar tu plan a mano con las recetas y compartirlo con tu profesional de salud.</p>
          </AlertDescription>
        </Alert>
      ) : null}
      {!hasTargets ? (
        <Alert variant="info">
          <AlertTitle>Primero define tu meta</AlertTitle>
          <AlertDescription>
            <p>Para generar un plan necesitamos tu meta de calorías y proteína. Mientras tanto puedes armarlo a mano.</p>
            <Button asChild variant="outline" size="sm" className="mt-1">
              <Link href="/app/perfil/metas">Definir mi meta</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm" aria-labelledby="objetivo">
        <h2 id="objetivo" className="text-base font-semibold">
          Lo que usaremos de tu objetivo
        </h2>
        <ul className="flex flex-col gap-1.5 text-sm">
          <li>
            Meta diaria:{" "}
            {hasTargets ? (
              <span className="font-semibold tabular-nums">
                {formatNumber(defaults.targetKcal)} kcal y {formatNumber(defaults.proteinG)} g de proteína
              </span>
            ) : (
              "pendiente de definir"
            )}
          </li>
          <li>Evitar: {defaults.avoidAllergens.length ? defaults.avoidAllergens.map(allergenLabel).join(", ") : "ningún alérgeno marcado"}</li>
          <li>Dieta: {defaults.dietPattern ? dietTagLabel(defaults.dietPattern) : "sin restricción"}</li>
        </ul>
        {targetNotes.map((n, i) => (
          <p key={i} className="text-sm text-muted-foreground">
            {n}
          </p>
        ))}
        <Link href="/app/perfil/metas" className="text-sm font-medium text-primary-strong underline-offset-4 hover:underline">
          Cambiar mi objetivo
        </Link>
      </section>

      <section className="flex flex-col gap-5" aria-labelledby="opciones">
        <h2 id="opciones" className="text-lg font-semibold tracking-tight">
          Opciones del plan
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-plan-name">Nombre</Label>
            <Input id="new-plan-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-plan-start">Empieza el</Label>
            <Input id="new-plan-start" type="date" value={startDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} />
          </div>
        </div>
        <NumberStepper label="Días" value={days} onValueChange={setDays} min={1} max={MAX_PLAN_DAYS} step={1} unit={days === 1 ? "día" : "días"} />
        <div className="flex flex-col gap-2">
          <span id="meals-label" className="text-sm font-medium">
            Comidas por día
          </span>
          <SegmentedControl
            aria-labelledby="meals-label"
            value={mealsPerDay}
            onValueChange={setMealsPerDay}
            options={[
              { value: "3", label: "3" },
              { value: "4", label: "4" },
              { value: "5", label: "5" },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            {mealsPerDay === "3"
              ? "Desayuno, almuerzo y cena."
              : mealsPerDay === "4"
                ? "Desayuno, almuerzo, media tarde y cena."
                : "Desayuno, media mañana, almuerzo, media tarde y cena."}
          </p>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Tiempo máximo por receta</legend>
          <div className="flex flex-wrap gap-2">
            <ToggleChip pressed={maxMinutes == null} onPressedChange={() => setMaxMinutes(null)}>
              Sin límite
            </ToggleChip>
            {TIME_OPTIONS.map((m) => (
              <ToggleChip key={m} pressed={maxMinutes === m} onPressedChange={(on) => setMaxMinutes(on ? m : null)}>
                {m} min
              </ToggleChip>
            ))}
          </div>
        </fieldset>
        {defaults.weeklyBudget != null ? (
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="use-budget" className="flex-col items-start gap-0.5">
              <span>Cuidar mi presupuesto</span>
              <span className="text-xs font-normal text-muted-foreground">
                {formatMoney(defaults.weeklyBudget, defaults.currency ?? "PEN")} por semana (precios referenciales)
              </span>
            </Label>
            <Switch id="use-budget" checked={useBudget} onCheckedChange={setUseBudget} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{budgetNote ?? "Sin presupuesto semanal en tu objetivo: no comparamos costos."}</p>
        )}
      </section>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            <p>{error}</p>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" size="lg" className="flex-1" onClick={generate} disabled={!canGenerate}>
          <Sparkles aria-hidden="true" />
          Generar plan
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="flex-1"
          onClick={() => setDraft(emptyDraft({ name: validName, startDate, days, params: params() }))}
        >
          <PencilRuler aria-hidden="true" />
          Armar a mano
        </Button>
      </div>
      {!canGenerate && hasTargets && !autoPlansBlocked && pool.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay recetas disponibles para planificar todavía.</p>
      ) : null}
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <CalendarRange className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        El plan se arma con reglas fijas (sin IA) a partir de las recetas publicadas y tu meta. Siempre puedes cambiar recetas y porciones. No
        reemplaza la indicación de un profesional de la salud.
      </p>
    </div>
  );
}
