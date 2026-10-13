/**
 * Ayuno: protocolos, horas objetivo y formatos de tiempo (puro). Las reglas (límites 8–24 h,
 * estado y estadísticas) viven en `src/lib/nutrition/fasting.ts`.
 */
import { FASTING_HOURS_LIMITS, FASTING_PROTOCOLS, findProtocol } from "@/lib/nutrition";

export const PROTOCOL_CODES = ["12:12", "14:10", "16:8", "18:6", "custom"] as const;
export type ProtocolCode = (typeof PROTOCOL_CODES)[number];

/** Paso del ayuno personalizado (media hora), dentro de 8–24 h. */
export const CUSTOM_HOURS_STEP = 0.5;

/** Opciones de «empecé hace…» (minutos). Útil si dejaste de comer antes de abrir la app. */
export const STARTED_AGO_OPTIONS = [0, 30, 60, 120, 180, 240] as const;

export function protocolLabel(code: string, targetHours: number): string {
  if (code === "custom") return `Personalizado · ${formatHours(targetHours)}`;
  return findProtocol(code)?.label ?? code;
}

/** Horas objetivo de un protocolo; para «custom» valida 8–24 h en pasos de 0.5. null si no es válido. */
export function resolveTargetHours(code: ProtocolCode, customHours: number | null | undefined): number | null {
  if (code !== "custom") return FASTING_PROTOCOLS.find((p) => p.code === code)?.fastingHours ?? null;
  if (customHours == null || !Number.isFinite(customHours)) return null;
  if (customHours < FASTING_HOURS_LIMITS.min || customHours > FASTING_HOURS_LIMITS.max) return null;
  if (Math.abs(customHours / CUSTOM_HOURS_STEP - Math.round(customHours / CUSTOM_HOURS_STEP)) > 1e-9) return null;
  return customHours;
}

/** "16 h", "16 h 30 min", "45 min". */
export function formatHours(hours: number): string {
  const totalMin = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Reloj "HH:MM:SS" (las horas pueden pasar de 24 si se olvidó terminar). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

/** Duración en horas entre dos instantes ISO (2 decimales). */
export function durationHours(startIso: string, endIso: string): number {
  const ms = Date.parse(endIso) - Date.parse(startIso);
  return Number.isFinite(ms) ? Math.round((Math.max(0, ms) / 3_600_000) * 100) / 100 : 0;
}

/** ¿Llegó a la meta de horas? (tolerancia de 1 min por redondeos). */
export function reachedTarget(startIso: string, endIso: string, targetHours: number): boolean {
  return Date.parse(endIso) - Date.parse(startIso) >= targetHours * 3_600_000 - 60_000;
}
