"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const DELETE_CONFIRMATION = "ELIMINAR";

type ApiError = { code: string; message: string };

/**
 * Eliminación definitiva de la cuenta: escribe ELIMINAR y confirma. Llama a POST /api/account/delete
 * (borra archivos, la cuenta y todos sus datos) y lleva a la portada con la sesión cerrada.
 */
export function DeleteAccountDialog({ triggerLabel = "Eliminar mi cuenta" }: { triggerLabel?: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<ApiError | null>(null);
  const matches = text.trim() === DELETE_CONFIRMATION;

  async function onConfirm(event: React.FormEvent) {
    event.preventDefault();
    if (!matches) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: DELETE_CONFIRMATION }),
      });
      if (res.ok) {
        // Las cookies de sesión ya vienen borradas; refresh descarta lo que quedaba en caché.
        router.replace("/?cuenta=eliminada");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: ApiError } | null;
      setError(body?.error ?? { code: "UNKNOWN", message: "No pudimos eliminar tu cuenta. Inténtalo de nuevo." });
    } catch {
      setError({ code: "NETWORK", message: "No pudimos conectar con el servidor. Revisa tu conexión." });
    }
    setPending(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        setOpen(o);
        if (!o) {
          setText("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive" className="w-full sm:w-auto">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onConfirm} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>¿Eliminar tu cuenta para siempre?</DialogTitle>
            <DialogDescription>
              Borraremos tu perfil, tus metas, tus registros de comidas, agua, peso y actividad, tus fotos, recetas y planes. No se
              puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Si quieres conservar una copia, descarga tus datos antes de continuar.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="delete-confirm">
              Escribe <span className="font-mono font-semibold">{DELETE_CONFIRMATION}</span> para confirmar
            </Label>
            <Input
              id="delete-confirm"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              disabled={pending}
            />
          </div>
          {error ? (
            <Alert variant="destructive">
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>No se eliminó tu cuenta</AlertTitle>
              <AlertDescription>
                <p>{error.message}</p>
                {error.code === "ACTIVE_SUBSCRIPTION" ? (
                  <Link href="/app/perfil/suscripcion" className="font-medium text-primary-strong underline underline-offset-4">
                    Ir a mi suscripción
                  </Link>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" variant="destructive" disabled={!matches} loading={pending}>
              Eliminar definitivamente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
