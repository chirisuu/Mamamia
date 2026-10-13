import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/app/app-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReminderSettings } from "@/features/notifications/components/reminder-settings";
import { getTrackingContext } from "@/features/progress/server/tracking-context";
import { WaterHistory } from "@/features/water/components/water-history";
import { WaterToday } from "@/features/water/components/water-today";
import { getWaterPageData, type WaterPageData } from "@/features/water/server/water";
import { formatLongDate } from "@/lib/format";
import { isPushConfigured } from "@/lib/notifications/push";
import { parseNotificationPrefs } from "@/lib/notifications/prefs";
import { integrationStatus } from "@/lib/server-env";

export const metadata: Metadata = { title: "Agua" };

export default async function WaterPage() {
  const ctx = await getTrackingContext("/app/agua");
  let data: WaterPageData | null = null;
  try {
    data = await getWaterPageData(ctx.supabase, ctx.user.id, ctx.today);
  } catch {
    data = null;
  }
  const prefs = parseNotificationPrefs(ctx.profile?.notification_prefs);
  const kidney = ctx.healthFlags.includes("kidney_disease");

  return (
    <>
      <AppHeader title="Agua" subtitle={formatLongDate(ctx.today)} backHref="/app" backLabel="Volver a Inicio" />
      {!data ? (
        <Alert variant="destructive" className="mt-2">
          <AlertTitle>No pudimos cargar tu registro de agua</AlertTitle>
          <AlertDescription>
            <p>Revisa tu conexión y vuelve a intentarlo.</p>
            <Link href="/app/agua" className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary-strong underline-offset-4 hover:underline">
              Reintentar
            </Link>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-6 pt-2 lg:grid-cols-2 lg:items-start">
          <div className="grid gap-4">
            <WaterToday consumedMl={data.consumedMl} targetMl={data.targetMl} logs={data.todayLogs} timeZone={ctx.timeZone} />
            <p className="text-xs text-muted-foreground">
              Tu meta sale de tus metas diarias (referencia de agua total de EFSA, que incluye el agua de los alimentos). Con
              calor, mucha sudoración o ejercicio largo necesitarás más.
              {kidney ? " Con una enfermedad renal, la cantidad de líquidos la indica tu médico: toma esta meta solo como referencia." : ""}
            </p>
          </div>

          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle as="h2">Historial</CardTitle>
                <CardDescription>Los días sin registro no se cuentan como 0 ml.</CardDescription>
              </CardHeader>
              <CardContent>
                <WaterHistory history={data.history} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle as="h2">Recordatorios de agua</CardTitle>
                <CardDescription>
                  {isPushConfigured()
                    ? "Te llegan como notificación si las activaste en este dispositivo, y siempre quedan en la app."
                    : "Por ahora llegan dentro de la app (las notificaciones push están pendientes de configurar)."}{" "}
                  <Link href="/app/notificaciones" className="font-medium text-primary-strong underline-offset-4 hover:underline">
                    Ver notificaciones
                  </Link>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!integrationStatus().cron ? (
                  <p className="mb-2 text-sm text-muted-foreground">
                    Los recordatorios automáticos aún no están activos en este servidor; tu preferencia se guarda igual.
                  </p>
                ) : null}
                <ReminderSettings prefs={prefs} sections={["water"]} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
