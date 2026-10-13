import type { Metadata } from "next";
import Link from "next/link";
import { Camera, CircleCheck } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { Button } from "@/components/ui/button";
import { getProfile, requireUser } from "@/lib/auth/session";
import { getAppSettings } from "@/lib/config/app-settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ConfirmingPayment } from "@/features/billing/components/confirming-payment";
import { formatBillingDate } from "@/features/billing/labels";
import { getBillingOverview } from "@/features/billing/queries";
import { confirmBodySchema } from "@/features/billing/schemas";

export const metadata: Metadata = { title: "Confirmación de pago" };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

/**
 * Vuelta desde el proveedor. Muestra el estado REAL de la suscripción: si el webhook aún no llegó,
 * "estamos confirmando tu pago" (con consulta automática); nunca "listo" sin dato.
 */
export default async function PremiumThanksPage({ searchParams }: PageProps) {
  const user = await requireUser("/app/premium/gracias");
  const sp = await searchParams;
  // Solo referencias con forma válida viajan al cliente.
  const refs = confirmBodySchema.safeParse({
    sessionId: one(sp.session_id) ?? undefined,
    preapprovalId: one(sp.preapproval_id) ?? undefined,
  });
  const sessionId = refs.success ? (refs.data.sessionId ?? null) : null;
  const preapprovalId = refs.success ? (refs.data.preapprovalId ?? null) : null;

  const supabase = await createSupabaseServerClient();
  const [overview, profile, settings] = await Promise.all([
    getBillingOverview(supabase, user.id, { paymentsLimit: 1 }),
    getProfile(),
    getAppSettings(),
  ]);
  const tz = profile?.timezone ?? "America/Lima";
  const view = overview.view;

  return (
    <>
      <AppHeader title="Premium" backHref="/app/perfil" backLabel="Volver a Perfil" />
      <div className="mx-auto grid w-full max-w-lg gap-6 pb-8 pt-4">
        {view?.hasAccess ? (
          <>
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
              <CircleCheck className="size-12 text-success" aria-hidden="true" />
              <h2 className="text-xl font-semibold tracking-tight">Listo, ya tienes Premium</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                {view.trialEndsAt && view.nextChargeAt
                  ? `Tu prueba gratis va hasta el ${formatBillingDate(view.trialEndsAt, tz)}. El primer cobro será ese día, salvo que canceles antes.`
                  : view.nextChargeAt
                    ? `Tu próximo cobro será el ${formatBillingDate(view.nextChargeAt, tz)}.`
                    : view.accessEndsAt
                      ? `Tienes Premium hasta el ${formatBillingDate(view.accessEndsAt, tz)}.`
                      : "Tu suscripción está activa."}
              </p>
            </div>
            <div className="grid gap-3">
              <Button asChild size="lg">
                <Link href="/app/agregar/foto">
                  <Camera aria-hidden="true" />
                  Probar el registro con foto
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/app/perfil/suscripcion">Ver mi suscripción</Link>
              </Button>
            </div>
          </>
        ) : (
          <ConfirmingPayment sessionId={sessionId} preapprovalId={preapprovalId} supportEmail={settings.supportEmail} />
        )}
      </div>
    </>
  );
}
