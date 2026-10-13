import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/db/database.types";
import { buildPushPayload, sendPush, vapidConfig, type PushTarget, type VapidConfig } from "./push";

/**
 * CONTRATO 5 (dueño: seguimiento).
 *
 * - `createNotification(supabase, userId, { type, title, body, url?, scheduledFor? })` crea una
 *   notificación dentro de la app (tabla `notifications`). Con el cliente del usuario solo puede
 *   notificarse a sí mismo (RLS); con el service role, a cualquiera. NUNCA lanza: devuelve
 *   `{ ok: true, id }` o `{ ok: false, code, message }`, para que un aviso que falla no rompa el flujo
 *   que lo origina (p. ej. un webhook de pago). `url` debe ser una ruta interna ("/app/...").
 * - `sendDuePushNotifications(admin)` envía por Web Push las notificaciones pendientes (sin
 *   `sent_at`, ya vencidas y de las últimas 24 h) a las suscripciones de cada usuario y marca
 *   `sent_at`. Sin VAPID configurado no envía nada y lo informa (`configured: false`).
 */
type Client = SupabaseClient<Database>;

export type NotificationInput = {
  type: string;
  title: string;
  body: string | null;
  /** Ruta interna a la que lleva la notificación. */
  url?: string | null;
  /** Desde cuándo se muestra/envía (por defecto, ya). */
  scheduledFor?: Date | string | null;
};

export type CreateNotificationResult = { ok: true; id: string } | { ok: false; code: string; message: string };

const internalUrl = z
  .string()
  .max(500)
  .refine((v) => v.startsWith("/") && !v.startsWith("//"), "La URL debe ser una ruta interna.");

const notificationInputSchema = z.object({
  type: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_.:-]+$/, "El tipo solo admite minúsculas, números y _ . : -"),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(2000).nullable(),
  url: internalUrl.nullish(),
  scheduledFor: z.union([z.date(), z.iso.datetime({ offset: true })]).nullish(),
});

export async function createNotification(
  supabase: Client,
  userId: string,
  input: NotificationInput,
): Promise<CreateNotificationResult> {
  const parsed = notificationInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "VALIDATION", message: parsed.error.issues[0]?.message ?? "Notificación inválida." };
  }
  if (!z.uuid().safeParse(userId).success) return { ok: false, code: "VALIDATION", message: "Usuario inválido." };
  const v = parsed.data;
  const scheduled = v.scheduledFor instanceof Date ? v.scheduledFor.toISOString() : (v.scheduledFor ?? null);
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id: userId,
      type: v.type,
      title: v.title,
      body: v.body || null,
      url: v.url ?? null,
      scheduled_for: scheduled,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[notifications] create failed", { code: error?.code });
    return { ok: false, code: "DB_ERROR", message: "No se pudo crear la notificación." };
  }
  return { ok: true, id: data.id };
}

export type PushDeliverySummary = {
  configured: boolean;
  /** Notificaciones pendientes de usuarios con al menos una suscripción. */
  candidates: number;
  sent: number;
  failed: number;
  removedSubscriptions: number;
};

export class PushDeliveryError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PushDeliveryError";
  }
}

type SubscriptionRow = PushTarget & { user_id: string };
type PendingRow = { id: string; user_id: string; title: string; body: string | null; url: string | null };

const PAGE = 1000;
const USER_CHUNK = 100;
const PARALLEL = 8;

async function loadSubscriptions(client: Client, userId?: string): Promise<Map<string, SubscriptionRow[]>> {
  const byUser = new Map<string, SubscriptionRow[]>();
  for (let from = 0; ; from += PAGE) {
    let query = client.from("push_subscriptions").select("user_id, endpoint, p256dh, auth").order("id").range(from, from + PAGE - 1);
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) throw new PushDeliveryError("DB_ERROR", "No se pudieron leer las suscripciones push.");
    for (const row of data ?? []) {
      const list = byUser.get(row.user_id) ?? [];
      list.push(row);
      byUser.set(row.user_id, list);
    }
    if (!data || data.length < PAGE) break;
  }
  return byUser;
}

async function inBatches<T, R>(items: readonly T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

async function deliverPending(
  client: Client,
  options: { userId?: string; now?: Date; maxAgeHours?: number; limitPerChunk?: number; config: VapidConfig },
): Promise<Omit<PushDeliverySummary, "configured">> {
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const since = new Date(now.getTime() - (options.maxAgeHours ?? 24) * 3_600_000).toISOString();
  const subsByUser = await loadSubscriptions(client, options.userId);
  const userIds = [...subsByUser.keys()];
  const summary = { candidates: 0, sent: 0, failed: 0, removedSubscriptions: 0 };
  const goneEndpoints = new Set<string>();

  for (let i = 0; i < userIds.length; i += USER_CHUNK) {
    const chunk = userIds.slice(i, i + USER_CHUNK);
    const { data, error } = await client
      .from("notifications")
      .select("id, user_id, title, body, url")
      .in("user_id", chunk)
      .is("sent_at", null)
      .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .limit(options.limitPerChunk ?? 500);
    if (error) throw new PushDeliveryError("DB_ERROR", "No se pudieron leer las notificaciones pendientes.");
    const pending: PendingRow[] = data ?? [];
    summary.candidates += pending.length;

    const sentIds: string[] = [];
    await inBatches(pending, PARALLEL, async (n) => {
      const subs = (subsByUser.get(n.user_id) ?? []).filter((s) => !goneEndpoints.has(s.endpoint));
      if (subs.length === 0) return;
      const payload = buildPushPayload(n);
      const results = await Promise.all(subs.map((s) => sendPush(s, payload, options.config)));
      results.forEach((r, idx) => {
        if (!r.ok && r.gone) goneEndpoints.add(subs[idx]!.endpoint);
      });
      if (results.some((r) => r.ok)) {
        sentIds.push(n.id);
        summary.sent++;
      } else {
        summary.failed++;
      }
    });

    if (sentIds.length > 0) {
      const { error: markError } = await client.from("notifications").update({ sent_at: new Date().toISOString() }).in("id", sentIds);
      if (markError) throw new PushDeliveryError("DB_ERROR", "No se pudo marcar el envío de las notificaciones.");
    }
  }

  if (goneEndpoints.size > 0) {
    const { error } = await client.from("push_subscriptions").delete().in("endpoint", [...goneEndpoints]);
    if (!error) summary.removedSubscriptions = goneEndpoints.size;
  }
  return summary;
}

/** Envía por push todo lo pendiente (cron, con service role). */
export async function sendDuePushNotifications(
  admin: Client,
  options: { now?: Date; maxAgeHours?: number } = {},
): Promise<PushDeliverySummary> {
  const config = vapidConfig();
  if (!config) return { configured: false, candidates: 0, sent: 0, failed: 0, removedSubscriptions: 0 };
  return { configured: true, ...(await deliverPending(admin, { ...options, config })) };
}

/** Envía lo pendiente de un solo usuario con su propio cliente (RLS): p. ej. la notificación de prueba. */
export async function sendPendingPushForUser(
  supabase: Client,
  userId: string,
  options: { now?: Date } = {},
): Promise<PushDeliverySummary> {
  const config = vapidConfig();
  if (!config) return { configured: false, candidates: 0, sent: 0, failed: 0, removedSubscriptions: 0 };
  return { configured: true, ...(await deliverPending(supabase, { ...options, userId, maxAgeHours: 1, config })) };
}
