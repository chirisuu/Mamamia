/**
 * Borrador del onboarding en localStorage (clave versionada). Todo acceso va en try/catch: en modo
 * privado o con el almacenamiento bloqueado el asistente funciona igual, solo sin recordar.
 */
import { ONBOARDING_STORAGE_KEY, parseDraft, type OnboardingDraft } from "../schemas";

export function readRawDraft(): string | null {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function loadDraft(): OnboardingDraft | null {
  return parseDraft(readRawDraft());
}

export function writeDraft(draft: OnboardingDraft): void {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Sin almacenamiento: se pierde al cerrar la pestaña, pero el asistente sigue.
  }
}

export function restoreRawDraft(raw: string | null): void {
  if (raw == null) return;
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, raw);
  } catch {
    // ignorado
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  } catch {
    // ignorado
  }
}

/** Un borrador "pendiente de cuenta" se guarda solo si es reciente (evita guardar uno ajeno y viejo). */
export const AUTO_SAVE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function isRecent(draft: OnboardingDraft, now: number = Date.now()): boolean {
  const t = Date.parse(draft.updatedAt);
  return Number.isFinite(t) && now - t <= AUTO_SAVE_MAX_AGE_MS && t <= now + 60_000;
}

export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Lima";
  } catch {
    return "America/Lima";
  }
}
