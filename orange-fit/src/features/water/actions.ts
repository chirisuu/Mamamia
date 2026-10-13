"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { getProfile, requireUser } from "@/lib/auth/session";
import { DEFAULT_TIMEZONE, todayInTz } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncAchievementsSafely } from "@/features/gamification/server/sync";
import { addWaterSchema, waterLogIdSchema, type AddWaterInput } from "./schemas";
import { addWater, deleteWaterLog, undoLastWater, WaterOpError, type WaterLog } from "./server/water";

/**
 * Agua: siempre se registra en el «hoy» del perfil (zona horaria del usuario), con el cliente con
 * sesión (RLS). Después se revalida /app (Inicio muestra el agua) y se evalúan logros en segundo plano.
 */
function revalidateWater() {
  revalidatePath("/app", "layout");
}

function toFail(error: unknown): ActionResult<never> {
  if (error instanceof WaterOpError) return fail(error.code, error.message);
  return fail("UNKNOWN", "Algo salió mal. Inténtalo de nuevo.");
}

async function today(): Promise<string> {
  const profile = await getProfile();
  return todayInTz(profile?.timezone || DEFAULT_TIMEZONE);
}

export async function addWaterAction(input: AddWaterInput): Promise<ActionResult<WaterLog>> {
  const user = await requireUser("/app/agua");
  const parsed = addWaterSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    const localDate = await today();
    const log = await addWater(supabase, user.id, { amountMl: parsed.data.amountMl, localDate });
    revalidateWater();
    after(() => syncAchievementsSafely(supabase, user.id, localDate));
    return ok(log);
  } catch (error) {
    return toFail(error);
  }
}

export async function undoLastWaterAction(): Promise<ActionResult<WaterLog | null>> {
  const user = await requireUser("/app/agua");
  try {
    const supabase = await createSupabaseServerClient();
    const removed = await undoLastWater(supabase, user.id, await today());
    revalidateWater();
    return ok(removed);
  } catch (error) {
    return toFail(error);
  }
}

export async function deleteWaterLogAction(id: string): Promise<ActionResult<null>> {
  const user = await requireUser("/app/agua");
  const parsed = waterLogIdSchema.safeParse(id);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    await deleteWaterLog(supabase, user.id, parsed.data);
    revalidateWater();
    return ok(null);
  } catch (error) {
    return toFail(error);
  }
}
