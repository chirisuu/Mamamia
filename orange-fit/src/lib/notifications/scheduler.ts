import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { DEFAULT_TIMEZONE } from "@/lib/dates";
import { hasScheduledReminders, parseNotificationPrefs, type NotificationPrefs } from "./prefs";
import {
  dueReminders,
  fastingReminderUrl,
  localClock,
  REMINDER_TYPES,
  type LocalClock,
  type RecentReminder,
  type ReminderDraft,
} from "./reminders";

/**
 * Crea los recordatorios que tocan ahora (lo llama GET /api/cron/reminders con el service role).
 * Lee en lotes por grupos de usuarios: preferencias, agua y comidas de hoy, pesaje de hoy, ayunos
 * activos y los recordatorios ya enviados (para no repetir). No envía push: eso lo hace
 * `sendDuePushNotifications` después.
 */
type Client = SupabaseClient<Database>;

export type ReminderRunSummary = {
  usersChecked: number;
  created: number;
  byType: Partial<Record<ReminderDraft["type"], number>>;
};

export class ReminderRunError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ReminderRunError";
  }
}

const PAGE = 1000;
const CHUNK = 100;
/** Duración mínima de un ayuno (checks de fasting_sessions): antes de eso ninguno puede estar completo. */
const MIN_FAST_HOURS = 8;

type Candidate = { id: string; timezone: string; prefs: NotificationPrefs };

function must<T>(res: { data: T | null; error: { code?: string } | null }, what: string): T {
  if (res.error) throw new ReminderRunError("DB_ERROR", `No se pudo leer ${what}.`);
  return (res.data ?? ([] as unknown)) as T;
}

async function loadCandidates(admin: Client, now: Date): Promise<{ candidates: Candidate[]; fasts: Map<string, { id: string; startedAt: string; targetHours: number }> }> {
  const byId = new Map<string, Candidate>();
  for (let from = 0; ; from += PAGE) {
    const rows = must(
      await admin
        .from("profiles")
        .select("id, timezone, notification_prefs")
        .neq("notification_prefs", "{}")
        .order("id")
        .range(from, from + PAGE - 1),
      "las preferencias",
    );
    for (const p of rows) {
      const prefs = parseNotificationPrefs(p.notification_prefs);
      if (hasScheduledReminders(prefs)) byId.set(p.id, { id: p.id, timezone: p.timezone || DEFAULT_TIMEZONE, prefs });
    }
    if (rows.length < PAGE) break;
  }

  // Ayunos activos que ya pudieron completarse (el aviso aplica aunque no haya otras preferencias).
  const fasts = new Map<string, { id: string; startedAt: string; targetHours: number }>();
  const startedBefore = new Date(now.getTime() - MIN_FAST_HOURS * 3_600_000).toISOString();
  for (let from = 0; ; from += PAGE) {
    const rows = must(
      await admin
        .from("fasting_sessions")
        .select("id, user_id, started_at, target_hours")
        .eq("status", "active")
        .lte("started_at", startedBefore)
        .order("id")
        .range(from, from + PAGE - 1),
      "los ayunos activos",
    );
    for (const f of rows) {
      const endsAt = Date.parse(f.started_at) + Number(f.target_hours) * 3_600_000;
      if (endsAt <= now.getTime()) fasts.set(f.user_id, { id: f.id, startedAt: f.started_at, targetHours: Number(f.target_hours) });
    }
    if (rows.length < PAGE) break;
  }

  const missing = [...fasts.keys()].filter((id) => !byId.has(id));
  for (let i = 0; i < missing.length; i += CHUNK) {
    const rows = must(
      await admin.from("profiles").select("id, timezone, notification_prefs").in("id", missing.slice(i, i + CHUNK)),
      "los perfiles",
    );
    for (const p of rows) {
      const prefs = parseNotificationPrefs(p.notification_prefs);
      if (prefs.fasting.enabled) byId.set(p.id, { id: p.id, timezone: p.timezone || DEFAULT_TIMEZONE, prefs });
    }
  }
  return { candidates: [...byId.values()], fasts };
}

export async function createDueReminders(admin: Client, now: Date = new Date()): Promise<ReminderRunSummary> {
  const { candidates, fasts } = await loadCandidates(admin, now);
  const summary: ReminderRunSummary = { usersChecked: 0, created: 0, byType: {} };
  const since48h = new Date(now.getTime() - 48 * 3_600_000).toISOString();

  for (let i = 0; i < candidates.length; i += CHUNK) {
    const chunk: Array<Candidate & { clock: LocalClock }> = [];
    for (const c of candidates.slice(i, i + CHUNK)) {
      try {
        chunk.push({ ...c, clock: localClock(now, c.timezone) });
      } catch {
        // Zona horaria inválida (la BD la valida; por si acaso no se cae el lote).
        continue;
      }
    }
    if (chunk.length === 0) continue;
    const ids = chunk.map((c) => c.id);
    const dates = chunk.map((c) => c.clock.date).sort();
    const minDate = dates[0]!;
    const maxDate = dates.at(-1)!;
    const waterIds = chunk.filter((c) => c.prefs.water.enabled).map((c) => c.id);
    const loggingIds = chunk.filter((c) => c.prefs.logging.enabled).map((c) => c.id);
    const weighIds = chunk.filter((c) => c.prefs.weighIn.enabled).map((c) => c.id);
    const fastUrls = chunk.map((c) => fasts.get(c.id)).filter((f) => f !== undefined).map((f) => fastingReminderUrl(f.id));

    const empty = { data: [], error: null };
    const [water, totals, weights, goals, targets, recent, fastNotifs] = await Promise.all([
      waterIds.length
        ? admin
            .from("water_logs")
            .select("user_id, local_date, amount_ml, logged_at")
            .in("user_id", waterIds)
            .gte("local_date", minDate)
            .lte("local_date", maxDate)
        : empty,
      loggingIds.length
        ? admin
            .from("daily_nutrition_totals")
            .select("user_id, local_date, items_count")
            .in("user_id", loggingIds)
            .gte("local_date", minDate)
            .lte("local_date", maxDate)
        : empty,
      weighIds.length
        ? admin.from("weight_logs").select("user_id, local_date").in("user_id", weighIds).gte("local_date", minDate).lte("local_date", maxDate)
        : empty,
      weighIds.length ? admin.from("user_goals").select("user_id, health_flags").in("user_id", weighIds).eq("is_active", true) : empty,
      waterIds.length
        ? admin
            .from("nutrition_targets")
            .select("user_id, effective_from, created_at, water_ml")
            .in("user_id", waterIds)
            .lte("effective_from", maxDate)
            .order("effective_from", { ascending: false })
            .order("created_at", { ascending: false })
        : empty,
      admin
        .from("notifications")
        .select("user_id, type, url, created_at")
        .in("user_id", ids)
        .in("type", [...REMINDER_TYPES])
        .gte("created_at", since48h),
      fastUrls.length
        ? admin.from("notifications").select("user_id, type, url, created_at").eq("type", "fasting_complete").in("url", fastUrls)
        : empty,
    ]);

    const waterRows = must(water, "el agua");
    const totalRows = must(totals, "los registros de comida");
    const weightRows = must(weights, "los pesajes");
    const goalRows = must(goals, "los objetivos");
    const targetRows = must(targets, "las metas");
    const recentRows = [...must(recent, "las notificaciones"), ...must(fastNotifs, "los avisos de ayuno")];

    const drafts: Array<ReminderDraft & { user_id: string }> = [];
    for (const c of chunk) {
      const today = c.clock.date;
      const myWater = waterRows.filter((w) => w.user_id === c.id && w.local_date === today);
      const target = targetRows.find((t) => t.user_id === c.id && t.effective_from <= today);
      const flags = goalRows.find((g) => g.user_id === c.id)?.health_flags ?? [];
      const myRecent: RecentReminder[] = recentRows
        .filter((r) => r.user_id === c.id)
        .map((r) => {
          let localDate = "";
          try {
            localDate = localClock(new Date(r.created_at), c.timezone).date;
          } catch {
            localDate = r.created_at.slice(0, 10);
          }
          return { type: r.type, url: r.url, createdAt: r.created_at, localDate };
        });
      const lastWater = myWater.map((w) => w.logged_at).sort().at(-1) ?? null;
      const items = totalRows.find((t) => t.user_id === c.id && t.local_date === today)?.items_count ?? 0;

      const due = dueReminders({
        now,
        clock: c.clock,
        prefs: c.prefs,
        waterTodayMl: myWater.reduce((s, w) => s + Number(w.amount_ml), 0),
        waterTargetMl: target?.water_ml != null ? Number(target.water_ml) : null,
        lastWaterLoggedAt: lastWater,
        itemsLoggedToday: Number(items) || 0,
        weighedToday: weightRows.some((w) => w.user_id === c.id && w.local_date === today),
        hideWeight: flags.includes("eating_disorder_history"),
        activeFast: fasts.get(c.id) ?? null,
        recent: myRecent,
      });
      summary.usersChecked++;
      for (const d of due) drafts.push({ ...d, user_id: c.id });
    }

    if (drafts.length > 0) {
      const { error } = await admin.from("notifications").insert(
        drafts.map((d) => ({
          user_id: d.user_id,
          type: d.type,
          title: d.title,
          body: d.body,
          url: d.url,
          scheduled_for: now.toISOString(),
        })),
      );
      if (error) throw new ReminderRunError("DB_ERROR", "No se pudieron crear los recordatorios.");
      summary.created += drafts.length;
      for (const d of drafts) summary.byType[d.type] = (summary.byType[d.type] ?? 0) + 1;
    }
  }
  return summary;
}
