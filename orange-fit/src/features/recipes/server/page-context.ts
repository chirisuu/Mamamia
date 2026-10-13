import "server-only";
import { getProfile, requireUser } from "@/lib/auth/session";
import { addDays, DEFAULT_TIMEZONE, localDateInTz } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { localHourInTz, mealForHour } from "../lib/meal-time";

/** Sesión, cliente, perfil y "hoy" (zona del perfil) para las páginas de recetas, plan y compras. */
export async function getRecipesPageContext(path: string) {
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
    tomorrow: addDays(today, 1),
    currency: profile?.currency_code ?? "PEN",
    defaultMeal: mealForHour(localHourInTz(now, timezone)),
  };
}
