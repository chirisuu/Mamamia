import "server-only";
import { getProfile, requireUser } from "@/lib/auth/session";
import { DEFAULT_TIMEZONE, localDateInTz } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { localHourInTz, maxDiaryDate } from "../lib/meal-time";

/** Sesión, perfil, cliente y "hoy" en la zona del usuario para las páginas del diario. */
export async function getDiaryPageContext(path: string) {
  const user = await requireUser(path);
  const [profile, supabase] = await Promise.all([getProfile(), createSupabaseServerClient()]);
  const timezone = profile?.timezone ?? DEFAULT_TIMEZONE;
  const now = new Date();
  const today = localDateInTz(now, timezone);
  return {
    user,
    profile,
    supabase,
    timezone,
    today,
    tomorrow: maxDiaryDate(today),
    hour: localHourInTz(now, timezone),
  };
}

/** Comidas personalizadas que ya existen en una fecha (para ofrecerlas como destino). */
export async function getCustomMealNames(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  localDate: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("meal_logs")
    .select("custom_name, created_at")
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .eq("meal_type", "custom")
    .order("created_at", { ascending: true });
  return (data ?? []).flatMap((r) => (r.custom_name ? [r.custom_name] : []));
}
