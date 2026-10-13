import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { getActiveGoal } from "@/lib/data/targets";
import { addDays } from "@/lib/dates";
import { NutritionInputError, type ExerciseIntensity } from "@/lib/nutrition";
import { catalogExerciseRow, manualExerciseRow, resolveExerciseWeight, type ExerciseInsert, type WeightSource } from "../lib/activity-calc";
import type { logExerciseSchema } from "../schemas";
import type { z } from "zod";

type Client = SupabaseClient<Database>;
type LogValues = z.output<typeof logExerciseSchema>;

/** Hasta cuántos días atrás se puede registrar actividad. */
export const EXERCISE_BACKFILL_DAYS = 60;

export type ActivityOpCode = "NO_WEIGHT" | "INVALID_DATE" | "INVALID_ACTIVITY" | "NOT_FOUND" | "DB_ERROR";

export class ActivityOpError extends Error {
  constructor(
    readonly code: ActivityOpCode,
    message: string,
  ) {
    super(message);
    this.name = "ActivityOpError";
  }
}

export type ExerciseLog = {
  id: string;
  localDate: string;
  activityCode: string;
  activityName: string;
  met: number | null;
  durationMin: number;
  intensity: ExerciseIntensity | null;
  energyKcal: number;
  energySource: "met_estimate" | "manual" | "device";
  note: string | null;
};

const COLUMNS = "id, local_date, activity_code, activity_name, met, duration_min, intensity, energy_kcal, energy_source, note";

type Row = Pick<
  Database["public"]["Tables"]["exercise_logs"]["Row"],
  "id" | "local_date" | "activity_code" | "activity_name" | "met" | "duration_min" | "intensity" | "energy_kcal" | "energy_source" | "note"
>;

const toLog = (r: Row): ExerciseLog => ({
  id: r.id,
  localDate: r.local_date,
  activityCode: r.activity_code,
  activityName: r.activity_name,
  met: r.met == null ? null : Number(r.met),
  durationMin: r.duration_min,
  intensity: (r.intensity as ExerciseIntensity | null) ?? null,
  energyKcal: Number(r.energy_kcal),
  energySource: r.energy_source as ExerciseLog["energySource"],
  note: r.note,
});

/** Peso para estimar en una fecha: último pesaje hasta ese día; si no hay, el del objetivo activo. */
export async function getExerciseWeight(
  supabase: Client,
  userId: string,
  onDate: string,
): Promise<{ weightKg: number; source: WeightSource } | null> {
  const [{ data, error }, goal] = await Promise.all([
    supabase.from("weight_logs").select("weight_kg").eq("user_id", userId).lte("local_date", onDate).order("local_date", { ascending: false }).limit(1),
    getActiveGoal(supabase, userId),
  ]);
  if (error) throw new ActivityOpError("DB_ERROR", "No pudimos leer tu peso.");
  const logKg = data?.[0]?.weight_kg;
  return resolveExerciseWeight(logKg == null ? null : Number(logKg), goal?.current_weight_kg == null ? null : Number(goal.current_weight_kg));
}

function assertDate(localDate: string, today: string) {
  if (localDate > today) throw new ActivityOpError("INVALID_DATE", "No puedes registrar actividad en una fecha futura.");
  if (localDate < addDays(today, -EXERCISE_BACKFILL_DAYS)) {
    throw new ActivityOpError("INVALID_DATE", `Puedes registrar actividad de hasta ${EXERCISE_BACKFILL_DAYS} días atrás.`);
  }
}

/** Registra una sesión. Las kcal del catálogo se calculan aquí (nunca se aceptan del cliente). */
export async function logExercise(supabase: Client, userId: string, v: LogValues, today: string): Promise<ExerciseLog> {
  assertDate(v.localDate, today);
  let row: ExerciseInsert;
  if (v.mode === "catalog") {
    const weight = await getExerciseWeight(supabase, userId, v.localDate);
    if (!weight) {
      throw new ActivityOpError("NO_WEIGHT", "Para estimar las calorías necesitamos tu peso. Regístralo en Progreso y vuelve a intentarlo.");
    }
    try {
      row = catalogExerciseRow(v.code, v.durationMin, weight.weightKg).row;
    } catch (error) {
      if (error instanceof NutritionInputError) throw new ActivityOpError("INVALID_ACTIVITY", error.message);
      throw error;
    }
  } else {
    row = manualExerciseRow({ name: v.name, durationMin: v.durationMin, intensity: v.intensity, energyKcal: v.energyKcal });
  }
  const { data, error } = await supabase
    .from("exercise_logs")
    .insert({ ...row, user_id: userId, local_date: v.localDate, note: v.note || null })
    .select(COLUMNS)
    .single();
  if (error || !data) throw new ActivityOpError("DB_ERROR", "No pudimos guardar tu actividad.");
  return toLog(data);
}

export async function deleteExercise(supabase: Client, userId: string, id: string): Promise<void> {
  const { data, error } = await supabase.from("exercise_logs").delete().eq("user_id", userId).eq("id", id).select("id");
  if (error) throw new ActivityOpError("DB_ERROR", "No pudimos borrar el registro.");
  if (!data?.length) throw new ActivityOpError("NOT_FOUND", "Ese registro ya no existe.");
}

/** Interruptor del perfil: sumar (o no) las kcal netas del ejercicio al presupuesto del día. */
export async function setCountExerciseCalories(supabase: Client, userId: string, value: boolean): Promise<void> {
  const { error } = await supabase.from("profiles").update({ count_exercise_calories: value }).eq("id", userId);
  if (error) throw new ActivityOpError("DB_ERROR", "No pudimos guardar tu preferencia.");
}

export type ActivityPageData = {
  logs: ExerciseLog[];
  weight: { weightKg: number; source: WeightSource } | null;
};

export async function getActivityPageData(supabase: Client, userId: string, today: string): Promise<ActivityPageData> {
  const [logsRes, weight] = await Promise.all([
    supabase
      .from("exercise_logs")
      .select(COLUMNS)
      .eq("user_id", userId)
      .gte("local_date", addDays(today, -EXERCISE_BACKFILL_DAYS))
      .lte("local_date", today)
      .order("local_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300),
    getExerciseWeight(supabase, userId, today),
  ]);
  if (logsRes.error) throw new ActivityOpError("DB_ERROR", "No pudimos cargar tu actividad.");
  return { logs: (logsRes.data ?? []).map(toLog), weight };
}
