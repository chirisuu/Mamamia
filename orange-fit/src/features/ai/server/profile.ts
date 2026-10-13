import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { DEFAULT_TIMEZONE } from "@/lib/dates";

/** Zona horaria del perfil (para fechas locales); America/Lima si no hay dato. */
export async function getUserTimezone(supabase: SupabaseClient<Database>, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle();
  return data?.timezone || DEFAULT_TIMEZONE;
}
