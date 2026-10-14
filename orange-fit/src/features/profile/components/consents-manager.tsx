"use client";

import * as React from "react";
import { unstable_rethrow } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { CONSENT_INFO, CONSENT_ORDER, type ConsentType } from "@/features/auth/consents";
import { revokeHealthConsent, setConsent } from "../actions";
import { formatInstantDate } from "@/lib/format";

export type ConsentStatus = { granted: boolean; at: string | null; version: string | null };

function formatDate(iso: string | null): string {
  return iso ? formatInstantDate(iso) : "";
}

function statusText(s: ConsentStatus | undefined): string {
  if (!s) return "Sin respuesta";
  if (s.granted) return `Otorgado el ${formatDate(s.at)}`;
  return s.at ? `No otorgado · ${formatDate(s.at)}` : "No otorgado";
}

/** Estado de cada consentimiento con su acción (otorgar/retirar) según el tipo. */
export function ConsentsManager({ status }: { status: Partial<Record<ConsentType, ConsentStatus>> }) {
  const [pendingType, setPendingType] = React.useState<ConsentType | null>(null);
  const [, startTransition] = React.useTransition();

  function toggle(type: "ai_processing" | "progress_photos" | "marketing", granted: boolean) {
    setPendingType(type);
    startTransition(async () => {
      const result = await setConsent({ type, granted });
      setPendingType(null);
      if (result.ok) toast.success(granted ? "Permiso otorgado." : "Permiso retirado.");
      else toast.error(result.error.message);
    });
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {CONSENT_ORDER.map((type) => {
        const info = CONSENT_INFO[type];
        const s = status[type];
        const granted = Boolean(s?.granted);
        const switchId = `consent-${type}`;
        return (
          <li key={type} className="grid gap-2 px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="grid min-w-0 gap-1">
                <label htmlFor={info.revocable === "yes" ? switchId : undefined} className="font-medium">
                  {info.title}
                </label>
                <p className="text-sm text-muted-foreground">{info.description}</p>
                <p className="text-xs text-muted-foreground">
                  {statusText(s)}
                  {s?.version ? ` · versión ${s.version}` : ""}
                </p>
              </div>
              {info.revocable === "yes" ? (
                <Switch
                  id={switchId}
                  checked={granted}
                  disabled={pendingType === type}
                  onCheckedChange={(v) => toggle(type as "ai_processing" | "progress_photos" | "marketing", v)}
                />
              ) : info.revocable === "account" ? (
                <Badge variant={granted ? "secondary" : "outline"}>{granted ? "Aceptado" : "Pendiente"}</Badge>
              ) : null}
            </div>
            {info.revocable === "account" ? (
              <p className="text-xs text-muted-foreground">Para retirarlo, elimina tu cuenta (más abajo).</p>
            ) : null}
            {info.revocable === "pauses_app" ? (granted ? <RevokeHealthDialog /> : null) : null}
          </li>
        );
      })}
    </ul>
  );
}

function RevokeHealthDialog() {
  const [pending, startTransition] = React.useTransition();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="justify-self-start">
          Retirar este permiso
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Retirar el permiso de datos de salud?</DialogTitle>
          <DialogDescription>
            Sin este permiso no podemos calcular tus metas ni guardar tus registros, así que tu acceso a la app quedará en pausa
            hasta que vuelvas a autorizarlo. Tus datos no se borran: si quieres borrarlos, elimina tu cuenta.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button
            variant="destructive"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  const result = await revokeHealthConsent();
                  if (result && !result.ok) toast.error(result.error.message);
                } catch (error) {
                  unstable_rethrow(error);
                  toast.error("No pudimos conectar con el servidor.");
                }
              })
            }
          >
            Retirar y pausar mi acceso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
