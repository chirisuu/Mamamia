import "server-only";
import { cache } from "react";
import { DEFAULT_APP_NAME, isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FeatureFlags = Record<string, boolean>;

export type AppSettings = {
  appName: string;
  supportEmail: string | null;
  featureFlags: FeatureFlags;
  defaultTrialDays: number;
  maintenanceBanner: string | null;
};

const FALLBACK: AppSettings = {
  appName: DEFAULT_APP_NAME,
  supportEmail: null,
  featureFlags: {},
  defaultTrialDays: 7,
  maintenanceBanner: null,
};

/**
 * Configuración global (editable en /admin/configuracion). Si la BD no está
 * disponible se usan valores por defecto: el nombre de la app nunca rompe la página.
 */
export const getAppSettings = cache(async (): Promise<AppSettings> => {
  if (!isSupabaseConfigured()) return FALLBACK;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from("app_settings").select("key, value");
    if (error || !data) return FALLBACK;
    const map = new Map(data.map((r) => [r.key, r.value as unknown]));
    const str = (k: string) => {
      const v = map.get(k);
      return typeof v === "string" && v.trim() ? v.trim() : null;
    };
    const num = (k: string, d: number) => {
      const v = map.get(k);
      return typeof v === "number" && Number.isFinite(v) ? v : d;
    };
    const flags = map.get("feature_flags");
    return {
      appName: str("app_name") ?? FALLBACK.appName,
      supportEmail: str("support_email"),
      featureFlags: flags && typeof flags === "object" && !Array.isArray(flags) ? (flags as FeatureFlags) : {},
      defaultTrialDays: num("default_trial_days", FALLBACK.defaultTrialDays),
      maintenanceBanner: str("maintenance_banner"),
    };
  } catch {
    return FALLBACK;
  }
});
