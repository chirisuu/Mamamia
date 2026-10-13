"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { grantPhotoConsentAction } from "../photo-actions";

/** Explica para qué son las fotos y pide el permiso expreso antes de permitir subirlas. */
export function PhotoConsent({ description }: { description: string }) {
  const router = useRouter();
  const [checked, setChecked] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const id = React.useId();

  function grant() {
    startTransition(async () => {
      const res = await grantPhotoConsentAction();
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Listo. Ya puedes guardar tus fotos.");
      router.refresh();
    });
  }

  return (
    <section aria-labelledby={`${id}-title`} className="grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary-strong">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </span>
        <div className="grid gap-1">
          <h2 id={`${id}-title`} className="text-base font-semibold">
            Antes de guardar fotos, necesitamos tu permiso
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <ul className="grid gap-2 text-sm">
        <li className="flex gap-2">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          Se guardan en un espacio privado: solo tú puedes verlas, nunca son públicas.
        </li>
        <li className="flex gap-2">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          Antes de subirlas las reducimos y quitamos los datos ocultos de la imagen (como la ubicación).
        </li>
        <li className="flex gap-2">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          Puedes borrar cada foto cuando quieras y retirar este permiso en{" "}
          <Link href="/app/perfil/privacidad" className="font-medium text-primary-strong underline-offset-4 hover:underline">
            Privacidad
          </Link>
          .
        </li>
      </ul>
      <div className="flex items-start gap-3 rounded-xl bg-muted/50 p-4">
        <Checkbox id={`${id}-check`} checked={checked} onCheckedChange={(v) => setChecked(v === true)} className="mt-0.5" />
        <Label htmlFor={`${id}-check`} className="text-sm leading-snug font-normal">
          Autorizo guardar mis fotos de progreso en mi espacio privado para comparar mi avance.
        </Label>
      </div>
      <Button onClick={grant} disabled={!checked} loading={pending}>
        Dar permiso y continuar
      </Button>
    </section>
  );
}
