import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/app/app-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NotificationList } from "@/features/notifications/components/notification-list";
import { PushSettings } from "@/features/notifications/components/push-settings";
import { ReminderSettings } from "@/features/notifications/components/reminder-settings";
import { listNotifications, type NotificationItem } from "@/features/notifications/server/ops";
import { getTrackingContext } from "@/features/progress/server/tracking-context";
import { publicEnv } from "@/lib/env";
import { isPushConfigured } from "@/lib/notifications/push";
import { parseNotificationPrefs } from "@/lib/notifications/prefs";
import { integrationStatus } from "@/lib/server-env";

export const metadata: Metadata = { title: "Notificaciones" };

export default async function NotificationsPage() {
  const ctx = await getTrackingContext("/app/notificaciones");
  let data: { items: NotificationItem[]; unreadCount: number } | null = null;
  try {
    data = await listNotifications(ctx.supabase, ctx.user.id, { now: ctx.now });
  } catch {
    data = null;
  }
  const prefs = parseNotificationPrefs(ctx.profile?.notification_prefs);
  const pushConfigured = isPushConfigured();
  const cronConfigured = integrationStatus().cron;

  return (
    <>
      <AppHeader title="Notificaciones" backHref="/app" backLabel="Volver a Inicio" />
      <div className="grid gap-6 pt-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start">
        <section aria-labelledby="lista-titulo" className="grid gap-3">
          <h2 id="lista-titulo" className="sr-only">
            Tus notificaciones
          </h2>
          {data ? (
            <NotificationList items={data.items} unreadCount={data.unreadCount} nowIso={ctx.now.toISOString()} timeZone={ctx.timeZone} />
          ) : (
            <Alert variant="destructive">
              <AlertTitle>No pudimos cargar tus notificaciones</AlertTitle>
              <AlertDescription>Revisa tu conexión y vuelve a intentarlo.</AlertDescription>
            </Alert>
          )}
        </section>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Recordatorios</CardTitle>
              <CardDescription>
                Todos son opcionales. Los recordatorios de agua se configuran en{" "}
                <Link href="/app/agua" className="font-medium text-primary-strong underline-offset-4 hover:underline">
                  Agua
                </Link>
                .
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {!cronConfigured ? (
                <Alert variant="warning">
                  <AlertTitle>Recordatorios automáticos pendientes de configurar</AlertTitle>
                  <AlertDescription>
                    Puedes guardar tus preferencias, pero el servidor aún no tiene activada la tarea que envía los
                    recordatorios programados.
                  </AlertDescription>
                </Alert>
              ) : null}
              <ReminderSettings prefs={prefs} sections={["logging", "weighIn", "fasting"]} hideWeight={ctx.hideWeight} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Avisos en este dispositivo</CardTitle>
              <CardDescription>Notificaciones push aunque no tengas la app abierta.</CardDescription>
            </CardHeader>
            <CardContent>
              <PushSettings configured={pushConfigured} publicKey={publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
