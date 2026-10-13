"use server";

import { revalidatePath } from "next/cache";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { getProfile, requireUser } from "@/lib/auth/session";
import { DEFAULT_TIMEZONE, todayInTz } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fastingSessionIdSchema, startFastingSchema, type StartFastingInput } from "./schemas";
import { cancelFasting, endFasting, FastingOpError, startFasting, type FastingSession } from "./server/fasting";

const PATH = "/app/ayuno";

function toFail(error: unknown): ActionResult<never> {
  if (error instanceof FastingOpError) return fail(error.code, error.message);
  console.error("[fasting] action failed");
  return fail("UNKNOWN", "Algo salió mal. Inténtalo de nuevo.");
}

function revalidateFasting() {
  revalidatePath(PATH);
  revalidatePath("/app", "layout");
}

export async function startFastingAction(input: StartFastingInput): Promise<ActionResult<FastingSession>> {
  const user = await requireUser(PATH);
  const parsed = startFastingSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    const profile = await getProfile();
    const today = todayInTz(profile?.timezone || DEFAULT_TIMEZONE);
    const session = await startFasting(
      supabase,
      user.id,
      { ...parsed.data, customHours: parsed.data.protocol === "custom" ? parsed.data.customHours : null, note: parsed.data.note || null },
      today,
    );
    revalidateFasting();
    return ok(session);
  } catch (error) {
    return toFail(error);
  }
}

export async function endFastingAction(sessionId: string): Promise<ActionResult<{ hours: number; reached: boolean }>> {
  const user = await requireUser(PATH);
  const parsed = fastingSessionIdSchema.safeParse(sessionId);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    const { hours, reached } = await endFasting(supabase, user.id, parsed.data);
    revalidateFasting();
    return ok({ hours, reached });
  } catch (error) {
    return toFail(error);
  }
}

export async function cancelFastingAction(sessionId: string): Promise<ActionResult<null>> {
  const user = await requireUser(PATH);
  const parsed = fastingSessionIdSchema.safeParse(sessionId);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    await cancelFasting(supabase, user.id, parsed.data);
    revalidateFasting();
    return ok(null);
  } catch (error) {
    return toFail(error);
  }
}
