import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/auth/session";
import type { Database } from "@/lib/db/database.types";
import { addDays, DEFAULT_TIMEZONE, diffDays, localDateInTz } from "@/lib/dates";
import {
  computeStreaks,
  summarizePeriod,
  weightTrend,
  type Streaks,
  type TrendConfidence,
} from "@/lib/nutrition";
import { defaultMealForHour, greetingForHour, localHourInTz, type StandardMeal } from "@/features/diary/lib/meal-time";
import type { MealType } from "@/features/diary/types";
import { buildBudgetBreakdown, type BudgetBreakdown } from "./lib/budget";
import { computeRecommendations, pickHighProteinRecipes, type Recommendation, type RecommendationInput } from "./lib/recommendations";
import { computeReminders, type Reminder } from "./lib/reminders";
import { buildDayIntakes, buildWeeklySeries, targetForDate, type WeeklyPoint } from "./lib/series";

/**
 * Datos de Inicio. Todo se lee con la sesión del usuario (RLS) y se calcula con el motor
 * nutricional. Si una sección secundaria falla, se marca como no disponible en vez de inventarla.
 */

type Client = SupabaseClient<Database>;

export class DashboardError extends Error {
  constructor() {
    super("No pudimos cargar tu resumen.");
    this.name = "DashboardError";
  }
}

export type DashboardTarget = {
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  waterMl: number | null;
};

export type DashboardData = {
  today: string;
  hour: number;
  greeting: string;
  displayName: string | null;
  defaultMeal: StandardMeal;
  target: DashboardTarget | null;
  budget: BudgetBreakdown | null;
  consumed: {
    itemsCount: number;
    energyKcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number;
    /** Algún alimento de hoy no trae fibra: el total es un mínimo. */
    fiberIncomplete: boolean;
  };
  exercise: { loggedKcal: number; sessions: number; counted: boolean } | null;
  water: { ml: number; targetMl: number | null } | null;
  weight: {
    latestKg: number | null;
    latestDate: string | null;
    avg7Kg: number | null;
    weeklyRateKg: number | null;
    confidence: TrendConfidence;
  } | null;
  showWeight: boolean;
  streaks: Streaks | null;
  weekly: WeeklyPoint[];
  reminders: Reminder[];
  notifications: { unreadCount: number; items: Array<{ id: string; title: string; body: string | null; url: string | null }> } | null;
  recommendations: Recommendation[];
  isNewUser: boolean;
};

const HISTORY_DAYS = 120;

export async function getDashboardData(supabase: Client, userId: string, profile: Profile | null, now = new Date()): Promise<DashboardData> {
  const tz = profile?.timezone ?? DEFAULT_TIMEZONE;
  const today = localDateInTz(now, tz);
  const hour = localHourInTz(now, tz);
  const since = addDays(today, -(HISTORY_DAYS - 1));

  const [targetsRes, totalsRes, todayLogsRes, exerciseRes, waterRes, weightRes, lastWeightRes, notifRes, notifCountRes, goalRes] =
    await Promise.all([
      supabase
        .from("nutrition_targets")
        .select("effective_from, created_at, energy_kcal, protein_g, carbs_g, fat_g, fiber_g, water_ml")
        .eq("user_id", userId)
        .lte("effective_from", today)
        .order("effective_from", { ascending: true }),
      supabase
        .from("daily_nutrition_totals")
        .select("local_date, energy_kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, items_count")
        .eq("user_id", userId)
        .gte("local_date", since)
        .lte("local_date", today),
      supabase
        .from("meal_logs")
        .select("meal_type, meal_log_items(fiber_g, sodium_mg)")
        .eq("user_id", userId)
        .eq("local_date", today),
      supabase.from("exercise_logs").select("energy_kcal").eq("user_id", userId).eq("local_date", today),
      supabase.from("water_logs").select("amount_ml").eq("user_id", userId).eq("local_date", today),
      supabase
        .from("weight_logs")
        .select("local_date, weight_kg")
        .eq("user_id", userId)
        .gte("local_date", addDays(today, -59))
        .lte("local_date", today)
        .order("local_date", { ascending: true }),
      supabase
        .from("weight_logs")
        .select("local_date, weight_kg")
        .eq("user_id", userId)
        .lte("local_date", today)
        .order("local_date", { ascending: false })
        .limit(1),
      supabase
        .from("notifications")
        .select("id, title, body, url")
        .eq("user_id", userId)
        .is("read_at", null)
        .or(`scheduled_for.is.null,scheduled_for.lte.${now.toISOString()}`)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null)
        .or(`scheduled_for.is.null,scheduled_for.lte.${now.toISOString()}`),
      supabase.from("user_goals").select("health_flags").eq("user_id", userId).eq("is_active", true).maybeSingle(),
    ]);

  // Sin metas ni totales no hay resumen confiable: mejor decirlo que mostrar ceros.
  if (targetsRes.error || totalsRes.error || todayLogsRes.error) throw new DashboardError();

  const targets = (targetsRes.data ?? []).map((t) => ({ ...t, energy_kcal: Number(t.energy_kcal), protein_g: Number(t.protein_g) }));
  const totals = totalsRes.data ?? [];
  const todayRow = totals.find((t) => t.local_date === today);
  const activeTarget = targetForDate(targets, today);
  const target: DashboardTarget | null = activeTarget
    ? {
        energyKcal: Number(activeTarget.energy_kcal),
        proteinG: Number(activeTarget.protein_g),
        carbsG: Number(activeTarget.carbs_g),
        fatG: Number(activeTarget.fat_g),
        fiberG: activeTarget.fiber_g == null ? null : Number(activeTarget.fiber_g),
        waterMl: activeTarget.water_ml == null ? null : Number(activeTarget.water_ml),
      }
    : null;

  const todayItems = (todayLogsRes.data ?? []).flatMap((l) => (l.meal_log_items ?? []).map((i) => ({ ...i, mealType: l.meal_type })));
  const loggedMeals = [...new Set(todayItems.map((i) => i.mealType))] as MealType[];
  const consumed = {
    itemsCount: Number(todayRow?.items_count ?? 0),
    energyKcal: Number(todayRow?.energy_kcal ?? 0),
    proteinG: Number(todayRow?.protein_g ?? 0),
    carbsG: Number(todayRow?.carbs_g ?? 0),
    fatG: Number(todayRow?.fat_g ?? 0),
    fiberG: Number(todayRow?.fiber_g ?? 0),
    fiberIncomplete: todayItems.some((i) => i.fiber_g == null),
  };
  const sodiumKnown = todayItems.some((i) => i.sodium_mg != null);
  const sodiumIncomplete = todayItems.some((i) => i.sodium_mg == null);

  const countExercise = Boolean(profile?.count_exercise_calories);
  const exercise = exerciseRes.error
    ? null
    : {
        loggedKcal: (exerciseRes.data ?? []).reduce((s, e) => s + Number(e.energy_kcal), 0),
        sessions: exerciseRes.data?.length ?? 0,
        counted: countExercise,
      };

  const budget = target
    ? buildBudgetBreakdown({
        targetKcal: target.energyKcal,
        exerciseKcal: exercise?.loggedKcal ?? 0,
        countExercise,
        adjustmentsKcal: 0,
        consumedKcal: consumed.energyKcal,
      })
    : null;

  const water = waterRes.error
    ? null
    : { ml: (waterRes.data ?? []).reduce((s, w) => s + Number(w.amount_ml), 0), targetMl: target?.waterMl ?? null };

  const healthFlags = goalRes.data?.health_flags ?? [];
  const showWeight = !healthFlags.includes("eating_disorder_history");
  const weightEntries = (weightRes.data ?? []).map((w) => ({ date: w.local_date, weightKg: Number(w.weight_kg) }));
  const latest = lastWeightRes.data?.[0] ?? null;
  let weight: DashboardData["weight"] = null;
  if (!weightRes.error && !lastWeightRes.error) {
    const trend = weightEntries.length ? weightTrend(weightEntries.slice(-35)) : null;
    weight = {
      latestKg: latest ? Number(latest.weight_kg) : null,
      latestDate: latest?.local_date ?? null,
      avg7Kg: summarizePeriod(weightEntries, addDays(today, -6), today)?.averageKg ?? null,
      weeklyRateKg: trend?.weeklyRateKg ?? null,
      confidence: trend?.confidence ?? "insufficient",
    };
  }

  const intakes = buildDayIntakes(totals, targets);
  const streaks = intakes.length ? computeStreaks(intakes, today) : null;
  const weekly = buildWeeklySeries(today, totals, targets);
  const isNewUser = totals.every((t) => Number(t.items_count ?? 0) === 0);

  const reminders = computeReminders({
    hour,
    today,
    loggedMeals,
    waterMl: water?.ml ?? 0,
    waterTargetMl: water ? water.targetMl : null,
    lastWeightDate: weight?.latestDate ?? null,
    showWeightReminders: showWeight && weight !== null,
    hasTarget: target !== null,
  });

  const yesterday = totals.find((t) => t.local_date === addDays(today, -1));
  const recoInput: RecommendationInput = {
    hour,
    today: {
      itemsCount: consumed.itemsCount,
      energyKcal: consumed.energyKcal,
      proteinG: consumed.proteinG,
      fiberG: consumed.itemsCount ? consumed.fiberG : null,
      sodiumMg: sodiumKnown ? Number(todayRow?.sodium_mg ?? 0) : null,
      incomplete: [...(consumed.fiberIncomplete ? ["fiberG"] : []), ...(sodiumIncomplete ? ["sodiumMg"] : [])],
    },
    yesterday: yesterday
      ? { logged: Number(yesterday.items_count ?? 0) > 0, proteinG: Number(yesterday.protein_g ?? 0) }
      : null,
    target: target ? { energyKcal: target.energyKcal, proteinG: target.proteinG, fiberG: target.fiberG } : null,
    daysLoggedLast7: totals.filter((t) => t.local_date && t.local_date < today && diffDays(t.local_date, today) <= 7 && Number(t.items_count ?? 0) > 0)
      .length,
    isNewUser,
    highProteinRecipes: [],
  };
  let recommendations = computeRecommendations(recoInput);
  if (recommendations.some((r) => r.id === "protein")) {
    recoInput.highProteinRecipes = await getHighProteinRecipes(supabase);
    recommendations = computeRecommendations(recoInput);
  }

  const notifications =
    notifRes.error || notifCountRes.error
      ? null
      : { unreadCount: notifCountRes.count ?? notifRes.data?.length ?? 0, items: notifRes.data ?? [] };

  return {
    today,
    hour,
    greeting: greetingForHour(hour),
    displayName: profile?.display_name?.trim() || null,
    defaultMeal: defaultMealForHour(hour),
    target,
    budget,
    consumed,
    exercise,
    water,
    weight,
    showWeight,
    streaks,
    weekly,
    reminders,
    notifications,
    recommendations,
    isNewUser,
  };
}

/** Recetas publicadas con más proteína por caloría (para la sugerencia de proteína). */
async function getHighProteinRecipes(supabase: Client) {
  const { data: nutrition } = await supabase
    .from("recipe_nutrition")
    .select("recipe_id, per_serving_protein_g, per_serving_energy_kcal")
    .not("per_serving_protein_g", "is", null)
    .order("per_serving_protein_g", { ascending: false })
    .limit(40);
  const ids = (nutrition ?? []).flatMap((n) => (n.recipe_id ? [n.recipe_id] : []));
  if (!ids.length) return [];
  const { data: recipes } = await supabase
    .from("recipes")
    .select("id, title, slug")
    .in("id", ids)
    .eq("status", "published")
    .eq("is_public", true);
  const byId = new Map((recipes ?? []).map((r) => [r.id, r] as const));
  return pickHighProteinRecipes(
    (nutrition ?? []).flatMap((n) => {
      const r = n.recipe_id ? byId.get(n.recipe_id) : undefined;
      return r
        ? [{ title: r.title, slug: r.slug, proteinG: n.per_serving_protein_g, energyKcal: n.per_serving_energy_kcal }]
        : [];
    }),
  );
}
