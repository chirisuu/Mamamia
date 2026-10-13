/**
 * Preferencias de recordatorios (`profiles.notification_prefs`, jsonb). Módulo puro: lo usan el
 * cliente (formularios), las acciones y el cron. Todo recordatorio es opcional y arranca apagado,
 * salvo el aviso de ayuno completado (solo aplica si la persona inicia un ayuno).
 *
 * Forma guardada (versión 1):
 * {
 *   "water":   { "enabled": false, "startHour": 9, "endHour": 20, "everyHours": 2 },
 *   "logging": { "enabled": false, "hour": 20 },
 *   "weighIn": { "enabled": false, "weekday": 1, "hour": 8 },
 *   "fasting": { "enabled": true }
 * }
 * Horas en la zona horaria del perfil (0–23). `weekday`: 0 = domingo … 6 = sábado.
 */
import { z } from "zod";

const hour = z.number().int().min(0).max(23);

export const waterPrefsSchema = z
  .object({
    enabled: z.boolean(),
    startHour: hour,
    endHour: hour,
    everyHours: z.number().int().min(1).max(6),
  })
  .refine((v) => v.endHour > v.startHour, {
    message: "La hora final debe ser posterior a la inicial.",
    path: ["endHour"],
  });

export const loggingPrefsSchema = z.object({ enabled: z.boolean(), hour });
export const weighInPrefsSchema = z.object({ enabled: z.boolean(), weekday: z.number().int().min(0).max(6), hour });
export const fastingPrefsSchema = z.object({ enabled: z.boolean() });

export const notificationPrefsSchema = z.object({
  water: waterPrefsSchema,
  logging: loggingPrefsSchema,
  weighIn: weighInPrefsSchema,
  fasting: fastingPrefsSchema,
});

export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;
export type NotificationPrefsSection = keyof NotificationPrefs;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  water: { enabled: false, startHour: 9, endHour: 20, everyHours: 2 },
  logging: { enabled: false, hour: 20 },
  weighIn: { enabled: false, weekday: 1, hour: 8 },
  fasting: { enabled: true },
};

const SECTION_SCHEMAS = {
  water: waterPrefsSchema,
  logging: loggingPrefsSchema,
  weighIn: weighInPrefsSchema,
  fasting: fastingPrefsSchema,
} as const;

/**
 * Lee el jsonb guardado de forma tolerante: cada sección inválida o ausente toma su valor por
 * defecto (no se pierde lo demás). Nunca lanza.
 */
export function parseNotificationPrefs(raw: unknown): NotificationPrefs {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out = structuredClone(DEFAULT_NOTIFICATION_PREFS);
  for (const key of Object.keys(SECTION_SCHEMAS) as NotificationPrefsSection[]) {
    const value = source[key];
    if (!value || typeof value !== "object") continue;
    const merged = { ...DEFAULT_NOTIFICATION_PREFS[key], ...(value as object) };
    const parsed = SECTION_SCHEMAS[key].safeParse(merged);
    if (parsed.success) (out as Record<NotificationPrefsSection, unknown>)[key] = parsed.data;
  }
  return out;
}

/** Aplica el cambio de una sección y valida el resultado completo. */
export function mergeNotificationPrefs(
  current: unknown,
  patch: Partial<{ [K in NotificationPrefsSection]: NotificationPrefs[K] }>,
): NotificationPrefs {
  const base = parseNotificationPrefs(current);
  return notificationPrefsSchema.parse({ ...base, ...patch });
}

/** ¿Hay algún recordatorio programado activo? (el de ayuno depende de que haya un ayuno en curso). */
export function hasScheduledReminders(prefs: NotificationPrefs): boolean {
  return prefs.water.enabled || prefs.logging.enabled || prefs.weighIn.enabled;
}

export const WEEKDAY_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;

/** "8:00", "20:00". */
export function formatHour(h: number): string {
  return `${h}:00`;
}
