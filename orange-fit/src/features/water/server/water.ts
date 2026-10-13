import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { addDays } from "@/lib/dates";
import { waterSeries, type WaterDay } from "../lib/water-stats";

type Client = SupabaseClient<Database>;

export class WaterOpError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "DB_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "WaterOpError";
  }
}

export type WaterLog = { id: string; amountMl: number; loggedAt: string };

export async function addWater(supabase: Client, userId: string, input: { amountMl: number; localDate: string }): Promise<WaterLog> {
  const { data, error } = await supabase
    .from("water_logs")
    .insert({ user_id: userId, local_date: input.localDate, amount_ml: input.amountMl })
    .select("id, amount_ml, logged_at")
    .single();
  if (error || !data) throw new WaterOpError("DB_ERROR", "No se pudo guardar el agua.");
  return { id: data.id, amountMl: data.amount_ml, loggedAt: data.logged_at };
}

/** Borra el registro más reciente del día. null si no había ninguno. */
export async function undoLastWater(supabase: Client, userId: string, localDate: string): Promise<WaterLog | null> {
  const { data, error } = await supabase
    .from("water_logs")
    .select("id, amount_ml, logged_at")
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .order("logged_at", { ascending: false })
    .limit(1);
  if (error) throw new WaterOpError("DB_ERROR", "No se pudo deshacer.");
  const last = data?.[0];
  if (!last) return null;
  await deleteWaterLog(supabase, userId, last.id);
  return { id: last.id, amountMl: last.amount_ml, loggedAt: last.logged_at };
}

export async function deleteWaterLog(supabase: Client, userId: string, id: string): Promise<void> {
  const { data, error } = await supabase.from("water_logs").delete().eq("user_id", userId).eq("id", id).select("id");
  if (error) throw new WaterOpError("DB_ERROR", "No se pudo borrar el registro.");
  if (!data?.length) throw new WaterOpError("NOT_FOUND", "Ese registro ya no existe.");
}

export type WaterPageData = {
  today: string;
  todayLogs: WaterLog[];
  consumedMl: number;
  targetMl: number | null;
  /** Últimos 30 días (incluye hoy). */
  history: WaterDay[];
};

export async function getWaterPageData(supabase: Client, userId: string, today: string): Promise<WaterPageData> {
  const since = addDays(today, -29);
  const [todayRes, historyRes, targetsRes] = await Promise.all([
    supabase
      .from("water_logs")
      .select("id, amount_ml, logged_at")
      .eq("user_id", userId)
      .eq("local_date", today)
      .order("logged_at", { ascending: false }),
    supabase.from("water_logs").select("local_date, amount_ml").eq("user_id", userId).gte("local_date", since).lte("local_date", today),
    supabase
      .from("nutrition_targets")
      .select("effective_from, created_at, energy_kcal, protein_g, water_ml")
      .eq("user_id", userId)
      .lte("effective_from", today)
      .order("effective_from", { ascending: true }),
  ]);
  if (todayRes.error || historyRes.error || targetsRes.error) throw new WaterOpError("DB_ERROR", "No pudimos cargar tu registro de agua.");
  const todayLogs = (todayRes.data ?? []).map((l) => ({ id: l.id, amountMl: l.amount_ml, loggedAt: l.logged_at }));
  const history = waterSeries(historyRes.data ?? [], targetsRes.data ?? [], today, 30);
  return {
    today,
    todayLogs,
    consumedMl: todayLogs.reduce((s, l) => s + l.amountMl, 0),
    targetMl: history.at(-1)?.targetMl ?? null,
    history,
  };
}
