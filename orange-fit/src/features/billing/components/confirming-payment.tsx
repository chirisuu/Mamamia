"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type ConfirmState = "confirmed" | "payment_issue" | "pending";
type Phase = "checking" | "slow" | "payment_issue" | "offline";

const INTERVAL_MS = 4000;
/** ~2 minutos de consultas antes de decir que está tardando. */
const MAX_ATTEMPTS = 30;

type ConfirmingPaymentProps = {
  sessionId: string | null;
  preapprovalId: string | null;
  supportEmail: string | null;
};

/**
 * Mientras el proveedor confirma el pago: consulta el estado REAL (POST /api/billing/confirm) cada
 * pocos segundos. Cuando hay acceso, refresca la página (el servidor muestra el "listo" con datos).
 * Nunca da el pago por hecho sin que la BD lo diga.
 */
export function ConfirmingPayment({ sessionId, preapprovalId, supportEmail }: ConfirmingPaymentProps) {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("checking");
  const [round, setRound] = React.useState(0);

  React.useEffect(() => {
    if (phase !== "checking") return;
    let cancelled = false;
    let attempts = 0;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function check() {
      attempts += 1;
      try {
        const res = await fetch("/api/billing/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...(sessionId ? { sessionId } : {}), ...(preapprovalId ? { preapprovalId } : {}) }),
        });
        if (cancelled) return;
        if (res.ok) {
          failures = 0;
          const body = (await res.json()) as { state: ConfirmState };
          if (cancelled) return;
          // El servidor vuelve a leer el estado y muestra el "listo"; si por algo no cambia, se sigue consultando.
          if (body.state === "confirmed") router.refresh();
          if (body.state === "payment_issue") {
            setPhase("payment_issue");
            return;
          }
        } else {
          failures += 1;
        }
      } catch {
        failures += 1;
      }
      if (cancelled) return;
      if (failures >= 3) {
        setPhase("offline");
        return;
      }
      if (attempts >= MAX_ATTEMPTS) {
        setPhase("slow");
        return;
      }
      timer = setTimeout(check, INTERVAL_MS);
    }

    void check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [phase, round, sessionId, preapprovalId, router]);

  const retry = () => {
    setPhase("checking");
    setRound((r) => r + 1);
  };

  if (phase === "payment_issue") {
    return (
      <Alert variant="warning">
        <TriangleAlert aria-hidden="true" />
        <AlertTitle>El pago no se completó</AlertTitle>
        <AlertDescription>
          <p>El proveedor nos avisó que no pudo hacer el cobro. Revisa tu medio de pago en Suscripción.</p>
          <Link href="/app/perfil/suscripcion" className="mt-1 inline-flex min-h-11 items-center font-semibold text-primary-strong underline-offset-4 hover:underline">
            Ir a mi suscripción
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm" aria-live="polite">
        {phase === "checking" ? (
          <Spinner className="size-8 text-primary-strong" label="Confirmando tu pago" />
        ) : (
          <Clock className="size-8 text-muted-foreground" aria-hidden="true" />
        )}
        <h2 className="text-lg font-semibold tracking-tight">
          {phase === "checking" ? "Estamos confirmando tu pago" : phase === "slow" ? "Está tardando más de lo normal" : "No pudimos revisar el estado"}
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {phase === "checking"
            ? "El proveedor nos avisa en unos segundos. Puedes quedarte aquí: la página se actualiza sola."
            : phase === "slow"
              ? "Todavía no recibimos la confirmación. Si se hizo el cobro, Premium se activará en cuanto llegue y lo verás en Suscripción."
              : "Parece un problema de conexión. Tu pago no se pierde: vuelve a revisar en un momento."}
        </p>
        {phase !== "checking" ? (
          <Button onClick={retry} variant="outline">
            Volver a revisar
          </Button>
        ) : null}
      </div>
      {phase === "slow" && supportEmail ? (
        <p className="text-center text-sm text-muted-foreground">
          ¿Pasó más de una hora?{" "}
          <a href={`mailto:${supportEmail}`} className="font-medium text-primary-strong underline-offset-4 hover:underline">
            Escríbenos a {supportEmail}
          </a>{" "}
          y lo revisamos.
        </p>
      ) : null}
    </div>
  );
}
