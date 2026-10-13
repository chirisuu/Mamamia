import "server-only";
import { cache } from "react";
import { getProfile, requireUser } from "@/lib/auth/session";
import { getActiveGoal, type UserGoalRow } from "@/lib/data/targets";
import { DEFAULT_TIMEZONE, localDateInTz } from "@/lib/dates";
import { parseHealthFlags, type HealthFlag } from "@/lib/nutrition";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Contexto común de las pantallas de seguimiento: sesión, perfil, zona horaria, «hoy» del usuario
 * y objetivo activo. Cacheado por request.
 */
export const getTrackingContext = cache(async (next: string) => {
  const user = await requireUser(next);
  const [profile, supabase] = await Promise.all([getProfile(), createSupabaseServerClient()]);
  const timeZone = profile?.timezone || DEFAULT_TIMEZONE;
  const now = new Date();
  const today = localDateInTz(now, timeZone);
  let goal: UserGoalRow | null = null;
  try {
    goal = await getActiveGoal(supabase, user.id);
  } catch {
    goal = null;
  }
  const healthFlags: HealthFlag[] = parseHealthFlags(goal?.health_flags);
  return {
    user,
    profile,
    supabase,
    timeZone,
    now,
    today,
    goal,
    healthFlags,
    /** Con antecedente de TCA no mostramos números de peso (igual que Inicio). */
    hideWeight: healthFlags.includes("eating_disorder_history"),
  };
});

export type TrackingContext = Awaited<ReturnType<typeof getTrackingContext>>;
