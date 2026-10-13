"use client";

import { AppHeader } from "@/components/app/app-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Error al cargar la lista: lo decimos y ofrecemos reintentar. */
export default function ShoppingError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <>
      <AppHeader title="Lista de compras" backHref="/app/compras" />
      <div className="grid gap-4 pt-4">
        <Alert variant="destructive">
          <AlertTitle>No pudimos cargar esta pantalla</AlertTitle>
          <AlertDescription>
            <p>Puede ser un problema de conexión o del servidor. Tus listas no se perdieron.</p>
          </AlertDescription>
        </Alert>
        <Button onClick={() => retry()} size="lg">
          Reintentar
        </Button>
      </div>
    </>
  );
}
