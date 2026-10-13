"use client";

import { AppHeader } from "@/components/app/app-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useReportError } from "@/features/marketing/use-report-error";

/** Error al cargar Premium o la confirmación del pago: lo decimos y ofrecemos reintentar. */
export default function PremiumError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useReportError(error);
  return (
    <>
      <AppHeader title="Premium" backHref="/app/perfil" backLabel="Volver a Perfil" />
      <div className="grid gap-4 pt-4">
        <Alert variant="destructive">
          <AlertTitle>No pudimos cargar esta sección</AlertTitle>
          <AlertDescription>
            <p>Puede ser un problema de conexión o del servidor. Si acabas de pagar, tu pago no se pierde: lo verás en Suscripción.</p>
          </AlertDescription>
        </Alert>
        <Button onClick={() => retry()} size="lg">
          Reintentar
        </Button>
      </div>
    </>
  );
}
