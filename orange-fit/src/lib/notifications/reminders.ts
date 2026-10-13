/**
 * Recordatorios programados (lo usa GET /api/cron/reminders). Puro y determinista: recibe la hora
 * local del usuario, sus preferencias y lo que ya registró, y devuelve qué notificaciones crear.
 * Reglas:
 * - Nada se repite: cada tipo tiene su ventana de deduplicación (por día local o por intervalo).
 * - Sin culpa: si la persona ya hizo lo que el recordatorio pide, no se envía.
 * - Con antecedente de TCA no se envían recordatorios de pesaje (igual que en Inicio).
 */
import type { NotificationPrefs } from "./prefs";

export const REMINDER_TYPES = ["water_reminder", "logging_reminder", "weigh_in_reminder", "fasting_complete"] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];

export interface LocalClock {
  /** YYYY-MM-DD en la zona del usuario. */
  date: string;
  /** 0–23. */
  hour: number;
  /** 0 = domingo … 6 = sábado. */
  weekday: number;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Fecha, hora y día de la semana de un instante en una zona IANA. */
export function localClock(now: Date, timeZone: string): LocalClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")) % 24,
    weekday: WEEKDAYS[get("weekday")] ?? 0,
  };
}

export interface RecentReminder {
  type: string;
  url: string | null;
  createdAt: string;
  /** Fecha local (zona del usuario) en que se creó. */
  localDate: string;
}

export interface ReminderContext {
  now: Date;
  clock: LocalClock;
  prefs: NotificationPrefs;
  waterTodayMl: number;
  waterTargetMl: number | null;
  /** Último registro de agua (ISO) o null. */
  lastWaterLoggedAt: string | null;
  itemsLoggedToday: number;
  weighedToday: boolean;
  /** Antecedente de TCA: sin recordatorios de peso. */
  hideWeight: boolean;
  activeFast: { id: string; startedAt: string; targetHours: number } | null;
  /** Notificaciones de recordatorio de las últimas 48 h. */
  recent: readonly RecentReminder[];
}

export interface ReminderDraft {
  type: ReminderType;
  title: string;
  body: string;
  url: string;
}

const MINUTE = 60_000;
/** Margen para que un cron que corre cada hora no salte un intervalo por segundos de diferencia. */
const INTERVAL_TOLERANCE_MIN = 10;

function fmtMl(ml: number): string {
  return ml >= 1000 ? `${(ml / 1000).toLocaleString("es-PE", { maximumFractionDigits: 2 })} L` : `${Math.round(ml)} ml`;
}

export function fastingReminderUrl(sessionId: string): string {
  return `/app/ayuno?sesion=${sessionId}`;
}

export function dueReminders(ctx: ReminderContext): ReminderDraft[] {
  const out: ReminderDraft[] = [];
  const { prefs, clock, now } = ctx;
  const sentToday = (type: ReminderType) => ctx.recent.some((r) => r.type === type && r.localDate === clock.date);

  // Agua: dentro de la ventana, por debajo de la meta y sin aviso (ni registro) en el último intervalo.
  if (prefs.water.enabled && clock.hour >= prefs.water.startHour && clock.hour < prefs.water.endHour) {
    const target = ctx.waterTargetMl;
    const below = target == null || ctx.waterTodayMl < target;
    const windowMs = (prefs.water.everyHours * 60 - INTERVAL_TOLERANCE_MIN) * MINUTE;
    const recentlyReminded = ctx.recent.some(
      (r) => r.type === "water_reminder" && now.getTime() - Date.parse(r.createdAt) < windowMs,
    );
    const recentlyLogged = ctx.lastWaterLoggedAt != null && now.getTime() - Date.parse(ctx.lastWaterLoggedAt) < windowMs;
    if (below && !recentlyReminded && !recentlyLogged) {
      out.push({
        type: "water_reminder",
        title: "¿Un vaso de agua?",
        body:
          target != null
            ? `Llevas ${fmtMl(ctx.waterTodayMl)} de ${fmtMl(target)} hoy. Un vaso más suma.`
            : `Llevas ${fmtMl(ctx.waterTodayMl)} hoy. Un vaso de agua cae bien.`,
        url: "/app/agua",
      });
    }
  }

  // Registro de comidas: una vez al día, desde la hora elegida, solo si hoy no hay nada anotado.
  if (prefs.logging.enabled && clock.hour >= prefs.logging.hour && ctx.itemsLoggedToday === 0 && !sentToday("logging_reminder")) {
    out.push({
      type: "logging_reminder",
      title: "¿Anotamos tu día?",
      body: "Aún no hay comidas en tu diario de hoy. Registrar lo que comiste te ayuda a ver tu avance, sin juicios.",
      url: "/app/diario",
    });
  }

  // Pesaje semanal: el día y desde la hora elegidos, si aún no se pesó hoy.
  if (
    prefs.weighIn.enabled &&
    !ctx.hideWeight &&
    clock.weekday === prefs.weighIn.weekday &&
    clock.hour >= prefs.weighIn.hour &&
    !ctx.weighedToday &&
    !sentToday("weigh_in_reminder")
  ) {
    out.push({
      type: "weigh_in_reminder",
      title: "Tu pesaje semanal",
      body: "Si te viene bien, registra tu peso hoy. Con un dato por semana ya se ve tu tendencia.",
      url: "/app/progreso",
    });
  }

  // Ayuno completado: una sola vez por sesión.
  if (prefs.fasting.enabled && ctx.activeFast) {
    const endsAt = Date.parse(ctx.activeFast.startedAt) + ctx.activeFast.targetHours * 3_600_000;
    const url = fastingReminderUrl(ctx.activeFast.id);
    if (Number.isFinite(endsAt) && now.getTime() >= endsAt && !ctx.recent.some((r) => r.type === "fasting_complete" && r.url === url)) {
      const hours = ctx.activeFast.targetHours;
      out.push({
        type: "fasting_complete",
        title: "Completaste tu ayuno",
        body: `Llegaste a tus ${hours.toLocaleString("es-PE", { maximumFractionDigits: 1 })} h. Cuando quieras, termínalo en la app y come con calma.`,
        url,
      });
    }
  }

  return out;
}
