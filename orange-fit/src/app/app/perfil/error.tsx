"use client";

import { AppHeader } from "@/components/app/app-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Error al cargar una pantalla del perfil: lo decimos y ofrecemos reintentar. */
export default function ProfileError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <>
      <AppHeader title="Perfil" backHref="/app/perfil" />
      <div className="grid gap-4 pt-4">
        <Alert variant="destructive">
          <AlertTitle>No pudimos cargar esta sección</AlertTitle>
          <AlertDescription>
            <p>Puede ser un problema de conexión o del servidor. Tus datos no se perdieron.</p>
          </AlertDescription>
        </Alert>
        <Button onClick={() => retry()} size="lg">
          Reintentar
        </Button>
      </div>
    </>
  );
}
