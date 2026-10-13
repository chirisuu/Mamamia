"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, unstable_rethrow } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, LogOut, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ActionError } from "@/lib/action-result";
import { isNutritionInputError } from "@/lib/nutrition";
import { completeOnboarding } from "../actions";
import { computePlan, planInputFromAnswers, type PlanResult } from "../plan";
import {
  consentsSchema,
  isCompleteAnswers,
  ONBOARDING_DRAFT_VERSION,
  type DraftAnswers,
  type OnboardingAnswers,
  type OnboardingConsents,
  type OnboardingDraft,
} from "../schemas";
import { defaultsForStep, firstIncompleteStep, validateStep, visibleSteps, type StepId } from "../steps";
import { clearDraft, readRawDraft, restoreRawDraft, writeDraft } from "./draft-storage";
import * as Views from "./step-views";

type StepCopy = { title: (a: DraftAnswers) => string; description?: (a: DraftAnswers) => string };

const COPY: Record<StepId, StepCopy> = {
  intro: { title: () => "Armemos tu plan", description: () => "Unas preguntas y te mostramos tus metas con la fórmula detrás." },
  name: { title: () => "¿Cómo te llamas?", description: () => "Así te saludaremos en la app." },
  birthDate: { title: () => "¿Cuándo naciste?", description: () => "Tu edad cambia cuánta energía necesitas." },
  sex: { title: () => "Sexo para el cálculo", description: () => "Solo afecta la fórmula del metabolismo basal." },
  height: { title: () => "¿Cuánto mides?" },
  weight: { title: () => "¿Cuánto pesas hoy?" },
  targetWeight: { title: () => "¿Tienes un peso objetivo?", description: () => "Es opcional." },
  activity: {
    title: () => "¿Qué tan activo es tu día?",
    description: () => "Piensa en una semana normal, con tu trabajo y tu ejercicio.",
  },
  training: { title: () => "¿Cuántas veces entrenas por semana?" },
  goal: { title: () => "¿Cuál es tu objetivo principal?" },
  rate: {
    title: (a) => (a.goal === "gain_muscle" ? "¿A qué ritmo quieres subir?" : "¿A qué ritmo quieres bajar?"),
    description: () => "Opciones prudentes, como porcentaje de tu peso por semana.",
  },
  diet: { title: () => "¿Cómo te gusta comer?", description: () => "Lo usamos para sugerirte recetas y planes." },
  allergies: {
    title: () => "¿Alergias o intolerancias?",
    description: () => "Excluiremos esos ingredientes de tus recetas y planes.",
  },
  restrictions: { title: () => "¿Algo que no comes o no te gusta?", description: () => "Todo es opcional." },
  location: { title: () => "¿Dónde vives?", description: () => "Para mostrarte alimentos y precios de tu país." },
  budget: {
    title: () => "¿Cuánto quieres gastar en comida por semana?",
    description: () => "Es opcional. Lo usamos para estimar el costo de tus planes.",
  },
  meals: { title: () => "¿Cuántas comidas haces al día?" },
  experience: { title: () => "¿Cuánta experiencia tienes?", description: () => "Entrenando y cuidando tu alimentación." },
  health: {
    title: () => "¿Alguna de estas situaciones aplica a ti?",
    description: () => "Algunas cambian lo que es seguro recomendarte. No es un diagnóstico.",
  },
  result: { title: (a) => (a.displayName ? `${a.displayName}, este es tu punto de partida` : "Este es tu punto de partida") },
  consents: {
    title: () => "Tu permiso para guardar tu plan",
    description: () => "Necesitamos tu autorización expresa para tratar tus datos de salud.",
  },
};

export type WizardProps = {
  appName: string;
  isAuthenticated: boolean;
  accountEmail: string | null;
  initialAnswers: DraftAnswers;
  initialConsents: OnboardingConsents;
  initialStepId: StepId;
  hasProgress: boolean;
  today: string;
  timezone: string;
  /** Rehacer el cuestionario con sesión (desde Metas): vuelve a /app/perfil/metas al cancelar. */
  redo: boolean;
};

const NETWORK_ERROR: ActionError = {
  code: "NETWORK",
  message: "No pudimos conectar con el servidor. Revisa tu conexión: tus respuestas siguen guardadas en este dispositivo.",
};

export function OnboardingWizard(props: WizardProps) {
  const { appName, isAuthenticated, accountEmail, today, timezone, redo } = props;
  const router = useRouter();
  const [answers, setAnswers] = React.useState<DraftAnswers>(props.initialAnswers);
  const [consents, setConsents] = React.useState<OnboardingConsents>(props.initialConsents);
  const [stepId, setStepId] = React.useState<StepId>(props.initialStepId);
  const [direction, setDirection] = React.useState<1 | -1>(1);
  const [stepError, setStepError] = React.useState<string | null>(null);
  const [consentErrors, setConsentErrors] = React.useState<Partial<Record<keyof OnboardingConsents, string>>>({});
  const [saveError, setSaveError] = React.useState<ActionError | null>(null);
  const [pending, startTransition] = React.useTransition();
  const persist = React.useRef(true);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const firstRender = React.useRef(true);
  const titleId = React.useId();

  const steps = visibleSteps(answers);
  const index = Math.max(0, steps.indexOf(stepId));
  const currentId = steps[index]!;
  const total = steps.length - 1;

  // Guarda el borrador en este dispositivo (sistema externo: localStorage).
  React.useEffect(() => {
    if (!persist.current) return;
    const draft: OnboardingDraft = {
      version: ONBOARDING_DRAFT_VERSION,
      answers,
      consents,
      stepId: currentId,
      stage: "in_progress",
      updatedAt: new Date().toISOString(),
    };
    writeDraft(draft);
  }, [answers, consents, currentId]);

  // Al cambiar de paso, el foco va al título (lectores de pantalla y teclado).
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [currentId]);

  const plan = React.useMemo((): { plan: PlanResult | null; error: string | null } => {
    if (currentId !== "result" && currentId !== "consents") return { plan: null, error: null };
    if (!isCompleteAnswers(answers)) return { plan: null, error: "Faltan algunas respuestas." };
    try {
      return { plan: computePlan(planInputFromAnswers(answers), today), error: null };
    } catch (error) {
      if (isNutritionInputError(error)) return { plan: null, error: error.message };
      return { plan: null, error: "Ocurrió un error inesperado al calcular." };
    }
  }, [answers, currentId, today]);

  function update(patch: DraftAnswers) {
    setAnswers((a) => ({ ...a, ...patch }));
    setStepError(null);
  }

  function goTo(id: StepId, dir: 1 | -1) {
    const defaults = defaultsForStep(id, answers);
    if (Object.keys(defaults).length > 0) setAnswers((a) => ({ ...a, ...defaults }));
    setDirection(dir);
    setStepError(null);
    setSaveError(null);
    setStepId(id);
  }

  function goNext() {
    const message = validateStep(currentId, answers, today);
    if (message) {
      setStepError(message);
      return;
    }
    if (currentId === "result") {
      if (!plan.plan) {
        // Faltan respuestas (borrador retomado a medias): lleva a la primera pendiente.
        if (!isCompleteAnswers(answers)) goTo(firstIncompleteStep(answers, today), -1);
        else setStepError(plan.error ?? "Revisa tus respuestas.");
        return;
      }
      if (!plan.plan.storable) {
        setStepError("Con estos datos no podemos guardar una meta automática. Revisa tu peso y estatura.");
        return;
      }
    }
    const nextId = steps[index + 1];
    if (nextId) goTo(nextId, 1);
  }

  function goBack() {
    const prev = steps[index - 1];
    if (prev) goTo(prev, -1);
  }

  function checkConsents(): boolean {
    const parsed = consentsSchema.safeParse(consents);
    if (parsed.success) {
      setConsentErrors({});
      return true;
    }
    const errors: Partial<Record<keyof OnboardingConsents, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof OnboardingConsents;
      errors[key] ??= issue.message;
    }
    setConsentErrors(errors);
    return false;
  }

  /** Devuelve las respuestas completas o lleva al primer paso que falta. */
  function completeAnswers(): OnboardingAnswers | null {
    const current = answers;
    if (isCompleteAnswers(current)) return current;
    goTo(firstIncompleteStep(current, today), -1);
    return null;
  }

  function save() {
    if (!checkConsents()) return;
    const complete = completeAnswers();
    if (!complete) return;
    // Se borra el borrador antes de enviar (si todo sale bien, la acción redirige y no hay "después").
    // Si falla, se restaura tal cual.
    const backup = readRawDraft();
    persist.current = false;
    clearDraft();
    setSaveError(null);
    startTransition(async () => {
      try {
        const result = await completeOnboarding({ answers: complete, consents, timezone });
        if (result && !result.ok) {
          restoreRawDraft(backup);
          persist.current = true;
          setSaveError(result.error);
        }
      } catch (error) {
        unstable_rethrow(error);
        restoreRawDraft(backup);
        persist.current = true;
        setSaveError(NETWORK_ERROR);
      }
    });
  }

  function continueToAccount(target: "register" | "login") {
    if (!checkConsents() || !completeAnswers()) return;
    persist.current = false;
    writeDraft({
      version: ONBOARDING_DRAFT_VERSION,
      answers,
      consents,
      stepId: "consents",
      stage: "awaiting_account",
      updatedAt: new Date().toISOString(),
    });
    router.push(target === "register" ? "/registro?from=onboarding" : "/ingresar?next=%2Fonboarding");
  }

  const copy = COPY[currentId];
  const viewProps: Views.StepViewProps = { answers, update, today, titleId, appName };
  const exitHref = redo ? "/app/perfil/metas" : isAuthenticated ? null : "/";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
      <header className="sticky top-0 z-20 bg-background/90 pt-safe backdrop-blur-lg supports-[backdrop-filter]:bg-background/75">
        <div className="flex h-16 items-center gap-2 px-2">
          {index > 0 ? (
            <Button type="button" variant="ghost" size="icon-sm" className="rounded-full" onClick={goBack} aria-label="Pregunta anterior" disabled={pending}>
              <ChevronLeft className="size-6" aria-hidden="true" />
            </Button>
          ) : (
            <span className="size-11" aria-hidden="true" />
          )}
          <div className="grid flex-1 gap-1.5 px-1">
            <Progress value={index} max={total} aria-label={`Paso ${index} de ${total}`} />
            <p className="text-center text-xs font-medium text-muted-foreground" aria-hidden="true">
              {index === 0 ? appName : `${index} de ${total}`}
            </p>
          </div>
          {exitHref ? (
            <Button asChild variant="ghost" size="icon-sm" className="rounded-full">
              <Link href={exitHref} aria-label={redo ? "Cancelar y volver a Metas" : "Salir (tus respuestas quedan guardadas)"}>
                <X className="size-6" aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <form action="/auth/salir" method="post">
              <Button type="submit" variant="ghost" size="icon-sm" className="rounded-full" aria-label="Cerrar sesión">
                <LogOut className="size-5" aria-hidden="true" />
              </Button>
            </form>
          )}
        </div>
      </header>

      <main id="contenido" className="flex flex-1 flex-col px-4 pb-6 pt-4">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.section
            key={currentId}
            custom={direction}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -24 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            aria-labelledby={titleId}
            className="grid gap-6"
          >
            <div className="grid gap-2">
              <h1
                id={titleId}
                ref={headingRef}
                tabIndex={-1}
                className="text-2xl font-semibold tracking-tight outline-none sm:text-3xl"
              >
                {copy.title(answers)}
              </h1>
              {copy.description ? <p className="text-muted-foreground">{copy.description(answers)}</p> : null}
            </div>

            <StepBody
              id={currentId}
              viewProps={viewProps}
              hasProgress={props.hasProgress}
              plan={plan}
              consents={consents}
              consentErrors={consentErrors}
              onConsentsChange={(patch) => {
                setConsents((c) => ({ ...c, ...patch }));
                setConsentErrors((e) => {
                  const next = { ...e };
                  for (const key of Object.keys(patch) as Array<keyof OnboardingConsents>) delete next[key];
                  return next;
                });
              }}
            />

            {stepError ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {stepError}
              </p>
            ) : null}
            {saveError ? (
              <Alert variant="destructive">
                <AlertTitle>No pudimos guardar tu plan</AlertTitle>
                <AlertDescription>
                  <p>{saveError.message}</p>
                </AlertDescription>
              </Alert>
            ) : null}
          </motion.section>
        </AnimatePresence>
      </main>

      <footer className="sticky bottom-0 z-20 border-t border-border/70 bg-background/95 px-4 pb-safe-4 pt-3 backdrop-blur-lg">
        {currentId === "consents" ? (
          isAuthenticated ? (
            <div className="grid gap-2">
              <Button type="button" size="lg" className="w-full" onClick={save} loading={pending}>
                Guardar mi plan
              </Button>
              {accountEmail ? (
                <p className="text-center text-xs text-muted-foreground">Se guardará en la cuenta {accountEmail}.</p>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-2">
              <Button type="button" size="lg" className="w-full" onClick={() => continueToAccount("register")}>
                Crea tu cuenta para guardar tu plan
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => continueToAccount("login")}>
                Ya tengo cuenta: ingresar
              </Button>
            </div>
          )
        ) : (
          <Button type="button" size="lg" className="w-full" onClick={goNext} disabled={pending}>
            {currentId === "intro" ? (props.hasProgress ? "Continuar" : "Empezar") : currentId === "result" ? "Continuar" : "Siguiente"}
          </Button>
        )}
      </footer>
    </div>
  );
}

function StepBody({
  id,
  viewProps,
  hasProgress,
  plan,
  consents,
  consentErrors,
  onConsentsChange,
}: {
  id: StepId;
  viewProps: Views.StepViewProps;
  hasProgress: boolean;
  plan: { plan: PlanResult | null; error: string | null };
  consents: OnboardingConsents;
  consentErrors: Partial<Record<keyof OnboardingConsents, string>>;
  onConsentsChange: (patch: Partial<OnboardingConsents>) => void;
}) {
  switch (id) {
    case "intro":
      return <Views.IntroView appName={viewProps.appName} hasProgress={hasProgress} />;
    case "name":
      return <Views.NameView {...viewProps} />;
    case "birthDate":
      return <Views.BirthDateView {...viewProps} />;
    case "sex":
      return <Views.SexView {...viewProps} />;
    case "height":
      return <Views.HeightView {...viewProps} />;
    case "weight":
      return <Views.WeightView {...viewProps} />;
    case "targetWeight":
      return <Views.TargetWeightView {...viewProps} />;
    case "activity":
      return <Views.ActivityView {...viewProps} />;
    case "training":
      return <Views.TrainingView {...viewProps} />;
    case "goal":
      return <Views.GoalView {...viewProps} />;
    case "rate":
      return <Views.RateView {...viewProps} />;
    case "diet":
      return <Views.DietView {...viewProps} />;
    case "allergies":
      return <Views.AllergiesView {...viewProps} />;
    case "restrictions":
      return <Views.RestrictionsView {...viewProps} />;
    case "location":
      return <Views.LocationView {...viewProps} />;
    case "budget":
      return <Views.BudgetView {...viewProps} />;
    case "meals":
      return <Views.MealsView {...viewProps} />;
    case "experience":
      return <Views.ExperienceView {...viewProps} />;
    case "health":
      return <Views.HealthView {...viewProps} />;
    case "result":
      return <Views.ResultView answers={viewProps.answers} plan={plan.plan} error={plan.error} />;
    case "consents":
      return <Views.ConsentsView consents={consents} onChange={onConsentsChange} errors={consentErrors} />;
  }
}
