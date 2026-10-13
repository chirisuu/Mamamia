"use server";

import { revalidatePath } from "next/cache";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { createNotification, sendPendingPushForUser } from "@/lib/notifications/notify";
import type { NotificationPrefs } from "@/lib/notifications/prefs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notificationIdSchema, prefsPatchSchema, type PrefsPatch } from "./schemas";
import { markAllNotificationsRead, markNotificationRead, NotificationOpError, updateNotificationPrefs } from "./server/ops";

function toFail(error: unknown): ActionResult<never> {
  if (error instanceof NotificationOpError) return fail(error.code, error.message);
  console.error("[notifications] action failed");
  return fail("UNKNOWN", "Algo salió mal. Inténtalo de nuevo.");
}

export async function markNotificationReadAction(id: string): Promise<ActionResult<null>> {
  const user = await requireUser("/app/notificaciones");
  const parsed = notificationIdSchema.safeParse(id);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    await markNotificationRead(supabase, user.id, parsed.data);
  } catch (error) {
    return toFail(error);
  }
  revalidatePath("/app", "layout");
  return ok(null);
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<{ count: number }>> {
  const user = await requireUser("/app/notificaciones");
  try {
    const supabase = await createSupabaseServerClient();
    const count = await markAllNotificationsRead(supabase, user.id);
    revalidatePath("/app", "layout");
    return ok({ count });
  } catch (error) {
    return toFail(error);
  }
}

export async function updateNotificationPrefsAction(patch: PrefsPatch): Promise<ActionResult<NotificationPrefs>> {
  const user = await requireUser("/app/notificaciones");
  const parsed = prefsPatchSchema.safeParse(patch);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    const prefs = await updateNotificationPrefs(supabase, user.id, parsed.data);
    revalidatePath("/app/notificaciones");
    revalidatePath("/app/agua");
    return ok(prefs);
  } catch (error) {
    return toFail(error);
  }
}

/**
 * Crea una notificación de prueba y la envía por push a los dispositivos del usuario.
 * Si push no está configurado, igual queda dentro de la app y se informa.
 */
export async function sendTestNotificationAction(): Promise<ActionResult<{ pushConfigured: boolean; pushed: number }>> {
  const user = await requireUser("/app/notificaciones");
  const supabase = await createSupabaseServerClient();
  const created = await createNotification(supabase, user.id, {
    type: "test",
    title: "Notificación de prueba",
    body: "Si ves esto, tus avisos funcionan.",
    url: "/app/notificaciones",
  });
  if (!created.ok) return fail(created.code, created.message);
  try {
    const push = await sendPendingPushForUser(supabase, user.id);
    revalidatePath("/app", "layout");
    return ok({ pushConfigured: push.configured, pushed: push.sent });
  } catch {
    revalidatePath("/app", "layout");
    return fail("PUSH_FAILED", "La notificación quedó en la app, pero no se pudo enviar al dispositivo.");
  }
}
