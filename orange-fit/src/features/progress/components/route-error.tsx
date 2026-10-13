"use client";

import { AppHeader } from "@/components/app/app-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Error al cargar una pantalla de seguimiento: lo decimos y ofrecemos reintentar. */
export function RouteError({ title, backHref, retry }: { title: string; backHref?: string; retry: () => void }) {
  return (
    <>
      <AppHeader title={title} backHref={backHref} />
      <div className="grid gap-4 pt-4">
        <Alert variant="destructive">
          <AlertTitle>No pudimos cargar esta pantalla</AlertTitle>
          <AlertDescription>
            <p>Puede ser un problema de conexión o del servidor. Tus registros no se perdieron.</p>
          </AlertDescription>
        </Alert>
        <Button onClick={() => retry()} size="lg">
          Reintentar
        </Button>
      </div>
    </>
  );
}
