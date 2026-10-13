"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { reportClientError } from "../report-error";

type ErrorScreenProps = {
  error: Error & { digest?: string };
  onRetry: () => void;
  /** global-error no tiene el layout raíz: el título va como <h1> igual, pero sin enlaces de navegación de Next. */
  title?: string;
};

/**
 * Pantalla de error a página completa (error.tsx raíz y global-error.tsx). Mensaje amable, reintentar,
 * ir al inicio y el código del error para soporte. Reporta a /api/errors una vez (sin datos sensibles)
 * y solo dice "avisamos al equipo" si el aviso realmente llegó.
 */
export function ErrorScreen({ error, onRetry, title = "Algo salió mal" }: ErrorScreenProps) {
  const [reported, setReported] = React.useState(false);
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    let active = true;
    void reportClientError(error).then((ok) => {
      if (active && ok) setReported(true);
    });
    return () => {
      active = false;
    };
  }, [error]);

  React.useEffect(() => {
    // Lleva el foco al título para que lectores de pantalla anuncien el cambio.
    headingRef.current?.focus();
  }, []);

  return (
    <main
      id="contenido"
      className="flex min-h-dvh items-center justify-center bg-background px-4 pt-safe-6 pb-safe-6 text-foreground"
    >
      <div className="grid w-full max-w-md justify-items-center gap-5 rounded-3xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
        <LogoMark className="size-12 text-foreground" />
        <div className="grid gap-2">
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">
            {title}
          </h1>
          <p className="leading-relaxed text-muted-foreground">
            Tuvimos un problema al mostrar esta página. No es nada que hayas hecho tú. Puedes intentarlo de nuevo o
            volver al inicio.
          </p>
          <p className="text-sm text-muted-foreground" role="status">
            {reported ? "Enviamos un aviso al equipo para revisarlo." : ""}
          </p>
        </div>
        <div className="grid w-full gap-3">
          <Button size="lg" onClick={() => onRetry()}>
            <RotateCcw aria-hidden="true" />
            Reintentar
          </Button>
          <Button asChild size="lg" variant="outline">
            {/* Enlace normal (recarga completa): después de un error es más seguro que la navegación del cliente. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- recarga completa a propósito */}
            <a href="/">Ir al inicio</a>
          </Button>
        </div>
        {error.digest ? (
          <p className="text-xs text-muted-foreground">
            Código del error: <span className="font-mono">{error.digest}</span>
          </p>
        ) : null}
      </div>
    </main>
  );
}
