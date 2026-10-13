"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { getProfile, requireUser } from "@/lib/auth/session";
import { DEFAULT_TIMEZONE, todayInTz } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncAchievementsSafely } from "@/features/gamification/server/sync";
import { measurementSchema, recordIdSchema, weightLogSchema, type MeasurementInput, type WeightLogInput } from "./schemas";
import { deleteMeasurement, deleteWeight, ProgressOpError, upsertMeasurements, upsertWeight } from "./server/progress";

function toFail(error: unknown): ActionResult<never> {
  if (error instanceof ProgressOpError) return fail(error.code, error.message);
  return fail("UNKNOWN", "Algo salió mal. Inténtalo de nuevo.");
}

async function userToday(): Promise<string> {
  const profile = await getProfile();
  return todayInTz(profile?.timezone || DEFAULT_TIMEZONE);
}

function revalidateProgress() {
  revalidatePath("/app", "layout");
}

export async function logWeightAction(input: WeightLogInput): Promise<ActionResult<{ replaced: boolean }>> {
  const user = await requireUser("/app/progreso");
  const parsed = weightLogSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    const today = await userToday();
    const { replaced } = await upsertWeight(supabase, user.id, parsed.data, today);
    revalidateProgress();
    after(() => syncAchievementsSafely(supabase, user.id, today));
    return ok({ replaced });
  } catch (error) {
    return toFail(error);
  }
}

export async function deleteWeightAction(id: string): Promise<ActionResult<null>> {
  const user = await requireUser("/app/progreso");
  const parsed = recordIdSchema.safeParse(id);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    await deleteWeight(supabase, user.id, parsed.data);
    revalidateProgress();
    return ok(null);
  } catch (error) {
    return toFail(error);
  }
}

export async function logMeasurementsAction(input: MeasurementInput): Promise<ActionResult<{ replaced: boolean }>> {
  const user = await requireUser("/app/progreso");
  const parsed = measurementSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    const { replaced } = await upsertMeasurements(supabase, user.id, parsed.data, await userToday());
    revalidatePath("/app/progreso");
    return ok({ replaced });
  } catch (error) {
    return toFail(error);
  }
}

export async function deleteMeasurementAction(id: string): Promise<ActionResult<null>> {
  const user = await requireUser("/app/progreso");
  const parsed = recordIdSchema.safeParse(id);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    await deleteMeasurement(supabase, user.id, parsed.data);
    revalidatePath("/app/progreso");
    return ok(null);
  } catch (error) {
    return toFail(error);
  }
}
