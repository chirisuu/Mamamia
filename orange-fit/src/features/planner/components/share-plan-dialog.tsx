"use client";

import * as React from "react";
import { Copy, Link2Off, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { revokeShareAction, sharePlanAction } from "../actions";

export function sharedPlanUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/compartido/plan/${token}`;
}

/**
 * Compartir el plan con consentimiento explícito. El enlace muestra solo las comidas (sin nombre,
 * correo ni metas). Se puede desactivar cuando se quiera.
 */
export function SharePlanDialog({ planId, initialToken }: { planId: string; initialToken: string | null }) {
  const [open, setOpen] = React.useState(false);
  const [token, setToken] = React.useState(initialToken);
  const [consent, setConsent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [origin, setOrigin] = React.useState("");
  const consentId = React.useId();

  const openDialog = () => {
    setOrigin(window.location.origin);
    setConsent(false);
    setError(null);
    setOpen(true);
  };
  const url = token && origin ? sharedPlanUrl(origin, token) : "";

  return (
    <>
      <Button type="button" variant="outline" onClick={openDialog}>
        <Share2 aria-hidden="true" />
        {token ? "Enlace público" : "Compartir"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartir plan</DialogTitle>
            <DialogDescription>
              Quien tenga el enlace verá las comidas, porciones y calorías del plan. No verá tu nombre, tu correo, tu peso ni tus metas.
            </DialogDescription>
          </DialogHeader>
          {token ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="share-url">Enlace</Label>
                <Input id="share-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  loading={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await revokeShareAction({ planId });
                      if (!res.ok) {
                        setError(res.error.message);
                        return;
                      }
                      setToken(null);
                      toast.success("Enlace desactivado: ya nadie puede abrirlo");
                    })
                  }
                >
                  <Link2Off aria-hidden="true" />
                  Desactivar enlace
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    try {
                      if (navigator.share) {
                        await navigator.share({ title: "Plan de comidas", url });
                        return;
                      }
                      await navigator.clipboard.writeText(url);
                      toast.success("Enlace copiado");
                    } catch (e) {
                      if ((e as Error).name !== "AbortError") toast.error("No se pudo copiar. Selecciona el enlace y cópialo.");
                    }
                  }}
                >
                  <Copy aria-hidden="true" />
                  Compartir enlace
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!consent) {
                  setError("Marca la casilla para confirmar.");
                  return;
                }
                startTransition(async () => {
                  const res = await sharePlanAction({ planId, consent: true });
                  if (!res.ok) {
                    setError(res.error.message);
                    return;
                  }
                  setError(null);
                  setToken(res.data.token);
                  toast.success("Enlace creado");
                });
              }}
            >
              <div className="flex items-start gap-3">
                <Checkbox id={consentId} checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
                <Label htmlFor={consentId} className="font-normal">
                  Entiendo que cualquier persona con el enlace podrá ver las comidas de este plan, y que puedo desactivarlo cuando quiera.
                </Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" loading={pending} disabled={!consent}>
                  Crear enlace
                </Button>
              </DialogFooter>
            </form>
          )}
          {error ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
