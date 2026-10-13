"use server";

import { revalidatePath } from "next/cache";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { getProfile, requireUser } from "@/lib/auth/session";
import { DEFAULT_TIMEZONE, todayInTz } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { challengeIdSchema, userChallengeIdSchema } from "./schemas";
import { abandonChallenge, ChallengeOpError, joinChallenge } from "./server/challenges";
import { AchievementsError, syncAchievements } from "./server/sync";

function toFail(error: unknown): ActionResult<never> {
  if (error instanceof ChallengeOpError || error instanceof AchievementsError) return fail(error.code, error.message);
  return fail("UNKNOWN", "Algo salió mal. Inténtalo de nuevo.");
}

export async function joinChallengeAction(challengeId: string): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser("/app/logros");
  const parsed = challengeIdSchema.safeParse(challengeId);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    const profile = await getProfile();
    const today = todayInTz(profile?.timezone || DEFAULT_TIMEZONE);
    const res = await joinChallenge(supabase, user.id, parsed.data, today);
    // Si hoy ya cumple, el avance se ve al momento.
    await syncAchievements(supabase, user.id, today).catch(() => undefined);
    revalidatePath("/app/logros");
    return ok(res);
  } catch (error) {
    return toFail(error);
  }
}

export async function abandonChallengeAction(userChallengeId: string): Promise<ActionResult<null>> {
  const user = await requireUser("/app/logros");
  const parsed = userChallengeIdSchema.safeParse(userChallengeId);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    await abandonChallenge(supabase, user.id, parsed.data);
    revalidatePath("/app/logros");
    return ok(null);
  } catch (error) {
    return toFail(error);
  }
}
