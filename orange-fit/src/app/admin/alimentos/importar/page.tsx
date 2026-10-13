import type { Metadata } from "next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { integrationStatus } from "@/lib/server-env";
import { FoodsNav } from "@/features/admin/components/foods-nav";
import { UsdaImportForm } from "@/features/admin/components/usda-import-form";

export const metadata: Metadata = { title: "Importar desde USDA" };

export default async function UsdaImportPage() {
  await requireRole("editor");
  const status = integrationStatus();
  const missing = [!status.usda ? "FDC_API_KEY" : null, !status.supabaseAdmin ? "SUPABASE_SERVICE_ROLE_KEY" : null].filter(Boolean);
  const disabledReason = missing.length ? `Pendiente de configurar: falta ${missing.join(" y ")} en el servidor.` : null;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Alimentos"
        title="Importar desde USDA"
        description="Trae alimentos de USDA FoodData Central (dominio público) al catálogo, ya verificados y con su FDC ID como referencia. Si ya existían, se actualizan."
      />
      <FoodsNav current="/admin/alimentos/importar" />
      {disabledReason ? (
        <Alert variant="warning">
          <AlertTitle>Importación pendiente de configurar</AlertTitle>
          <AlertDescription>
            <p>{disabledReason}</p>
            <p>La clave de USDA es gratuita en api.data.gov. Mientras falte, no se importa nada.</p>
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle as="h2">Nueva importación</CardTitle>
          <CardDescription>Los nombres llegan en inglés: puedes traducirlos después desde el editor del alimento.</CardDescription>
        </CardHeader>
        <CardContent>
          <UsdaImportForm disabledReason={disabledReason} />
        </CardContent>
      </Card>
    </div>
  );
}
