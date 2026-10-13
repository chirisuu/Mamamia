import { describe, expect, it } from "vitest";
import { DEFAULT_NOTIFICATION_PREFS, mergeNotificationPrefs, parseNotificationPrefs, type NotificationPrefs } from "./prefs";
import { dueReminders, fastingReminderUrl, localClock, type ReminderContext } from "./reminders";

const now = new Date("2026-10-13T20:30:00Z"); // 15:30 en Lima (martes)

function ctx(overrides: Omit<Partial<ReminderContext>, "prefs"> & { prefs?: Partial<NotificationPrefs> } = {}): ReminderContext {
  const { prefs, ...rest } = overrides;
  return {
    now,
    clock: localClock(now, "America/Lima"),
    prefs: { ...DEFAULT_NOTIFICATION_PREFS, ...prefs },
    waterTodayMl: 500,
    waterTargetMl: 2000,
    lastWaterLoggedAt: null,
    itemsLoggedToday: 0,
    weighedToday: false,
    hideWeight: false,
    activeFast: null,
    recent: [],
    ...rest,
  };
}

describe("preferencias de notificación", () => {
  it("lee el jsonb de forma tolerante y conserva lo válido", () => {
    const p = parseNotificationPrefs({ water: { enabled: true, startHour: 8 }, logging: { enabled: "sí" }, extra: 1 });
    expect(p.water).toEqual({ enabled: true, startHour: 8, endHour: 20, everyHours: 2 });
    expect(p.logging).toEqual(DEFAULT_NOTIFICATION_PREFS.logging);
    expect(parseNotificationPrefs(null)).toEqual(DEFAULT_NOTIFICATION_PREFS);
  });
  it("valida rangos al guardar", () => {
    expect(() => mergeNotificationPrefs({}, { water: { enabled: true, startHour: 20, endHour: 9, everyHours: 2 } })).toThrow();
  });
});

describe("recordatorios programados", () => {
  it("hora local de Lima", () => {
    expect(localClock(now, "America/Lima")).toEqual({ date: "2026-10-13", hour: 15, weekday: 2 });
  });

  it("nada activado → nada", () => {
    expect(dueReminders(ctx())).toEqual([]);
  });

  it("agua: dentro de la ventana y bajo la meta; no repite dentro del intervalo", () => {
    const water = { enabled: true, startHour: 9, endHour: 20, everyHours: 2 };
    expect(dueReminders(ctx({ prefs: { water } })).map((r) => r.type)).toEqual(["water_reminder"]);
    const recent = [{ type: "water_reminder", url: "/app/agua", createdAt: "2026-10-13T19:30:00Z", localDate: "2026-10-13" }];
    expect(dueReminders(ctx({ prefs: { water }, recent }))).toEqual([]);
    expect(dueReminders(ctx({ prefs: { water }, waterTodayMl: 2000 }))).toEqual([]);
    expect(dueReminders(ctx({ prefs: { water }, lastWaterLoggedAt: "2026-10-13T20:00:00Z" }))).toEqual([]);
    expect(dueReminders(ctx({ prefs: { water: { ...water, endHour: 15 } } }))).toEqual([]);
  });

  it("registro: solo si hoy no hay comidas y una vez al día", () => {
    const logging = { enabled: true, hour: 14 };
    expect(dueReminders(ctx({ prefs: { logging } }))[0]?.type).toBe("logging_reminder");
    expect(dueReminders(ctx({ prefs: { logging }, itemsLoggedToday: 2 }))).toEqual([]);
    const recent = [{ type: "logging_reminder", url: "/app/diario", createdAt: "2026-10-13T19:00:00Z", localDate: "2026-10-13" }];
    expect(dueReminders(ctx({ prefs: { logging }, recent }))).toEqual([]);
  });

  it("pesaje semanal: nunca con antecedente de TCA", () => {
    const weighIn = { enabled: true, weekday: 2, hour: 8 };
    expect(dueReminders(ctx({ prefs: { weighIn } }))[0]?.type).toBe("weigh_in_reminder");
    expect(dueReminders(ctx({ prefs: { weighIn }, hideWeight: true }))).toEqual([]);
    expect(dueReminders(ctx({ prefs: { weighIn }, weighedToday: true }))).toEqual([]);
  });

  it("ayuno completado: una sola vez por sesión", () => {
    const activeFast = { id: "f1", startedAt: "2026-10-13T04:00:00Z", targetHours: 16 };
    const first = dueReminders(ctx({ activeFast }));
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ type: "fasting_complete", url: fastingReminderUrl("f1") });
    const recent = [{ type: "fasting_complete", url: fastingReminderUrl("f1"), createdAt: "2026-10-13T20:05:00Z", localDate: "2026-10-13" }];
    expect(dueReminders(ctx({ activeFast, recent }))).toEqual([]);
    expect(dueReminders(ctx({ activeFast: { ...activeFast, targetHours: 18 } }))).toEqual([]);
    expect(dueReminders(ctx({ activeFast, prefs: { fasting: { enabled: false } } }))).toEqual([]);
  });
});
