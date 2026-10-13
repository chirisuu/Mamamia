"use client";

import * as React from "react";
import { unstable_rethrow } from "next/navigation";
import { HeartHandshake, LoaderCircle, LogOut } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActionError } from "@/lib/action-result";
import { todayInTz } from "@/lib/dates";
import { HEALTH_DATA_CONSENT_TEXT } from "@/features/auth/consents";
import { DeleteAccountDialog } from "@/features/profile/components/delete-account-dialog";
import { ExportDataButton } from "@/features/profile/components/export-data-button";
import { completeOnboarding, grantHealthConsentAgain } from "../actions";
import { consentsSchema, EMPTY_CONSENTS, isCompleteAnswers, type DraftAnswers, type OnboardingAnswers, type OnboardingConsents } from "../schemas";
import { isStepId, type StepId } from "../steps";
import { browserTimeZone, clearDraft, isRecent, loadDraft, readRawDraft, restoreRawDraft } from "./draft-storage";
import { OnboardingWizard } from "./wizard";

type OnboardingClientProps = {
  appName: string;
  isAuthenticated: boolean;
  accountEmail: string | null;
  /** Datos ya guardados (perfil/objetivo) para precargar. */
  serverAnswers: DraftAnswers;
  redo: boolean;
  /** La persona retiró el consentimiento de datos de salud: solo pedimos volver a darlo. */
  reconsent: boolean;
};

const subscribeNothing = () => () => {};

/**
 * El asistente vive en el navegador (borrador en localStorage, zona horaria del dispositivo), así
 * que se monta solo en el cliente para no renderizar en el servidor algo distinto.
 */
export function OnboardingClient(props: OnboardingClientProps) {
  const mounted = React.useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  if (!mounted) return <OnboardingSkeleton />;
  if (props.reconsent) return <ReconsentPanel appName={props.appName} />;
  return <OnboardingStart {...props} />;
}

function OnboardingStart(props: OnboardingClientProps) {
  const [init] = React.useState(() => {
    const timezone = browserTimeZone();
    const today = todayInTz(timezone);
    const draft = props.redo ? null : loadDraft();
    const answers: DraftAnswers = { ...props.serverAnswers, ...(draft?.answers ?? {}) };
    const consents: OnboardingConsents = draft?.consents ?? { ...EMPTY_CONSENTS };
    const canAutoSave =
      props.isAuthenticated &&
      draft?.stage === "awaiting_account" &&
      isRecent(draft) &&
      isCompleteAnswers(answers) &&
      consentsSchema.safeParse(consents).success;
    const stepId: StepId = draft?.stepId && isStepId(draft.stepId) ? draft.stepId : "intro";
    return { timezone, today, answers, consents, canAutoSave, stepId, hasProgress: Boolean(draft) || props.redo };
  });
  const [mode, setMode] = React.useState<"auto" | "wizard">(init.canAutoSave ? "auto" : "wizard");

  if (mode === "auto" && isCompleteAnswers(init.answers)) {
    return (
      <AutoSave
        answers={init.answers}
        consents={init.consents}
        timezone={init.timezone}
        accountEmail={props.accountEmail}
        onReview={() => setMode("wizard")}
      />
    );
  }
  return (
    <OnboardingWizard
      appName={props.appName}
      isAuthenticated={props.isAuthenticated}
      accountEmail={props.accountEmail}
      initialAnswers={init.answers}
      initialConsents={init.consents}
      initialStepId={mode === "wizard" && init.canAutoSave ? "consents" : init.stepId}
      hasProgress={init.hasProgress}
      today={init.today}
      timezone={init.timezone}
      redo={props.redo}
    />
  );
}

/** Tras crear la cuenta y volver con sesión: guarda las respuestas pendientes sin pedir nada más. */
function AutoSave({
  answers,
  consents,
  timezone,
  accountEmail,
  onReview,
}: {
  answers: OnboardingAnswers;
  consents: OnboardingConsents;
  timezone: string;
  accountEmail: string | null;
  onReview: () => void;
}) {
  const [error, setError] = React.useState<ActionError | null>(null);
  const started = React.useRef(false);

  React.useEffect(() => {
    if (started.current) return;
    started.current = true;
    const backup = readRawDraft();
    clearDraft();
    React.startTransition(async () => {
      try {
        const result = await completeOnboarding({ answers, consents, timezone });
        if (result && !result.ok) {
          restoreRawDraft(backup);
          setError(result.error);
        }
      } catch (e) {
        unstable_rethrow(e);
        restoreRawDraft(backup);
        setError({ code: "NETWORK", message: "No pudimos conectar con el servidor. Revisa tu conexión." });
      }
    });
  }, [answers, consents, timezone]);

  return (
    <main id="contenido" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      {error ? (
        <>
          <Alert variant="destructive">
            <AlertTitle>No pudimos guardar tu plan</AlertTitle>
            <AlertDescription>
              <p>{error.message}</p>
              <p>Tus respuestas siguen en este dispositivo.</p>
            </AlertDescription>
          </Alert>
          <Button size="lg" onClick={onReview}>
            Revisar mis respuestas
          </Button>
        </>
      ) : (
        <div role="status" className="flex flex-col items-center gap-4 text-center">
          <LoaderCircle className="size-10 animate-spin text-primary-strong motion-reduce:animate-none" aria-hidden="true" />
          <h1 className="text-2xl font-semibold tracking-tight">Guardando tu plan…</h1>
          <p className="text-muted-foreground">
            {accountEmail ? `Lo estamos guardando en tu cuenta ${accountEmail}.` : "Lo estamos guardando en tu cuenta."}
          </p>
        </div>
      )}
    </main>
  );
}

function ReconsentPanel({ appName }: { appName: string }) {
  const [checked, setChecked] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function grant() {
    if (!checked) {
      setError("Marca la casilla para autorizar el tratamiento de tus datos de salud.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await grantHealthConsentAgain();
        if (result && !result.ok) setError(result.error.message);
      } catch (e) {
        unstable_rethrow(e);
        setError("No pudimos conectar con el servidor. Revisa tu conexión.");
      }
    });
  }

  return (
    <main id="contenido" className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 pb-10 pt-safe-8">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Tu acceso está en pausa</h1>
        <p className="text-muted-foreground">
          Retiraste tu autorización para tratar tus datos de salud. Sin ella, {appName} no puede calcular tus metas ni guardar tus
          registros. Tus datos no se borraron.
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="reconsent"
            checked={checked}
            onCheckedChange={(v) => {
              setChecked(v === true);
              setError(null);
            }}
            aria-describedby={error ? "reconsent-error" : undefined}
            aria-invalid={error ? true : undefined}
            className="mt-0.5"
          />
          <Label htmlFor="reconsent" className="block font-normal leading-relaxed">
            {HEALTH_DATA_CONSENT_TEXT}
          </Label>
        </div>
        {error ? (
          <p id="reconsent-error" role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <Button size="lg" onClick={grant} loading={pending}>
        Autorizar y volver a la app
      </Button>

      <Alert variant="info">
        <HeartHandshake aria-hidden="true" />
        <AlertTitle>¿Prefieres irte?</AlertTitle>
        <AlertDescription>
          <p>Puedes descargar una copia de tus datos y eliminar tu cuenta. Es tu decisión.</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <ExportDataButton />
            <DeleteAccountDialog />
          </div>
        </AlertDescription>
      </Alert>

      <form action="/auth/salir" method="post" className="justify-self-center">
        <Button type="submit" variant="ghost">
          <LogOut aria-hidden="true" /> Cerrar sesión
        </Button>
      </form>
    </main>
  );
}

export function OnboardingSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 pt-safe-6">
      <span className="sr-only">Cargando…</span>
      <Skeleton className="h-2.5 w-full rounded-full" />
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-5 w-full" />
      <div className="grid gap-3">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    </div>
  );
}
