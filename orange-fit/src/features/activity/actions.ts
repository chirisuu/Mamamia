"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { getProfile, requireUser } from "@/lib/auth/session";
import { DEFAULT_TIMEZONE, todayInTz } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncAchievementsSafely } from "@/features/gamification/server/sync";
import { countExerciseSchema, exerciseIdSchema, logExerciseSchema, type LogExerciseInput } from "./schemas";
import { ActivityOpError, deleteExercise, logExercise, setCountExerciseCalories, type ExerciseLog } from "./server/activity";

const PATH = "/app/actividad";

function toFail(error: unknown): ActionResult<never> {
  if (error instanceof ActivityOpError) return fail(error.code, error.message);
  console.error("[activity] action failed");
  return fail("UNKNOWN", "Algo salió mal. Inténtalo de nuevo.");
}

/** Inicio muestra el presupuesto con el ejercicio: se revalida todo /app. */
function revalidateActivity() {
  revalidatePath("/app", "layout");
}

export async function logExerciseAction(input: LogExerciseInput): Promise<ActionResult<ExerciseLog>> {
  const user = await requireUser(PATH);
  const parsed = logExerciseSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    const profile = await getProfile();
    const today = todayInTz(profile?.timezone || DEFAULT_TIMEZONE);
    const log = await logExercise(supabase, user.id, parsed.data, today);
    revalidateActivity();
    after(() => syncAchievementsSafely(supabase, user.id, today));
    return ok(log);
  } catch (error) {
    return toFail(error);
  }
}

export async function deleteExerciseAction(id: string): Promise<ActionResult<null>> {
  const user = await requireUser(PATH);
  const parsed = exerciseIdSchema.safeParse(id);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    await deleteExercise(supabase, user.id, parsed.data);
    revalidateActivity();
    return ok(null);
  } catch (error) {
    return toFail(error);
  }
}

export async function setCountExerciseAction(value: boolean): Promise<ActionResult<{ value: boolean }>> {
  const user = await requireUser(PATH);
  const parsed = countExerciseSchema.safeParse(value);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    await setCountExerciseCalories(supabase, user.id, parsed.data);
    revalidateActivity();
    return ok({ value: parsed.data });
  } catch (error) {
    return toFail(error);
  }
}
