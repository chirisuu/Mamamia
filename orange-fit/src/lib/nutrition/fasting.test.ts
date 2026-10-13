import { describe, expect, it } from "vitest";
import { NutritionInputError } from "./errors";
import type { FastingSessionRecord } from "./fasting";
import { canStartFasting, FASTING_PROTOCOLS, fastingStats, fastingStatus, findProtocol } from "./fasting";
import { screenRisk } from "./risk";

describe("FASTING_PROTOCOLS", () => {
  it("solo 12:12, 14:10, 16:8 y 18:6; ninguno supera 24 h", () => {
    expect(FASTING_PROTOCOLS.map((p) => p.code)).toEqual(["12:12", "14:10", "16:8", "18:6"]);
    for (const p of FASTING_PROTOCOLS) {
      expect(p.fastingHours + p.eatingHours).toBe(24);
      expect(p.fastingHours).toBeLessThanOrEqual(24);
      expect(p.description.length).toBeGreaterThan(10);
    }
  });

  it("findProtocol", () => {
    expect(findProtocol("16:8")?.fastingHours).toBe(16);
    expect(findProtocol("20:4")).toBeNull();
    expect(findProtocol("36:12")).toBeNull();
  });
});

describe("fastingStatus", () => {
  const startedAt = "2026-10-13T00:00:00.000Z";

  it("a mitad de un 16:8", () => {
    const s = fastingStatus({ startedAt, targetHours: 16, now: "2026-10-13T08:00:00.000Z" });
    expect(s).toMatchObject({
      startedAt,
      endsAt: "2026-10-13T16:00:00.000Z",
      elapsedHours: 8,
      remainingHours: 8,
      progress: 0.5,
      completed: false,
      overtimeMs: 0,
    });
    expect(s.elapsedMs).toBe(8 * 3_600_000);
  });

  it("completado y con tiempo extra", () => {
    const s = fastingStatus({ startedAt: new Date(startedAt), targetHours: 16, now: new Date("2026-10-13T17:00:00.000Z") });
    expect(s).toMatchObject({ completed: true, progress: 1, remainingMs: 0, overtimeMs: 3_600_000 });
  });

  it("antes del inicio el tiempo transcurrido es 0", () => {
    expect(fastingStatus({ startedAt, targetHours: 12, now: "2026-10-12T23:00:00.000Z" }).elapsedMs).toBe(0);
  });

  it("usa la hora actual si no se indica", () => {
    expect(fastingStatus({ startedAt: new Date(), targetHours: 12 }).completed).toBe(false);
  });

  it("valida la duración (8–24 h) y las fechas", () => {
    expect(() => fastingStatus({ startedAt, targetHours: 25, now: startedAt })).toThrow(
      "La duración del ayuno debe estar entre 8 y 24 horas.",
    );
    expect(() => fastingStatus({ startedAt, targetHours: 7, now: startedAt })).toThrow(NutritionInputError);
    expect(fastingStatus({ startedAt, targetHours: 24, now: startedAt }).progress).toBe(0);
    expect(() => fastingStatus({ startedAt: "ayer", targetHours: 16 })).toThrow("La fecha y hora no son válidas.");
  });
});

describe("fastingStats", () => {
  const s = (startedAt: string, endedAt: string | null, status: FastingSessionRecord["status"]): FastingSessionRecord => ({
    startedAt,
    endedAt,
    targetHours: 16,
    status,
  });

  it("cuenta sesiones completadas, promedio y mayor", () => {
    const stats = fastingStats([
      s("2026-10-01T20:00:00Z", "2026-10-02T12:00:00Z", "completed"),
      s("2026-10-02T20:00:00Z", "2026-10-03T10:00:00Z", "completed"),
      s("2026-10-03T20:00:00Z", "2026-10-04T02:00:00Z", "cancelled"),
      s("2026-10-04T20:00:00Z", null, "active"),
    ]);
    expect(stats).toEqual({
      totalSessions: 4,
      completedSessions: 2,
      cancelledSessions: 1,
      activeSessions: 1,
      completionRate: 0.6667,
      averageHours: 15,
      longestHours: 16,
      totalCompletedHours: 30,
    });
  });

  it("sin sesiones terminadas", () => {
    expect(fastingStats([])).toMatchObject({ completionRate: null, averageHours: null, longestHours: null, totalCompletedHours: 0 });
  });

  it("valida sesiones completadas", () => {
    expect(() => fastingStats([s("2026-10-01T20:00:00Z", null, "completed")])).toThrow("debe tener hora de fin");
    expect(() => fastingStats([s("2026-10-02T20:00:00Z", "2026-10-01T20:00:00Z", "completed")])).toThrow(
      "La hora de fin es anterior al inicio.",
    );
  });
});

describe("canStartFasting", () => {
  const risk = (patch: Partial<Parameters<typeof screenRisk>[0]>) =>
    screenRisk({ ageYears: 30, sex: "female", bmi: 23, healthFlags: [], goal: "maintain", ...patch });

  it.each([
    ["menor de edad", { ageYears: 16 }],
    ["embarazo", { healthFlags: ["pregnant" as const] }],
    ["diabetes con medicación", { healthFlags: ["diabetes_medication" as const] }],
    ["enfermedad renal", { healthFlags: ["kidney_disease" as const] }],
    ["antecedente de TCA", { healthFlags: ["eating_disorder_history" as const] }],
  ])("bloqueado por riesgo: %s", (_name, patch) => {
    const r = canStartFasting(risk(patch));
    expect(r).toMatchObject({ allowed: false, code: "risk_blocked" });
    expect(r.reason).toContain("no está disponible");
  });

  it("no permite dos ayunos a la vez", () => {
    expect(canStartFasting(risk({}), { hasActiveSession: true })).toMatchObject({ allowed: false, code: "active_session" });
  });

  it("permitido con avisos; con precaución agrega los mensajes del cribado", () => {
    const ok = canStartFasting(risk({}));
    expect(ok).toMatchObject({ allowed: true, code: "ok", reason: null });
    expect(ok.cautions).toHaveLength(1);
    const caution = canStartFasting(risk({ ageYears: 70 }));
    expect(caution.allowed).toBe(true);
    expect(caution.cautions.length).toBe(2);
    expect(caution.cautions[0]).toContain("65 años");
  });
});
