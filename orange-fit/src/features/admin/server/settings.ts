import "server-only";
import type { Json } from "@/lib/db/database.types";
import type { SettingsData } from "../schemas";
import { AdminOpError, dbError, logAdminAction, type Db } from "./db";

export const SETTINGS_KEYS = ["app_name", "support_email", "feature_flags", "default_trial_days", "maintenance_banner"] as const;
export type SettingsKey = (typeof SETTINGS_KEYS)[number];

export type AdminSettings = {
  appName: string;
  supportEmail: string | null;
  defaultTrialDays: number;
  maintenanceBanner: string | null;
  featureFlags: Array<{ key: string; enabled: boolean }>;
  updatedAt: string | null;
  /** Claves que existen en la base (las que falten se crean al guardar). */
  presentKeys: string[];
};

/** Valores de `app_settings` tal como los edita el panel (lectura admin: incluye claves no públicas). */
export async function readSettings(supabase: Db, fallbackAppName: string): Promise<AdminSettings> {
  const { data, error } = await supabase.from("app_settings").select("key, value, updated_at").in("key", [...SETTINGS_KEYS]);
  if (error) throw dbError(error, "No se pudo leer la configuración.");
  const map = new Map((data ?? []).map((r) => [r.key, r.value as unknown]));
  const str = (k: SettingsKey) => {
    const v = map.get(k);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const trial = map.get("default_trial_days");
  const flags = map.get("feature_flags");
  const updated = (data ?? []).map((r) => r.updated_at).sort().at(-1) ?? null;
  return {
    appName: str("app_name") ?? fallbackAppName,
    supportEmail: str("support_email"),
    defaultTrialDays: typeof trial === "number" && Number.isFinite(trial) ? trial : 7,
    maintenanceBanner: str("maintenance_banner"),
    featureFlags:
      flags && typeof flags === "object" && !Array.isArray(flags)
        ? Object.entries(flags as Record<string, unknown>)
            .map(([key, value]) => ({ key, enabled: value === true }))
            .sort((a, b) => a.key.localeCompare(b.key))
        : [],
    updatedAt: updated,
    presentKeys: (data ?? []).map((r) => r.key),
  };
}

/**
 * Valor jsonb de cada clave a partir del formulario ya validado. "Sin valor" se guarda como texto
 * vacío: `value` es NOT NULL y PostgREST convierte un null de JSON en NULL de SQL. Quien lee
 * (`getAppSettings`) trata "" igual que null.
 */
export function settingsToRows(data: SettingsData): Array<{ key: SettingsKey; value: string | number | Record<string, boolean> }> {
  return [
    { key: "app_name", value: data.appName },
    { key: "support_email", value: data.supportEmail ?? "" },
    { key: "feature_flags", value: Object.fromEntries(data.featureFlags.map((f) => [f.key, f.enabled])) },
    { key: "default_trial_days", value: data.defaultTrialDays },
    { key: "maintenance_banner", value: data.maintenanceBanner ?? "" },
  ];
}

/** Para comparar: null de JSON y "" significan lo mismo (sin valor). */
function comparable(value: unknown): string {
  return JSON.stringify(value === null || value === undefined ? "" : value);
}

/** Claves cuyo valor cambia (para la auditoría: solo nombres de clave, no valores). */
export function changedKeys(before: Map<string, unknown>, rows: Array<{ key: string; value: Json }>): string[] {
  return rows.filter((r) => !before.has(r.key) || comparable(before.get(r.key)) !== comparable(r.value)).map((r) => r.key);
}

export async function saveSettings(supabase: Db, data: SettingsData): Promise<{ changed: string[] }> {
  const { data: current, error: readError } = await supabase.from("app_settings").select("key, value").in("key", [...SETTINGS_KEYS]);
  if (readError) throw dbError(readError, "No se pudo leer la configuración.");
  const before = new Map((current ?? []).map((r) => [r.key, r.value as unknown]));
  const rows = settingsToRows(data);
  const changed = changedKeys(before, rows);
  if (changed.length === 0) return { changed };

  const toWrite = rows.filter((r) => changed.includes(r.key));
  // Upsert: actualiza solo `value` en claves existentes (descripción e is_public se conservan).
  const { data: written, error } = await supabase.from("app_settings").upsert(toWrite, { onConflict: "key" }).select("key");
  if (error) throw dbError(error, "No se pudo guardar la configuración.");
  if ((written ?? []).length !== toWrite.length) {
    throw new AdminOpError("FORBIDDEN", "No tienes permiso para cambiar la configuración.");
  }
  await logAdminAction(supabase, { action: "settings.update", targetTable: "app_settings", targetId: null, metadata: { keys: changed } });
  return { changed };
}
