import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { Database } from "@/lib/db/database.types";
import { addDays } from "@/lib/dates";
import type { WeightEntry } from "@/lib/nutrition";
import type { TargetRowLite } from "../lib/targets-by-date";
import type { MeasurementRow, TotalsRow } from "../lib/analytics";
import { MEASUREMENT_FIELDS, type measurementSchema, type weightLogSchema } from "../schemas";

type Client = SupabaseClient<Database>;
type WeightValues = z.output<typeof weightLogSchema>;
type MeasurementValues = z.output<typeof measurementSchema>;

export class ProgressOpError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "DB_ERROR" | "INVALID_DATE",
    message: string,
  ) {
    super(message);
    this.name = "ProgressOpError";
  }
}

/** Fechas aceptadas: desde hace 5 años hasta hoy (zona del usuario). */
export function assertLoggableDate(localDate: string, today: string): void {
  if (localDate > today) throw new ProgressOpError("INVALID_DATE", "No puedes registrar una fecha futura.");
  if (localDate < addDays(today, -365 * 5)) throw new ProgressOpError("INVALID_DATE", "Esa fecha es demasiado antigua.");
}

export type WeightLogRow = {
  id: string;
  local_date: string;
  weight_kg: number;
  body_fat_pct: number | null;
  body_fat_method: string | null;
  note: string | null;
};

/** Un pesaje por día: si ya existe para esa fecha, se reemplaza (upsert por user_id + local_date). */
export async function upsertWeight(
  supabase: Client,
  userId: string,
  v: WeightValues,
  today: string,
): Promise<{ row: WeightLogRow; replaced: boolean }> {
  assertLoggableDate(v.localDate, today);
  const { data: existing, error: readError } = await supabase
    .from("weight_logs")
    .select("id")
    .eq("user_id", userId)
    .eq("local_date", v.localDate)
    .maybeSingle();
  if (readError) throw new ProgressOpError("DB_ERROR", "No se pudo guardar tu peso.");
  const { data, error } = await supabase
    .from("weight_logs")
    .upsert(
      {
        user_id: userId,
        local_date: v.localDate,
        weight_kg: v.weightKg,
        body_fat_pct: v.bodyFatPct,
        body_fat_method: v.bodyFatPct == null ? null : v.bodyFatMethod,
        note: v.note || null,
      },
      { onConflict: "user_id,local_date" },
    )
    .select("id, local_date, weight_kg, body_fat_pct, body_fat_method, note")
    .single();
  if (error || !data) throw new ProgressOpError("DB_ERROR", "No se pudo guardar tu peso.");
  return { row: data, replaced: Boolean(existing) };
}

export async function deleteWeight(supabase: Client, userId: string, id: string): Promise<void> {
  const { data, error } = await supabase.from("weight_logs").delete().eq("user_id", userId).eq("id", id).select("id");
  if (error) throw new ProgressOpError("DB_ERROR", "No se pudo borrar el pesaje.");
  if (!data?.length) throw new ProgressOpError("NOT_FOUND", "Ese pesaje ya no existe.");
}

/** Medidas del día: un registro por fecha; los campos vacíos quedan sin dato. */
export async function upsertMeasurements(
  supabase: Client,
  userId: string,
  v: MeasurementValues,
  today: string,
): Promise<{ id: string; replaced: boolean }> {
  assertLoggableDate(v.localDate, today);
  const { data: existing, error: readError } = await supabase
    .from("body_measurements")
    .select("id")
    .eq("user_id", userId)
    .eq("local_date", v.localDate)
    .maybeSingle();
  if (readError) throw new ProgressOpError("DB_ERROR", "No se pudieron guardar tus medidas.");
  const row: Database["public"]["Tables"]["body_measurements"]["Insert"] = { user_id: userId, local_date: v.localDate, note: v.note || null };
  for (const f of MEASUREMENT_FIELDS) row[f.column] = v[f.key];
  const { data, error } = await supabase.from("body_measurements").upsert(row, { onConflict: "user_id,local_date" }).select("id").single();
  if (error || !data) throw new ProgressOpError("DB_ERROR", "No se pudieron guardar tus medidas.");
  return { id: data.id, replaced: Boolean(existing) };
}

export async function deleteMeasurement(supabase: Client, userId: string, id: string): Promise<void> {
  const { data, error } = await supabase.from("body_measurements").delete().eq("user_id", userId).eq("id", id).select("id");
  if (error) throw new ProgressOpError("DB_ERROR", "No se pudo borrar el registro de medidas.");
  if (!data?.length) throw new ProgressOpError("NOT_FOUND", "Ese registro ya no existe.");
}

export type MeasurementRecord = MeasurementRow & { id: string; note: string | null };

export type ProgressData = {
  weights: WeightLogRow[];
  entries: WeightEntry[];
  measurements: MeasurementRecord[];
  targets: TargetRowLite[];
  totals: TotalsRow[];
  /** Última fecha cubierta por los datos. */
  today: string;
};

/** Lee lo necesario para /app/progreso: pesajes y medidas (hasta ~2 años) y 70 días de totales. */
export async function getProgressData(supabase: Client, userId: string, today: string): Promise<ProgressData> {
  const since = addDays(today, -730);
  const [weightsRes, measRes, targetsRes, totalsRes] = await Promise.all([
    supabase
      .from("weight_logs")
      .select("id, local_date, weight_kg, body_fat_pct, body_fat_method, note")
      .eq("user_id", userId)
      .gte("local_date", since)
      .lte("local_date", today)
      .order("local_date", { ascending: true }),
    supabase
      .from("body_measurements")
      .select("id, local_date, waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm, calf_cm, neck_cm, note")
      .eq("user_id", userId)
      .gte("local_date", since)
      .lte("local_date", today)
      .order("local_date", { ascending: true }),
    supabase
      .from("nutrition_targets")
      .select("effective_from, created_at, energy_kcal, protein_g, water_ml")
      .eq("user_id", userId)
      .lte("effective_from", today)
      .order("effective_from", { ascending: true }),
    supabase
      .from("daily_nutrition_totals")
      .select("local_date, energy_kcal, protein_g, items_count")
      .eq("user_id", userId)
      .gte("local_date", addDays(today, -69))
      .lte("local_date", today),
  ]);
  if (weightsRes.error || measRes.error || targetsRes.error || totalsRes.error) {
    throw new ProgressOpError("DB_ERROR", "No pudimos cargar tu progreso.");
  }
  const weights = (weightsRes.data ?? []).map((w) => ({ ...w, weight_kg: Number(w.weight_kg) }));
  return {
    weights,
    entries: weights.map((w) => ({ date: w.local_date, weightKg: w.weight_kg })),
    measurements: measRes.data ?? [],
    targets: targetsRes.data ?? [],
    totals: totalsRes.data ?? [],
    today,
  };
}
