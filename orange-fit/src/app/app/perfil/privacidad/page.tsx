import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/app/app-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LEGAL_LINKS } from "@/features/auth/consents";
import { ConsentsManager, type ConsentStatus } from "@/features/profile/components/consents-manager";
import { DeleteAccountDialog } from "@/features/profile/components/delete-account-dialog";
import { ExportDataButton } from "@/features/profile/components/export-data-button";
import { getConsentState } from "@/features/profile/queries";

export const metadata: Metadata = { title: "Privacidad y datos" };

export default async function PrivacyPage() {
  const user = await requireUser("/app/perfil/privacidad");
  const supabase = await createSupabaseServerClient();
  const latest = await getConsentState(supabase, user.id);
  const status: Partial<Record<keyof typeof latest, ConsentStatus>> = {};
  for (const [type, row] of Object.entries(latest)) {
    if (!row) continue;
    status[type as keyof typeof latest] = {
      granted: row.granted && !row.revoked_at,
      at: row.revoked_at ?? row.granted_at,
      version: row.version,
    };
  }

  return (
    <>
      <AppHeader title="Privacidad y datos" backHref="/app/perfil" backLabel="Volver a Perfil" />
      <div className="grid gap-8 pb-10 pt-2">
        <section aria-labelledby="consents-title" className="grid gap-3">
          <div className="grid gap-1">
            <h2 id="consents-title" className="text-lg font-semibold tracking-tight">
              Tus permisos
            </h2>
            <p className="text-sm text-muted-foreground">
              Guardamos el historial de cada decisión. Lee los{" "}
              <Link href={LEGAL_LINKS.terms} className="font-medium text-primary-strong underline underline-offset-4">
                términos
              </Link>{" "}
              y la{" "}
              <Link href={LEGAL_LINKS.privacy} className="font-medium text-primary-strong underline underline-offset-4">
                política de privacidad
              </Link>
              .
            </p>
          </div>
          <ConsentsManager status={status} />
        </section>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Descarga tus datos</CardTitle>
            <CardDescription>
              Un archivo JSON con todo lo que guardamos de ti: perfil, metas, registros, planes, fotos (enlaces de 1 hora) y más.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExportDataButton />
          </CardContent>
        </Card>

        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle as="h2">Eliminar tu cuenta</CardTitle>
            <CardDescription>
              Borra tu cuenta, tus datos y tus archivos de forma definitiva. Si tienes una suscripción activa, cancélala primero.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteAccountDialog />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
