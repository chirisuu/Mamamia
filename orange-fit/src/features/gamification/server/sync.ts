import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/database.types";
import {
  aggregateHabitDays,
  evaluateBadges,
  evaluateChallenge,
  type ChallengeKind,
  type ChallengeProgress,
  type DailyHabitRecord,
} from "@/lib/nutrition";
import { createNotification } from "@/lib/notifications/notify";
import { sortTargets, targetForDate } from "@/features/progress/lib/targets-by-date";
import { buildHabitAggregates, toGamificationStats, type MealLogWithItems } from "../lib/habits";

/**
 * Logros evaluados en el servidor sobre agregados reales (src/lib/nutrition/gamification.ts):
 * otorga insignias nuevas (user_badges, idempotente), actualiza el avance de los retos activos y
 * marca los completados. Por cada logro nuevo crea una notificación. Nada se quita ni castiga.
 */
type Client = SupabaseClient<Database>;

export class AchievementsError extends Error {
  constructor(
    readonly code: "DB_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "AchievementsError";
  }
}

const CHALLENGE_KINDS: readonly ChallengeKind[] = ["water", "logging", "protein", "vegetables", "activity"];
/** El reto de desayuno cuenta solo los ítems del desayuno (su descripción lo pide). */
export const BREAKFAST_CHALLENGE_CODE = "breakfast_10_days";

export type BadgeView = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  icon: string;
  earned: boolean;
  earnedAt: string | null;
  current: number;
  target: number;
  progress: number;
};

export type ChallengeView = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  kind: ChallengeKind;
  /** Meta diaria efectiva (para agua: la meta de agua del usuario si la tiene). */
  dailyTarget: number;
  durationDays: number;
  active: { userChallengeId: string; startedOn: string; progress: ChallengeProgress } | null;
  timesCompleted: number;
  lastCompletedAt: string | null;
};

export type AchievementsSnapshot = {
  badges: BadgeView[];
  challenges: ChallengeView[];
  newlyEarnedBadges: string[];
  newlyCompletedChallenges: string[];
  totals: { loggingDays: number; waterGoalDays: number; proteinGoalDays: number; vegetableDays: number };
};

const PAGE = 1000;

async function fetchAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, what: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1);
    if (error) throw new AchievementsError("DB_ERROR", `No pudimos leer ${what}.`);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

function headCount(res: { count: number | null; error: unknown }, what: string): number {
  if (res.error) throw new AchievementsError("DB_ERROR", `No pudimos contar ${what}.`);
  return res.count ?? 0;
}

function isChallengeKind(v: string): v is ChallengeKind {
  return (CHALLENGE_KINDS as readonly string[]).includes(v);
}

export async function syncAchievements(supabase: Client, userId: string, today: string): Promise<AchievementsSnapshot> {
  const [badgesRes, earnedRes, challengesRes, userChallengesRes, recipesRes, weightsRes, plansRes, targetsRes] = await Promise.all([
    supabase.from("badges").select("id, code, name, description, icon, criteria").eq("is_active", true).order("created_at"),
    supabase.from("user_badges").select("badge_id, earned_at").eq("user_id", userId),
    supabase.from("challenges").select("id, code, title, description, kind, target_value, duration_days").eq("is_active", true).order("created_at"),
    supabase
      .from("user_challenges")
      .select("id, challenge_id, started_on, status, progress, completed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase.from("recipes").select("id", { count: "exact", head: true }).eq("owner_id", userId),
    supabase.from("weight_logs").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("meal_plans").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase
      .from("nutrition_targets")
      .select("effective_from, created_at, energy_kcal, protein_g, water_ml")
      .eq("user_id", userId)
      .lte("effective_from", today)
      .order("effective_from", { ascending: true }),
  ]);
  for (const [res, what] of [
    [badgesRes, "las insignias"],
    [earnedRes, "tus insignias"],
    [challengesRes, "los retos"],
    [userChallengesRes, "tus retos"],
    [targetsRes, "tus metas"],
  ] as const) {
    if (res.error) throw new AchievementsError("DB_ERROR", `No pudimos leer ${what}.`);
  }

  const [mealLogs, totals, water, exercise] = await Promise.all([
    fetchAll<MealLogWithItems>(
      (from, to) =>
        supabase
          .from("meal_logs")
          .select("local_date, meal_type, meal_log_items(name, grams, source)")
          .eq("user_id", userId)
          .lte("local_date", today)
          .order("local_date")
          .order("id")
          .range(from, to),
      "tu diario",
    ),
    fetchAll(
      (from, to) =>
        supabase
          .from("daily_nutrition_totals")
          .select("local_date, protein_g, items_count")
          .eq("user_id", userId)
          .lte("local_date", today)
          .order("local_date")
          .range(from, to),
      "tus totales",
    ),
    fetchAll(
      (from, to) =>
        supabase
          .from("water_logs")
          .select("local_date, amount_ml")
          .eq("user_id", userId)
          .lte("local_date", today)
          .order("local_date")
          .order("id")
          .range(from, to),
      "tu agua",
    ),
    fetchAll(
      (from, to) =>
        supabase
          .from("exercise_logs")
          .select("local_date, duration_min")
          .eq("user_id", userId)
          .lte("local_date", today)
          .order("local_date")
          .order("id")
          .range(from, to),
      "tu actividad",
    ),
  ]);

  const targets = targetsRes.data ?? [];
  const agg = buildHabitAggregates({ mealLogs, totals, water, exercise, targets });
  const habitDays = aggregateHabitDays(agg.days);
  const currentWaterTarget = targetForDate(sortTargets(targets), today)?.water_ml ?? null;

  // --- Retos activos -------------------------------------------------------------------------
  const challenges = (challengesRes.data ?? []).filter((c) => isChallengeKind(c.kind));
  const byId = new Map(challenges.map((c) => [c.id, c]));
  const userChallenges = userChallengesRes.data ?? [];
  const newlyCompletedChallenges: string[] = [];
  const activeProgress = new Map<string, { userChallengeId: string; startedOn: string; progress: ChallengeProgress }>();

  const dailyTargetOf = (c: (typeof challenges)[number]) =>
    c.kind === "water" && currentWaterTarget != null && currentWaterTarget > 0 ? Number(currentWaterTarget) : Number(c.target_value);

  for (const uc of userChallenges.filter((u) => u.status === "active")) {
    const c = byId.get(uc.challenge_id);
    if (!c) continue;
    const days: DailyHabitRecord[] = c.code === BREAKFAST_CHALLENGE_CODE ? agg.breakfastDays : agg.days;
    const progress = evaluateChallenge(
      { kind: c.kind as ChallengeKind, targetValue: dailyTargetOf(c), durationDays: c.duration_days },
      { startedOn: uc.started_on, today, days },
    );
    activeProgress.set(c.id, { userChallengeId: uc.id, startedOn: uc.started_on, progress });
    const stored = (uc.progress ?? {}) as { qualifyingDays?: number };
    if (progress.completed) {
      const { data } = await supabase
        .from("user_challenges")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          progress: { qualifyingDays: progress.qualifyingDays, requiredDays: progress.requiredDays, completedOn: progress.completedOn } as NonNullable<Json>,
        })
        .eq("id", uc.id)
        .eq("user_id", userId)
        .eq("status", "active")
        .select("id");
      if (data?.length) {
        newlyCompletedChallenges.push(c.code);
        uc.status = "completed";
        uc.completed_at = new Date().toISOString();
        activeProgress.delete(c.id);
      }
    } else if (stored.qualifyingDays !== progress.qualifyingDays) {
      await supabase
        .from("user_challenges")
        .update({ progress: { qualifyingDays: progress.qualifyingDays, requiredDays: progress.requiredDays, evaluatedOn: today } as NonNullable<Json> })
        .eq("id", uc.id)
        .eq("user_id", userId)
        .eq("status", "active");
    }
  }

  const challengesCompleted = userChallenges.filter((u) => u.status === "completed").length;

  // --- Insignias -------------------------------------------------------------------------------
  const stats = toGamificationStats(agg, habitDays, {
    recipesCreated: headCount(recipesRes, "tus recetas"),
    weightLogsTotal: headCount(weightsRes, "tus pesajes"),
    mealPlansCreated: headCount(plansRes, "tus planes"),
    challengesCompleted,
  });
  const badges = badgesRes.data ?? [];
  const earnedAt = new Map((earnedRes.data ?? []).map((e) => [e.badge_id, e.earned_at]));
  const earnedCodes = badges.filter((b) => earnedAt.has(b.id)).map((b) => b.code);
  const evaluation = evaluateBadges(
    badges.map((b) => ({ code: b.code, criteria: b.criteria })),
    stats,
    earnedCodes,
  );

  const newlyEarnedBadges: string[] = [];
  if (evaluation.newlyEarned.length > 0) {
    const toInsert = badges.filter((b) => evaluation.newlyEarned.includes(b.code));
    const { data: inserted, error } = await supabase
      .from("user_badges")
      .upsert(
        toInsert.map((b) => ({ user_id: userId, badge_id: b.id })),
        { onConflict: "user_id,badge_id", ignoreDuplicates: true },
      )
      .select("badge_id, earned_at");
    if (error) throw new AchievementsError("DB_ERROR", "No pudimos guardar tus insignias.");
    for (const row of inserted ?? []) {
      earnedAt.set(row.badge_id, row.earned_at);
      const badge = toInsert.find((b) => b.id === row.badge_id);
      if (badge) newlyEarnedBadges.push(badge.code);
    }
  }

  // --- Avisos de logros nuevos (solo los que este proceso insertó/completó) ----------------------
  for (const code of newlyEarnedBadges) {
    const badge = badges.find((b) => b.code === code);
    if (!badge) continue;
    await createNotification(supabase, userId, {
      type: "badge_earned",
      title: `¡Nueva insignia: ${badge.name}!`,
      body: badge.description,
      url: "/app/logros",
    });
  }
  for (const code of newlyCompletedChallenges) {
    const c = challenges.find((x) => x.code === code);
    if (!c) continue;
    await createNotification(supabase, userId, {
      type: "challenge_completed",
      title: `¡Completaste el reto «${c.title}»!`,
      body: "Bien hecho. Puedes volver a intentarlo o elegir otro cuando quieras.",
      url: "/app/logros",
    });
  }

  const resultsByCode = new Map(evaluation.results.map((r) => [r.code, r]));
  const badgeViews: BadgeView[] = badges
    .map((b) => {
      const r = resultsByCode.get(b.code);
      return {
        id: b.id,
        code: b.code,
        name: b.name,
        description: b.description,
        icon: b.icon,
        earned: earnedAt.has(b.id),
        earnedAt: earnedAt.get(b.id) ?? null,
        current: r?.current ?? 0,
        target: r?.target ?? 0,
        progress: earnedAt.has(b.id) ? 1 : (r?.progress ?? 0),
        supported: r?.supported ?? false,
      };
    })
    // Criterios que la app no sabe medir no se muestran (ni como pendientes).
    .filter((b) => b.supported || b.earned)
    .map(({ supported: _supported, ...rest }) => rest);

  const challengeViews: ChallengeView[] = challenges.map((c) => {
    const done = userChallenges.filter((u) => u.challenge_id === c.id && u.status === "completed");
    return {
      id: c.id,
      code: c.code,
      title: c.title,
      description: c.description,
      kind: c.kind as ChallengeKind,
      dailyTarget: dailyTargetOf(c),
      durationDays: c.duration_days,
      active: activeProgress.get(c.id) ?? null,
      timesCompleted: done.length,
      lastCompletedAt: done.map((u) => u.completed_at).filter((d): d is string => Boolean(d)).sort().at(-1) ?? null,
    };
  });

  return {
    badges: badgeViews,
    challenges: challengeViews,
    newlyEarnedBadges,
    newlyCompletedChallenges,
    totals: habitDays,
  };
}

/** Para llamar en segundo plano (after) tras registrar algo: nunca lanza. */
export async function syncAchievementsSafely(supabase: Client, userId: string, today: string): Promise<void> {
  try {
    await syncAchievements(supabase, userId, today);
  } catch (error) {
    console.error("[achievements] sync failed", { code: error instanceof AchievementsError ? error.code : "UNKNOWN" });
  }
}
