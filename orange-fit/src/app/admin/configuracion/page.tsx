import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { DEFAULT_APP_NAME } from "@/lib/env";
import { integrationStatus } from "@/lib/server-env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/features/admin/components/admin-ui";
import { SettingsForm } from "@/features/admin/components/settings-form";
import { readSettings } from "@/features/admin/server/settings";

export const metadata: Metadata = { title: "Configuración" };

export default async function AdminSettingsPage() {
  await requireRole("admin");
  const supabase = await createSupabaseServerClient();
  const settings = await readSettings(supabase, DEFAULT_APP_NAME);
  const status = integrationStatus();
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Administración"
        title="Configuración"
        description={settings.updatedAt ? `Última modificación: ${formatDateTime(settings.updatedAt)}.` : "Ajustes globales de la app."}
      />
      <SettingsForm
        initial={{
          appName: settings.appName,
          supportEmail: settings.supportEmail ?? "",
          defaultTrialDays: settings.defaultTrialDays,
          maintenanceBanner: settings.maintenanceBanner ?? "",
          featureFlags: settings.featureFlags,
        }}
        paymentsConfigured={{ stripe: status.stripe, mercadopago: status.mercadopago }}
      />
    </div>
  );
}
