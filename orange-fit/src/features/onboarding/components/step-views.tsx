"use client";

import * as React from "react";
import Link from "next/link";
import { Check, HeartHandshake, Info, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays } from "@/lib/dates";
import { formatNumber } from "@/lib/format";
import { ACTIVITY_LEVELS, ACTIVITY_LEVEL_CODES, type HealthFlag } from "@/lib/nutrition";
import { cn } from "@/lib/utils";
import { HEALTH_DATA_CONSENT_TEXT, LEGAL_LINKS } from "@/features/auth/consents";
import { PlanSummary } from "@/features/profile/components/plan-summary";
import {
  ALLERGEN_OPTIONS,
  COUNTRY_OPTIONS,
  CURRENCY_OPTIONS,
  DIET_PATTERN_OPTIONS,
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  HEALTH_FLAG_OPTIONS,
  INTOLERANCE_OPTIONS,
  RESTRICTION_SUGGESTIONS,
  defaultCurrencyFor,
} from "../options";
import { ageGate, goalNeedsRate, preliminaryRisk, weeklyRateOptions, type PlanResult } from "../plan";
import type { DraftAnswers, OnboardingConsents } from "../schemas";
import { deficitKnownBlocked, targetBmi } from "../steps";
import { ChipGroup, ChipToggle } from "./chip-group";
import { ChoiceCards } from "./choice-cards";
import { TagInput } from "./tag-input";

export type StepViewProps = {
  answers: DraftAnswers;
  update: (patch: DraftAnswers) => void;
  today: string;
  titleId: string;
  appName: string;
};

function Note({ children, icon: Icon = Info }: { children: React.ReactNode; icon?: typeof Info }) {
  return (
    <p className="flex gap-2.5 rounded-2xl bg-muted/70 p-4 text-sm leading-relaxed text-muted-foreground">
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function IntroView({ appName, hasProgress }: { appName: string; hasProgress: boolean }) {
  return (
    <div className="grid gap-4">
      <ul className="grid gap-3 text-base">
        <li className="flex gap-3">
          <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
          Son unas 20 preguntas cortas: te toma unos 3 minutos.
        </li>
        <li className="flex gap-3">
          <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
          Con tus respuestas calculamos tus calorías, macros, fibra y agua, y te mostramos la fórmula.
        </li>
        <li className="flex gap-3">
          <span aria-hidden="true" className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
          Tus respuestas se quedan en este dispositivo hasta que guardes tu plan.
        </li>
      </ul>
      {hasProgress ? <Note>Ya habías empezado: seguimos donde lo dejaste.</Note> : null}
      <Note icon={ShieldCheck}>
        {appName} te orienta con estimaciones; no es un diagnóstico ni reemplaza a un profesional de la salud.
      </Note>
    </div>
  );
}

export function NameView({ answers, update, titleId }: StepViewProps) {
  return (
    <Input
      aria-labelledby={titleId}
      autoComplete="given-name"
      maxLength={80}
      placeholder="Tu nombre"
      value={answers.displayName ?? ""}
      onChange={(e) => update({ displayName: e.target.value })}
      className="h-14 text-lg"
    />
  );
}

export function BirthDateView({ answers, update, today, titleId }: StepViewProps) {
  const { gate, age } = ageGate(answers.birthDate, today);
  return (
    <div className="grid gap-4">
      <Input
        type="date"
        aria-labelledby={titleId}
        aria-describedby="birth-date-hint"
        min={addDays(today, -365 * 101)}
        max={today}
        value={answers.birthDate ?? ""}
        onChange={(e) => update({ birthDate: e.target.value || undefined })}
        className="h-14 text-lg"
      />
      <p id="birth-date-hint" className="text-sm text-muted-foreground" aria-live="polite">
        {age != null && gate !== "invalid" ? `Tienes ${age} años.` : "Usamos tu edad, no compartimos tu fecha."}
      </p>
      {gate === "minor" ? (
        <Alert variant="info">
          <HeartHandshake aria-hidden="true" />
          <AlertTitle>Como tienes menos de 18 años</AlertTitle>
          <AlertDescription>
            <p>
              No calcularemos un déficit de calorías ni habilitaremos el ayuno: tu cuerpo aún está creciendo. Tu meta será de
              mantenimiento y te sugerimos revisarla con tu familia y un profesional de salud.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}
      {gate === "too_young" ? (
        <Alert variant="warning">
          <AlertTitle>Esta app es para personas de 13 años o más</AlertTitle>
          <AlertDescription>
            <p>Para cuidar tu alimentación a tu edad, lo mejor es hacerlo con tu familia y tu pediatra.</p>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export function SexView({ answers, update, titleId }: StepViewProps) {
  return (
    <div className="grid gap-4">
      <ChoiceCards
        aria-labelledby={titleId}
        value={answers.sex}
        onValueChange={(sex) => update({ sex })}
        options={[
          { value: "female", label: "Mujer", description: "Constante −161 en la fórmula" },
          { value: "male", label: "Hombre", description: "Constante +5 en la fórmula" },
        ]}
      />
      <Note>
        Lo pedimos solo porque la ecuación de Mifflin-St Jeor, que estima tu metabolismo basal, usa un valor distinto según el sexo
        biológico. No define tu identidad ni cambia nada más en la app. Si estás en terapia hormonal o no sabes cuál elegir,
        consúltalo con tu profesional; puedes cambiarlo luego en tu perfil.
      </Note>
    </div>
  );
}

export function HeightView({ answers, update }: StepViewProps) {
  return (
    <NumberStepper
      label="Estatura"
      unit="cm"
      size="lg"
      min={100}
      max={250}
      step={1}
      value={answers.heightCm ?? null}
      onValueChange={(heightCm) => update({ heightCm })}
    />
  );
}

export function WeightView({ answers, update }: StepViewProps) {
  return (
    <div className="grid gap-4">
      <NumberStepper
        label="Peso actual"
        unit="kg"
        size="lg"
        min={20}
        max={400}
        step={0.5}
        decimals={1}
        value={answers.weightKg ?? null}
        onValueChange={(weightKg) => update({ weightKg })}
      />
      <Note>Si no tienes una balanza a mano, usa tu peso aproximado. Lo podrás actualizar cuando quieras.</Note>
    </div>
  );
}

export function TargetWeightView({ answers, update }: StepViewProps) {
  const none = answers.targetWeightKg === null;
  const bmi = targetBmi(answers);
  return (
    <div className="grid gap-4">
      {none ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-center text-muted-foreground">
          Sin peso objetivo por ahora. Puedes definirlo después en tu perfil.
        </p>
      ) : (
        <NumberStepper
          label="Peso objetivo"
          unit="kg"
          size="lg"
          min={20}
          max={400}
          step={0.5}
          decimals={1}
          value={answers.targetWeightKg ?? null}
          onValueChange={(targetWeightKg) => update({ targetWeightKg })}
        />
      )}
      <ChipToggle
        pressed={none}
        onPressedChange={(p) => update({ targetWeightKg: p ? null : (answers.weightKg ?? undefined) })}
        className="justify-self-start"
      >
        No tengo un peso objetivo
      </ChipToggle>
      {!none && bmi != null && bmi < 18.5 ? (
        <Alert variant="info">
          <HeartHandshake aria-hidden="true" />
          <AlertTitle>Ese peso queda bajo el rango saludable para tu estatura</AlertTitle>
          <AlertDescription>
            <p>Con ese peso tu IMC sería menor a 18.5. Te sugerimos conversarlo con un profesional de salud antes de fijarlo.</p>
          </AlertDescription>
        </Alert>
      ) : null}
      <Note>El peso objetivo sirve para mostrarte tu avance; tus calorías dependen de tu objetivo y tu ritmo.</Note>
    </div>
  );
}

export function ActivityView({ answers, update, titleId }: StepViewProps) {
  return (
    <ChoiceCards
      aria-labelledby={titleId}
      value={answers.activityLevel}
      onValueChange={(activityLevel) => update({ activityLevel })}
      options={ACTIVITY_LEVEL_CODES.map((code) => ({
        value: code,
        label: ACTIVITY_LEVELS[code].label,
        description: ACTIVITY_LEVELS[code].description,
        aside: `×${ACTIVITY_LEVELS[code].factor}`,
      }))}
    />
  );
}

export function TrainingView({ answers, update }: StepViewProps) {
  const n = answers.trainingDaysPerWeek ?? 0;
  return (
    <div className="grid gap-4">
      <NumberStepper
        label="Sesiones por semana"
        unit={n === 1 ? "sesión" : "sesiones"}
        size="lg"
        min={0}
        max={14}
        step={1}
        value={answers.trainingDaysPerWeek ?? null}
        onValueChange={(trainingDaysPerWeek) => update({ trainingDaysPerWeek })}
      />
      <Note>Cuenta cada sesión de al menos 30 minutos. Si entrenas dos veces en un mismo día, cuenta 2. Si no entrenas, deja 0.</Note>
    </div>
  );
}

export function GoalView({ answers, update, titleId }: StepViewProps) {
  return (
    <ChoiceCards
      aria-labelledby={titleId}
      value={answers.goal}
      onValueChange={(goal) =>
        update({
          goal,
          // Cambiar de objetivo pide elegir el ritmo de nuevo (o lo anula si no aplica).
          weeklyRateKg: goalNeedsRate(goal) ? (goal === answers.goal ? answers.weeklyRateKg : undefined) : null,
        })
      }
      options={GOAL_OPTIONS}
    />
  );
}

export function RateView({ answers, update, today, titleId }: StepViewProps) {
  const { goal, weightKg, birthDate, sex, heightCm } = answers;
  if (!goalNeedsRate(goal) || weightKg == null || !birthDate || !sex || heightCm == null) {
    return <Note>Primero completa tu peso, estatura y objetivo.</Note>;
  }
  if (goal === "lose_fat" && deficitKnownBlocked(answers, today)) {
    return (
      <Alert variant="info">
        <HeartHandshake aria-hidden="true" />
        <AlertTitle>Por ahora no calcularemos un déficit</AlertTitle>
        <AlertDescription>
          <p>
            Por tu edad o tu IMC, tu meta de calorías será de mantenimiento. Puedes seguir registrando lo que comes y tu progreso;
            te sugerimos definir tu objetivo junto con un profesional de salud.
          </p>
        </AlertDescription>
      </Alert>
    );
  }
  const risk = preliminaryRisk({ birthDate, sex, heightCm, weightKg, goal }, today);
  const options = weeklyRateOptions(goal, weightKg, risk);
  const selected = options.find((o) => answers.weeklyRateKg != null && Math.abs(o.kg - answers.weeklyRateKg) < 0.005);
  const direction = goal === "lose_fat" ? "menos" : "más";
  return (
    <div className="grid gap-4">
      <ChoiceCards
        aria-labelledby={titleId}
        value={selected ? String(selected.pct) : undefined}
        onValueChange={(v) => {
          const option = options.find((o) => String(o.pct) === v);
          if (option && !option.disabled) update({ weeklyRateKg: option.kg });
        }}
        options={options.map((o) => ({
          value: String(o.pct),
          label: o.label,
          badge: o.recommended ? (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">Recomendado</span>
          ) : undefined,
          description: o.disabledReason ?? o.hint,
          aside: (
            <span className="grid" data-numeric="">
              <span className="text-foreground">
                {formatNumber(o.kg, 2)} kg {direction}
              </span>
              <span className="text-xs">{formatNumber(o.pct, 2)} % /semana</span>
            </span>
          ),
          disabled: o.disabled,
        }))}
      />
      {goal === "gain_muscle" ? (
        <Note>
          Al ganar músculo, las calorías extra se ajustan según tu experiencia (5 a 15 % sobre tu gasto). Este ritmo es tu referencia
          para revisar el progreso.
        </Note>
      ) : (
        <Note>
          Es una estimación inicial: el ritmo real varía de semana a semana y suele hacerse más lento con el tiempo. Nunca bajamos de
          un mínimo seguro de calorías.
        </Note>
      )}
    </div>
  );
}

export function DietView({ answers, update, titleId }: StepViewProps) {
  return (
    <ChoiceCards
      aria-labelledby={titleId}
      value={answers.dietPattern}
      onValueChange={(dietPattern) => update({ dietPattern })}
      options={DIET_PATTERN_OPTIONS}
    />
  );
}

const ALLERGEN_CODES = new Set<string>(ALLERGEN_OPTIONS.map((o) => o.code));
const INTOLERANCE_CODES = new Set<string>(INTOLERANCE_OPTIONS.map((o) => o.code));

export function AllergiesView({ answers, update }: StepViewProps) {
  const allergies = answers.allergies ?? [];
  const intolerances = answers.intolerances ?? [];
  const knownAllergies = allergies.filter((a) => ALLERGEN_CODES.has(a));
  const otherAllergies = allergies.filter((a) => !ALLERGEN_CODES.has(a));
  const knownIntolerances = intolerances.filter((a) => INTOLERANCE_CODES.has(a));
  const otherIntolerances = intolerances.filter((a) => !INTOLERANCE_CODES.has(a));
  return (
    <div className="grid gap-8">
      <section className="grid gap-3" aria-labelledby="allergies-title">
        <h2 id="allergies-title" className="text-base font-semibold">
          Alergias
        </h2>
        <ChipGroup
          aria-labelledby="allergies-title"
          options={ALLERGEN_OPTIONS.map((o) => ({ value: o.code, label: o.label }))}
          value={knownAllergies}
          onChange={(v) => update({ allergies: [...v, ...otherAllergies] })}
        />
        <TagInput
          id="allergies-other"
          label="Otra alergia"
          placeholder="Ej.: kiwi"
          value={otherAllergies}
          onChange={(v) => update({ allergies: [...knownAllergies, ...v] })}
        />
      </section>
      <section className="grid gap-3" aria-labelledby="intolerances-title">
        <h2 id="intolerances-title" className="text-base font-semibold">
          Intolerancias
        </h2>
        <ChipGroup
          aria-labelledby="intolerances-title"
          options={INTOLERANCE_OPTIONS.map((o) => ({ value: o.code, label: o.label }))}
          value={knownIntolerances}
          onChange={(v) => update({ intolerances: [...v, ...otherIntolerances] })}
        />
        <TagInput
          id="intolerances-other"
          label="Otra intolerancia"
          placeholder="Ej.: fructosa"
          value={otherIntolerances}
          onChange={(v) => update({ intolerances: [...knownIntolerances, ...v] })}
        />
      </section>
      <Note>Si no tienes ninguna, continúa sin marcar nada.</Note>
    </div>
  );
}

const RESTRICTION_SET = new Set<string>(RESTRICTION_SUGGESTIONS);

export function RestrictionsView({ answers, update }: StepViewProps) {
  const restrictions = answers.restrictions ?? [];
  const suggested = restrictions.filter((r) => RESTRICTION_SET.has(r));
  const custom = restrictions.filter((r) => !RESTRICTION_SET.has(r));
  return (
    <div className="grid gap-8">
      <section className="grid gap-3" aria-labelledby="restrictions-title">
        <h2 id="restrictions-title" className="text-base font-semibold">
          Restricciones
        </h2>
        <ChipGroup
          aria-labelledby="restrictions-title"
          options={RESTRICTION_SUGGESTIONS.map((r) => ({ value: r, label: r }))}
          value={suggested}
          onChange={(v) => update({ restrictions: [...v, ...custom] })}
        />
        <TagInput
          id="restrictions-other"
          label="Otra restricción"
          placeholder="Ej.: sin frituras"
          value={custom}
          onChange={(v) => update({ restrictions: [...suggested, ...v] })}
        />
      </section>
      <TagInput
        id="disliked-foods"
        label="Alimentos que no te gustan"
        hint="Los evitaremos al sugerirte recetas y planes."
        placeholder="Ej.: hígado, berenjena"
        value={answers.dislikedFoods ?? []}
        onChange={(dislikedFoods) => update({ dislikedFoods })}
      />
    </div>
  );
}

export function LocationView({ answers, update }: StepViewProps) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="country">País</Label>
        <Select
          value={answers.countryCode}
          onValueChange={(countryCode) => update({ countryCode, currencyCode: defaultCurrencyFor(countryCode) })}
        >
          <SelectTrigger id="country">
            <SelectValue placeholder="Elige tu país" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRY_OPTIONS.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="currency">Moneda</Label>
        <Select value={answers.currencyCode} onValueChange={(currencyCode) => update({ currencyCode })}>
          <SelectTrigger id="currency">
            <SelectValue placeholder="Elige tu moneda" />
          </SelectTrigger>
          <SelectContent>
            {CURRENCY_OPTIONS.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Note>Los precios que mostramos son referenciales, no en tiempo real.</Note>
    </div>
  );
}

export function BudgetView({ answers, update }: StepViewProps) {
  const none = answers.weeklyBudget === null;
  const currency = answers.currencyCode ?? "PEN";
  return (
    <div className="grid gap-4">
      {none ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-center text-muted-foreground">
          Sin presupuesto definido. Te mostraremos costos referenciales igual.
        </p>
      ) : (
        <NumberStepper
          label="Presupuesto semanal"
          unit={currency === "PEN" ? "S/" : currency}
          size="lg"
          min={0}
          max={100000}
          step={10}
          decimals={0}
          value={answers.weeklyBudget ?? null}
          onValueChange={(weeklyBudget) => update({ weeklyBudget })}
        />
      )}
      <ChipToggle
        pressed={none}
        onPressedChange={(p) => update({ weeklyBudget: p ? null : undefined })}
        className="justify-self-start"
      >
        Prefiero no indicarlo
      </ChipToggle>
    </div>
  );
}

const MEALS_OPTIONS = [
  { value: "2", label: "2 comidas", description: "Por ejemplo, almuerzo y cena." },
  { value: "3", label: "3 comidas", description: "Desayuno, almuerzo y cena." },
  { value: "4", label: "4 comidas", description: "Las tres principales y un snack." },
  { value: "5", label: "5 comidas", description: "Las tres principales y dos snacks." },
  { value: "6", label: "6 comidas", description: "Comidas más pequeñas y frecuentes." },
] as const;

export function MealsView({ answers, update, titleId }: StepViewProps) {
  return (
    <ChoiceCards
      aria-labelledby={titleId}
      value={answers.mealsPerDay != null ? String(answers.mealsPerDay) : undefined}
      onValueChange={(v) => update({ mealsPerDay: Number(v) })}
      options={MEALS_OPTIONS}
    />
  );
}

export function ExperienceView({ answers, update, titleId }: StepViewProps) {
  return (
    <ChoiceCards
      aria-labelledby={titleId}
      value={answers.experience}
      onValueChange={(experience) => update({ experience })}
      options={EXPERIENCE_OPTIONS}
    />
  );
}

export function HealthView({ answers, update, titleId }: StepViewProps) {
  const flags = answers.healthFlags ?? [];
  const toggle = (flag: HealthFlag, on: boolean) =>
    update({ healthFlags: on ? [...flags.filter((f) => f !== flag), flag] : flags.filter((f) => f !== flag) });
  return (
    <div className="grid gap-4">
      <div role="group" aria-labelledby={titleId} className="grid gap-3">
        {HEALTH_FLAG_OPTIONS.map((o) => {
          const pressed = flags.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={pressed}
              onClick={() => toggle(o.value, !pressed)}
              className={cn(
                "flex min-h-16 w-full items-start gap-3 rounded-2xl border-2 bg-card px-4 py-3 text-left outline-none",
                "transition-[border-color,background-color] duration-150",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                pressed ? "border-primary bg-accent" : "border-border hover:border-input",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2",
                  pressed ? "border-primary bg-primary text-primary-foreground" : "border-input",
                )}
              >
                {pressed ? <Check className="size-4 stroke-[3]" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold leading-snug">{o.label}</span>
                <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{o.description}</span>
              </span>
            </button>
          );
        })}
        <ChipToggle
          pressed={flags.length === 0}
          onPressedChange={(p) => {
            if (p) update({ healthFlags: [] });
          }}
          className="justify-self-start"
        >
          Ninguna de estas
        </ChipToggle>
      </div>
      {flags.includes("eating_disorder_history") ? (
        <Alert variant="info">
          <HeartHandshake aria-hidden="true" />
          <AlertTitle>Gracias por contárnoslo</AlertTitle>
          <AlertDescription>
            <p>
              No te mostraremos déficit ni ayuno, y tu meta será de mantenimiento. Te sugerimos usar la app junto con tu profesional
              de salud. Si estás pasando por un momento difícil, no tienes que hacerlo sola o solo: busca apoyo.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}
      <Note icon={ShieldCheck}>
        Esta información es sensible: solo la usamos para cuidar tus metas y no la compartimos. Puedes cambiarla cuando quieras.
      </Note>
    </div>
  );
}

export function ResultView({
  answers,
  plan,
  error,
}: {
  answers: DraftAnswers;
  plan: PlanResult | null;
  error: string | null;
}) {
  if (error || !plan) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No pudimos calcular tu plan</AlertTitle>
        <AlertDescription>
          <p>{error ?? "Faltan algunas respuestas."}</p>
        </AlertDescription>
      </Alert>
    );
  }
  const t = plan.targets;
  return (
    <div className="grid gap-4">
      {!plan.storable ? (
        <Alert variant="warning">
          <AlertTitle>Necesitamos que lo revise un profesional</AlertTitle>
          <AlertDescription>
            <p>
              Con estos datos no podemos fijar una meta segura de forma automática. Te recomendamos definirla con un profesional de
              salud; revisa también tu peso y estatura por si hubo un error al escribirlos.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}
      <PlanSummary
        title={answers.displayName ? `Meta diaria de ${answers.displayName}` : "Tu meta diaria"}
        energyKcal={t.energyKcal}
        proteinG={t.proteinG}
        carbsG={t.carbsG}
        fatG={t.fatG}
        fiberG={t.fiberG}
        waterMl={t.waterMl}
        explanation={{
          steps: t.steps,
          assumptions: t.assumptions,
          warnings: t.warnings,
          riskMessages: plan.risk.messages,
          notes: plan.notes,
          riskLevel: plan.risk.level,
          expectedWeeklyChangeKg: t.expectedWeeklyChangeKg,
        }}
      />
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl border border-border bg-card p-3">
          <dt className="text-xs text-muted-foreground">Metabolismo basal</dt>
          <dd className="font-semibold" data-numeric="">
            {formatNumber(t.bmr)} kcal
          </dd>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <dt className="text-xs text-muted-foreground">Gasto diario</dt>
          <dd className="font-semibold" data-numeric="">
            {formatNumber(t.tdee)} kcal
          </dd>
        </div>
        <div className="rounded-xl border border-border bg-card p-3">
          <dt className="text-xs text-muted-foreground">Ajuste</dt>
          <dd className="font-semibold" data-numeric="">
            {t.goalAdjustmentKcal > 0 ? "+" : t.goalAdjustmentKcal < 0 ? "−" : ""}
            {formatNumber(Math.abs(t.goalAdjustmentKcal))} kcal
          </dd>
        </div>
      </dl>
    </div>
  );
}

type ConsentErrors = Partial<Record<keyof OnboardingConsents, string>>;

export function ConsentsView({
  consents,
  onChange,
  errors,
}: {
  consents: OnboardingConsents;
  onChange: (patch: Partial<OnboardingConsents>) => void;
  errors: ConsentErrors;
}) {
  const item = (
    key: keyof OnboardingConsents,
    label: React.ReactNode,
    opts: { required?: boolean; description?: React.ReactNode } = {},
  ) => {
    const id = `consent-${key}`;
    const errorId = `${id}-error`;
    return (
      <div className={cn("grid gap-2 rounded-2xl border bg-card p-4", errors[key] ? "border-destructive" : "border-border")}>
        <div className="flex items-start gap-3">
          <Checkbox
            id={id}
            checked={consents[key]}
            onCheckedChange={(v) => onChange({ [key]: v === true })}
            aria-invalid={errors[key] ? true : undefined}
            aria-describedby={errors[key] ? errorId : undefined}
            aria-required={opts.required || undefined}
            className="mt-0.5"
          />
          <div className="grid gap-1">
            <Label htmlFor={id} className="block font-normal leading-relaxed">
              {label}
              {opts.required ? <span className="text-muted-foreground"> (obligatorio)</span> : <span className="text-muted-foreground"> (opcional)</span>}
            </Label>
            {opts.description ? <p className="text-sm text-muted-foreground">{opts.description}</p> : null}
          </div>
        </div>
        {errors[key] ? (
          <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
            {errors[key]}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="grid gap-3">
      {item(
        "termsPrivacy",
        <>
          He leído y acepto los{" "}
          <Link href={LEGAL_LINKS.terms} target="_blank" className="font-medium text-primary-strong underline underline-offset-4">
            Términos y condiciones
          </Link>{" "}
          y la{" "}
          <Link href={LEGAL_LINKS.privacy} target="_blank" className="font-medium text-primary-strong underline underline-offset-4">
            Política de privacidad
          </Link>
          .
        </>,
        { required: true },
      )}
      {item("healthData", HEALTH_DATA_CONSENT_TEXT, { required: true })}
      {item("aiProcessing", "Acepto que mis fotos, audios o textos de comidas se analicen con IA para sugerirme alimentos y porciones.", {
        description: "Se envían a un proveedor de IA externo solo cuando usas esas funciones, y siempre confirmas antes de guardar.",
      })}
      {item("marketing", "Quiero recibir novedades y consejos por correo.", {
        description: "Puedes darte de baja cuando quieras.",
      })}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Puedes revisar o retirar estos permisos cuando quieras en Perfil → Privacidad.
      </p>
    </div>
  );
}
