import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Client = SupabaseClient<Database>;
export type NutritionTargetRow = Database["public"]["Tables"]["nutrition_targets"]["Row"];
export type UserGoalRow = Database["public"]["Tables"]["user_goals"]["Row"];

/** Meta vigente en una fecha: mayor effective_from ≤ fecha, desempate por created_at. */
export async function getActiveTargets(supabase: Client, userId: string, onDate: string): Promise<NutritionTargetRow | null> {
  const { data } = await supabase
    .from("nutrition_targets")
    .select("*")
    .eq("user_id", userId)
    .lte("effective_from", onDate)
    .order("effective_from", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}

export async function getActiveGoal(supabase: Client, userId: string): Promise<UserGoalRow | null> {
  const { data } = await supabase.from("user_goals").select("*").eq("user_id", userId).eq("is_active", true).maybeSingle();
  return data;
}
