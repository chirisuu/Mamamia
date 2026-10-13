"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import type { BillingProviderId, SubscriptionStatus } from "@/lib/billing/types";
import { PROVIDER_LABELS } from "../labels";

type ApiError = { code: string; message: string };

type SubscriptionActionsProps = {
  provider: BillingProviderId;
  status: SubscriptionStatus;
  /** Se puede cancelar la renovación (sigue cobrando y no está ya programada). */
  canCancel: boolean;
  /** El proveedor tiene credenciales en el servidor. */
  providerConfigured: boolean;
  /** Fecha ya formateada hasta la que se conserva Premium (null si no hay acceso). */
  accessUntil: string | null;
  /** Mercado Pago: enlace a su panel de suscripciones (no necesita sesión del servidor). */
  manageHref: string | null;
  supportEmail: string | null;
};

async function postJson<T>(url: string): Promise<{ ok: true; data: T } | { ok: false; error: ApiError }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const body = (await res.json().catch(() => null)) as (T & { error?: ApiError }) | null;
    if (res.ok && body) return { ok: true, data: body };
    return { ok: false, error: body?.error ?? { code: "UNKNOWN", message: "No pudimos completar la acción. Inténtalo de nuevo." } };
  } catch {
    return { ok: false, error: { code: "NETWORK", message: "No pudimos conectar con el servidor. Revisa tu conexión." } };
  }
}

/** Cancelar la renovación (con confirmación) y gestionar el medio de pago en el proveedor. */
export function SubscriptionActions(props: SubscriptionActionsProps) {
  const { provider, status, canCancel, providerConfigured, accessUntil, manageHref, supportEmail } = props;
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [canceling, setCanceling] = React.useState(false);
  const [cancelError, setCancelError] = React.useState<ApiError | null>(null);
  const [opening, setOpening] = React.useState(false);
  const [manageError, setManageError] = React.useState<ApiError | null>(null);

  const providerName = PROVIDER_LABELS[provider].secure;

  const consequence =
    status === "past_due"
      ? "La suscripción se cancelará ahora y no se intentará cobrar de nuevo."
      : status === "trialing"
        ? `Tu prueba sigue hasta el ${accessUntil ?? "final del periodo"} y no se te cobrará nada.`
        : provider === "mercadopago"
          ? `Mercado Pago detendrá los cobros desde ahora. Mantienes Premium hasta el ${accessUntil ?? "final del periodo que ya pagaste"}.`
          : `Seguirás con Premium hasta el ${accessUntil ?? "final del periodo que ya pagaste"}. No se harán más cobros.`;

  async function onCancel() {
    setCanceling(true);
    setCancelError(null);
    const result = await postJson<{ subscription: unknown }>("/api/billing/cancel");
    setCanceling(false);
    if (!result.ok) {
      setCancelError(result.error);
      return;
    }
    setOpen(false);
    toast.success("Listo: tu suscripción no se renovará.");
    router.refresh();
  }

  async function onManage() {
    setOpening(true);
    setManageError(null);
    const result = await postJson<{ url: string }>("/api/billing/portal");
    if (result.ok && result.data.url) {
      window.location.assign(result.data.url);
      return;
    }
    setOpening(false);
    setManageError(result.ok ? { code: "UNKNOWN", message: "No recibimos el enlace de gestión." } : result.error);
  }

  const notConfiguredNote = (
    <p className="text-sm text-muted-foreground">
      Los pagos con {providerName} están pendientes de configurar en el servidor, así que por ahora no podemos hacer cambios desde la
      app.{supportEmail ? ` Escríbenos a ${supportEmail} y lo hacemos por ti.` : ""}
    </p>
  );

  return (
    <div className="grid gap-3">
      {provider === "stripe" ? (
        <Button variant="outline" size="lg" onClick={onManage} loading={opening} disabled={!providerConfigured}>
          <ExternalLink aria-hidden="true" />
          Gestionar pago en Stripe
        </Button>
      ) : manageHref ? (
        <Button asChild variant="outline" size="lg">
          <a href={manageHref} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" />
            Ver mi suscripción en Mercado Pago
            <span className="sr-only">(se abre en otra pestaña)</span>
          </a>
        </Button>
      ) : null}
      {manageError ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>No pudimos abrir la gestión de pagos</AlertTitle>
          <AlertDescription>
            <p>{manageError.message}</p>
          </AlertDescription>
        </Alert>
      ) : null}

      {canCancel ? (
        <Dialog
          open={open}
          onOpenChange={(o) => {
            if (canceling) return;
            setOpen(o);
            if (!o) setCancelError(null);
          }}
        >
          <DialogTrigger asChild>
            <Button variant="ghost" size="lg" disabled={!providerConfigured}>
              Cancelar renovación
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Cancelar la renovación?</DialogTitle>
              <DialogDescription>{consequence}</DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Tus registros, metas y recetas se quedan contigo en el plan gratis. Puedes volver a Premium cuando quieras.
            </p>
            {cancelError ? (
              <Alert variant="destructive">
                <TriangleAlert aria-hidden="true" />
                <AlertTitle>No se canceló</AlertTitle>
                <AlertDescription>
                  <p>{cancelError.message}</p>
                </AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={canceling}>
                Mantener Premium
              </Button>
              <Button type="button" variant="destructive" onClick={onCancel} loading={canceling}>
                Sí, cancelar renovación
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {!providerConfigured && (canCancel || provider === "stripe") ? notConfiguredNote : null}
    </div>
  );
}
