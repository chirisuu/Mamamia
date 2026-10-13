"use client";

import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Error al cargar una sección del panel: lo decimos, sin detalles internos, y ofrecemos reintentar. */
export function AdminErrorView({ retry, digest }: { retry: () => void; digest?: string }) {
  return (
    <div className="grid max-w-xl gap-4">
      <Alert variant="destructive">
        <AlertTitle>No pudimos cargar esta sección</AlertTitle>
        <AlertDescription>
          <p>Puede ser un problema de conexión o de la base de datos. No se guardó ningún cambio a medias.</p>
          {digest ? <p className="font-mono text-xs">Referencia: {digest}</p> : null}
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => retry()}>Reintentar</Button>
        <Button asChild variant="outline">
          <Link href="/admin">Volver al dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
