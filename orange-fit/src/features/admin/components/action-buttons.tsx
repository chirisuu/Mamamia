"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import type { ActionResult } from "@/lib/action-result";

type RunnableAction = () => Promise<ActionResult<unknown>>;

/** Ejecuta una Server Action (ya enlazada con sus argumentos) y avisa el resultado con un toast. */
function useRunAction(action: RunnableAction, successMessage: string, onDone?: () => void) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const run = React.useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        startTransition(async () => {
          try {
            const result = await action();
            if (result.ok) {
              toast.success(successMessage);
              onDone?.();
              router.refresh();
              resolve(true);
            } else {
              toast.error(result.error.message);
              resolve(false);
            }
          } catch {
            toast.error("No se pudo completar. Revisa tu conexión e inténtalo de nuevo.");
            resolve(false);
          }
        });
      }),
    [action, successMessage, onDone, router],
  );
  return { run, pending };
}

type ActionButtonProps = Omit<ButtonProps, "onClick" | "loading"> & {
  action: RunnableAction;
  successMessage: string;
};

/** Botón de acción directa (sin confirmación), para cambios reversibles. */
export function ActionButton({ action, successMessage, children, ...props }: ActionButtonProps) {
  const { run, pending } = useRunAction(action, successMessage);
  return (
    <Button type="button" {...props} loading={pending} onClick={() => void run()}>
      {children}
    </Button>
  );
}

type ConfirmActionButtonProps = Omit<ButtonProps, "onClick" | "loading"> & {
  action: RunnableAction;
  successMessage: string;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
};

/** Botón que pide confirmación en un diálogo antes de ejecutar (borrar, fusionar, roles…). */
export function ConfirmActionButton({
  action,
  successMessage,
  title,
  description,
  confirmLabel,
  destructive = false,
  children,
  ...props
}: ConfirmActionButtonProps) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const { run, pending } = useRunAction(action, successMessage, close);
  return (
    <>
      <Button type="button" {...props} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription asChild>
              <div className="grid gap-2">{description}</div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="button" variant={destructive ? "destructive" : "default"} loading={pending} onClick={() => void run()}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
