import { apiError, apiOk, hasBearerSecret } from "@/features/notifications/server/http";
import { sendDuePushNotifications, PushDeliveryError } from "@/lib/notifications/notify";
import { createDueReminders, ReminderRunError } from "@/lib/notifications/scheduler";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/server-env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/reminders — protegido con `Authorization: Bearer CRON_SECRET`.
 * 1) Crea los recordatorios que tocan según `profiles.notification_prefs` (hora local de cada uno).
 * 2) Envía por Web Push lo pendiente (si VAPID está configurado; si no, quedan dentro de la app).
 * Pensado para correr cada 15–60 min (p. ej. Vercel Cron o un cron externo).
 */
export async function GET(request: Request) {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) return apiError(503, "NOT_CONFIGURED", "Los recordatorios programados están pendientes de configurar (falta CRON_SECRET).");
  if (!hasBearerSecret(request, secret)) return apiError(401, "UNAUTHORIZED", "No autorizado.");

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return apiError(503, "NOT_CONFIGURED", "Falta SUPABASE_SERVICE_ROLE_KEY para ejecutar los recordatorios.");
  }

  const now = new Date();
  try {
    const reminders = await createDueReminders(admin, now);
    const push = await sendDuePushNotifications(admin, { now });
    return apiOk({ ok: true, ranAt: now.toISOString(), reminders, push });
  } catch (error) {
    const code = error instanceof ReminderRunError || error instanceof PushDeliveryError ? error.code : "CRON_FAILED";
    console.error("[cron/reminders] failed", { code });
    return apiError(500, code, "No se pudieron procesar los recordatorios.");
  }
}
