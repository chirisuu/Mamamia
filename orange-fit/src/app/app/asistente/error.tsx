"use client";

import Link from "next/link";
import { AppHeader } from "@/components/app/app-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useReportError } from "@/features/marketing/use-report-error";

/** Error al cargar el asistente: se dice qué pasó y se ofrece reintentar. */
export default function AssistantError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useReportError(error);
  return (
    <>
      <AppHeader title="Asistente" />
      <div className="grid gap-4 pt-4">
        <Alert variant="destructive">
          <AlertTitle>No pudimos abrir el asistente</AlertTitle>
          <AlertDescription>
            <p>Puede ser un problema de conexión o del servidor. Tus conversaciones siguen guardadas.</p>
          </AlertDescription>
        </Alert>
        <Button onClick={() => retry()} size="lg">
          Reintentar
        </Button>
        <Button asChild variant="outline">
          <Link href="/app">Volver al inicio</Link>
        </Button>
      </div>
    </>
  );
}
