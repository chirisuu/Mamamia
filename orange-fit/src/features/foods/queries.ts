import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProfile, requireUser } from "@/lib/auth/session";
import { DEFAULT_TIMEZONE, localDateInTz } from "@/lib/dates";
import type { Database } from "@/lib/db/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Client = SupabaseClient<Database>;

/** Hora local (0–23) en la zona del perfil. */
function localHour(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return Number.isFinite(hour) ? hour % 24 : 0;
}

/** Sesión, cliente y "hoy" (y la hora) en la zona del usuario para la pantalla del escáner. */
export async function getBarcodePageContext(path: string) {
  const user = await requireUser(path);
  const [profile, supabase] = await Promise.all([getProfile(), createSupabaseServerClient()]);
  const timezone = profile?.timezone ?? DEFAULT_TIMEZONE;
  const now = new Date();
  return { user, supabase, timezone, today: localDateInTz(now, timezone), hour: localHour(now, timezone) };
}

/** Comidas personalizadas que ya existen ese día (para ofrecerlas como destino). */
export async function getCustomMealNames(supabase: Client, userId: string, localDate: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("meal_logs")
    .select("custom_name")
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .eq("meal_type", "custom")
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []).flatMap((r) => (r.custom_name ? [r.custom_name] : []));
}
