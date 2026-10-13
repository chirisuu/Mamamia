/**
 * Ayuno intermitente: protocolos de hasta 18 h (y personalizados de 8 a 24 h, como en la base).
 * No hay protocolos de más de 24 h. Nunca se habilita si el cribado de riesgo lo bloquea.
 */
import { NutritionInputError } from "./errors";
import { assertInRange, clamp, roundDecimals } from "./math";
import type { RiskScreening } from "./risk";

export type FastingProtocolCode = "12:12" | "14:10" | "16:8" | "18:6";

export interface FastingProtocol {
  code: FastingProtocolCode;
  fastingHours: number;
  eatingHours: number;
  label: string;
  description: string;
}

export const FASTING_PROTOCOLS: readonly FastingProtocol[] = [
  {
    code: "12:12",
    fastingHours: 12,
    eatingHours: 12,
    label: "12:12 · Para empezar",
    description: "12 horas sin comer, que en buena parte coinciden con la noche, y 12 horas para tus comidas.",
  },
  {
    code: "14:10",
    fastingHours: 14,
    eatingHours: 10,
    label: "14:10 · Intermedio",
    description: "14 horas de ayuno y una ventana de 10 horas para comer.",
  },
  {
    code: "16:8",
    fastingHours: 16,
    eatingHours: 8,
    label: "16:8 · Clásico",
    description: "16 horas de ayuno y una ventana de 8 horas para comer.",
  },
  {
    code: "18:6",
    fastingHours: 18,
    eatingHours: 6,
    label: "18:6 · Avanzado",
    description: "18 horas de ayuno y una ventana de 6 horas. Solo si ya te sientes bien con 16:8.",
  },
];

export const FASTING_HOURS_LIMITS = { min: 8, max: 24 } as const;

export function findProtocol(code: string): FastingProtocol | null {
  return FASTING_PROTOCOLS.find((p) => p.code === code) ?? null;
}

export function assertFastingHours(hours: number, field = "targetHours"): number {
  return assertInRange(hours, FASTING_HOURS_LIMITS.min, FASTING_HOURS_LIMITS.max, field, "La duración del ayuno", "horas");
}

function toMs(value: Date | string, field: string): number {
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(ms)) throw new NutritionInputError("invalid_date", field, "La fecha y hora no son válidas.");
  return ms;
}

const HOUR_MS = 3_600_000;

export interface FastingStatus {
  startedAt: string;
  endsAt: string;
  targetHours: number;
  elapsedMs: number;
  remainingMs: number;
  /** Tiempo por encima de la meta. */
  overtimeMs: number;
  /** 0–1. */
  progress: number;
  elapsedHours: number;
  remainingHours: number;
  completed: boolean;
}

export function fastingStatus(input: { startedAt: Date | string; targetHours: number; now?: Date | string }): FastingStatus {
  assertFastingHours(input.targetHours);
  const start = toMs(input.startedAt, "startedAt");
  const now = toMs(input.now ?? new Date(), "now");
  const targetMs = input.targetHours * HOUR_MS;
  const elapsedMs = Math.max(0, now - start);
  return {
    startedAt: new Date(start).toISOString(),
    endsAt: new Date(start + targetMs).toISOString(),
    targetHours: input.targetHours,
    elapsedMs,
    remainingMs: Math.max(0, targetMs - elapsedMs),
    overtimeMs: Math.max(0, elapsedMs - targetMs),
    progress: roundDecimals(clamp(elapsedMs / targetMs, 0, 1), 4),
    elapsedHours: roundDecimals(elapsedMs / HOUR_MS, 2),
    remainingHours: roundDecimals(Math.max(0, targetMs - elapsedMs) / HOUR_MS, 2),
    completed: elapsedMs >= targetMs,
  };
}

export interface FastingSessionRecord {
  startedAt: Date | string;
  endedAt: Date | string | null;
  targetHours: number;
  status: "active" | "completed" | "cancelled";
}

export interface FastingStats {
  totalSessions: number;
  completedSessions: number;
  cancelledSessions: number;
  activeSessions: number;
  /** completadas / terminadas (completadas + canceladas), 0–1. null si aún no hay terminadas. */
  completionRate: number | null;
  /** Promedio y máximo de horas de las sesiones completadas (2 decimales); null si no hay. */
  averageHours: number | null;
  longestHours: number | null;
  totalCompletedHours: number;
}

export function fastingStats(sessions: readonly FastingSessionRecord[]): FastingStats {
  const completedDurations: number[] = [];
  let cancelled = 0;
  let active = 0;
  sessions.forEach((s, i) => {
    if (s.status === "active") {
      active++;
      return;
    }
    if (s.status === "cancelled") {
      cancelled++;
      return;
    }
    if (s.endedAt === null) {
      throw new NutritionInputError("invalid_value", `sessions.${i}.endedAt`, "Una sesión completada debe tener hora de fin.");
    }
    const hours = (toMs(s.endedAt, `sessions.${i}.endedAt`) - toMs(s.startedAt, `sessions.${i}.startedAt`)) / HOUR_MS;
    if (hours < 0) {
      throw new NutritionInputError("invalid_value", `sessions.${i}.endedAt`, "La hora de fin es anterior al inicio.");
    }
    completedDurations.push(hours);
  });
  const completed = completedDurations.length;
  const total = completedDurations.reduce((s, h) => s + h, 0);
  const finished = completed + cancelled;
  return {
    totalSessions: sessions.length,
    completedSessions: completed,
    cancelledSessions: cancelled,
    activeSessions: active,
    completionRate: finished === 0 ? null : roundDecimals(completed / finished, 4),
    averageHours: completed === 0 ? null : roundDecimals(total / completed, 2),
    longestHours: completed === 0 ? null : roundDecimals(Math.max(...completedDurations), 2),
    totalCompletedHours: roundDecimals(total, 2),
  };
}

export type CanStartFastingCode = "ok" | "risk_blocked" | "active_session";

export interface CanStartFastingResult {
  allowed: boolean;
  code: CanStartFastingCode;
  /** Motivo para mostrar si no se permite. */
  reason: string | null;
  /** Avisos a mostrar aunque se permita (perfil con precaución). */
  cautions: string[];
}

/** ¿Se puede iniciar un ayuno? Respeta `risk.blocks.fasting` y la regla de una sesión activa. */
export function canStartFasting(
  risk: Pick<RiskScreening, "level" | "blocks" | "messages">,
  options: { hasActiveSession?: boolean } = {},
): CanStartFastingResult {
  if (risk.blocks.fasting) {
    return {
      allowed: false,
      code: "risk_blocked",
      reason:
        "Por tu perfil de salud, el ayuno no está disponible en la app. Si te interesa, conversa primero con tu médico o nutricionista.",
      cautions: [],
    };
  }
  if (options.hasActiveSession) {
    return { allowed: false, code: "active_session", reason: "Ya tienes un ayuno en curso. Termínalo antes de iniciar otro.", cautions: [] };
  }
  const cautions =
    risk.level === "caution"
      ? [...risk.messages, "Si sientes mareo, debilidad o malestar, termina el ayuno y come algo."]
      : ["Si sientes mareo, debilidad o malestar, termina el ayuno y come algo."];
  return { allowed: true, code: "ok", reason: null, cautions };
}
