import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/database.types";
import { mergeNotificationPrefs, parseNotificationPrefs, type NotificationPrefs } from "@/lib/notifications/prefs";
import type { PrefsPatch } from "../schemas";

type Client = SupabaseClient<Database>;

export class NotificationOpError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "DB_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "NotificationOpError";
  }
}

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  createdAt: string;
  readAt: string | null;
};

/** Notificaciones visibles (ya vencidas), más recientes primero. */
export async function listNotifications(
  supabase: Client,
  userId: string,
  options: { now?: Date; limit?: number } = {},
): Promise<{ items: NotificationItem[]; unreadCount: number }> {
  const nowIso = (options.now ?? new Date()).toISOString();
  const visible = `scheduled_for.is.null,scheduled_for.lte.${nowIso}`;
  const [list, unread] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, type, title, body, url, created_at, read_at")
      .eq("user_id", userId)
      .or(visible)
      .order("created_at", { ascending: false })
      .limit(options.limit ?? 100),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null)
      .or(visible),
  ]);
  if (list.error || unread.error) throw new NotificationOpError("DB_ERROR", "No pudimos cargar tus notificaciones.");
  return {
    items: (list.data ?? []).map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      url: n.url,
      createdAt: n.created_at,
      readAt: n.read_at,
    })),
    unreadCount: unread.count ?? 0,
  };
}

export async function markNotificationRead(supabase: Client, userId: string, id: string): Promise<void> {
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id)
    .is("read_at", null)
    .select("id");
  if (error) throw new NotificationOpError("DB_ERROR", "No se pudo marcar como leída.");
  if (!data?.length) {
    // ¿Ya estaba leída o no existe?
    const { data: exists } = await supabase.from("notifications").select("id").eq("user_id", userId).eq("id", id).maybeSingle();
    if (!exists) throw new NotificationOpError("NOT_FOUND", "Esa notificación ya no existe.");
  }
}

export async function markAllNotificationsRead(supabase: Client, userId: string, now: Date = new Date()): Promise<number> {
  const { data, error } = await supabase
    .from("notifications")
    .update({ read_at: now.toISOString() })
    .eq("user_id", userId)
    .is("read_at", null)
    .or(`scheduled_for.is.null,scheduled_for.lte.${now.toISOString()}`)
    .select("id");
  if (error) throw new NotificationOpError("DB_ERROR", "No se pudieron marcar como leídas.");
  return data?.length ?? 0;
}

export async function getNotificationPrefs(supabase: Client, userId: string): Promise<NotificationPrefs> {
  const { data, error } = await supabase.from("profiles").select("notification_prefs").eq("id", userId).maybeSingle();
  if (error || !data) throw new NotificationOpError("DB_ERROR", "No pudimos leer tus preferencias.");
  return parseNotificationPrefs(data.notification_prefs);
}

/** Guarda una sección de preferencias sin tocar las demás. */
export async function updateNotificationPrefs(supabase: Client, userId: string, patch: PrefsPatch): Promise<NotificationPrefs> {
  const { data, error } = await supabase.from("profiles").select("notification_prefs").eq("id", userId).maybeSingle();
  if (error || !data) throw new NotificationOpError("DB_ERROR", "No pudimos leer tus preferencias.");
  const next = mergeNotificationPrefs(data.notification_prefs, { [patch.section]: patch.value });
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ notification_prefs: next as unknown as NonNullable<Json> })
    .eq("id", userId);
  if (updateError) throw new NotificationOpError("DB_ERROR", "No se pudieron guardar tus preferencias.");
  return next;
}

export async function countPushSubscriptions(supabase: Client, userId: string): Promise<number | null> {
  const { count, error } = await supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", userId);
  return error ? null : (count ?? 0);
}
