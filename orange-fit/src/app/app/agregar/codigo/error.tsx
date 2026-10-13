"use client";

import Link from "next/link";
import { AppHeader } from "@/components/app/app-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Error al cargar el escáner: se dice qué pasó y se ofrece reintentar o buscar por nombre. */
export default function BarcodeError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <>
      <AppHeader title="Código de barras" backHref="/app/agregar" />
      <div className="grid gap-4 pt-4">
        <Alert variant="destructive">
          <AlertTitle>No pudimos abrir el escáner</AlertTitle>
          <AlertDescription>
            <p>Puede ser un problema de conexión o del servidor. No se registró nada.</p>
          </AlertDescription>
        </Alert>
        <Button onClick={() => retry()} size="lg">
          Reintentar
        </Button>
        <Button asChild variant="outline">
          <Link href="/app/agregar/buscar">Buscar el alimento por nombre</Link>
        </Button>
      </div>
    </>
  );
}
