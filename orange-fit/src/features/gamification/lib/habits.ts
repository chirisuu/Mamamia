/**
 * Agregados reales por día para insignias y retos (puro). Entra lo leído de la base y sale en la
 * forma que espera `src/lib/nutrition/gamification.ts`.
 */
import type { DailyHabitRecord, GamificationStats } from "@/lib/nutrition";
import { sortTargets, targetForDate, type TargetRowLite } from "@/features/progress/lib/targets-by-date";
import { vegetableServings } from "./vegetables";

export type MealLogWithItems = {
  local_date: string;
  meal_type: string;
  meal_log_items: { name: string | null; grams: number | null; source: string | null }[];
};

export type HabitInput = {
  mealLogs: readonly MealLogWithItems[];
  totals: readonly { local_date: string | null; protein_g: number | null; items_count: number | null }[];
  water: readonly { local_date: string; amount_ml: number }[];
  exercise: readonly { local_date: string; duration_min: number }[];
  targets: readonly TargetRowLite[];
};

export type HabitAggregates = {
  /** Un registro por día con actividad (cualquier fuente). */
  days: DailyHabitRecord[];
  /** Igual que `days`, pero `itemsLogged` cuenta solo el desayuno (reto «Desayuno en el diario»). */
  breakfastDays: DailyHabitRecord[];
  mealLogItemsTotal: number;
  logSourceCounts: Record<string, number>;
};

export function buildHabitAggregates(input: HabitInput): HabitAggregates {
  const sorted = sortTargets(input.targets);
  const byDate = new Map<string, DailyHabitRecord>();
  const breakfast = new Map<string, number>();
  const vegItems = new Map<string, { name: string | null; grams: number | null }[]>();
  const sources: Record<string, number> = {};
  let total = 0;

  const day = (date: string): DailyHabitRecord => {
    let rec = byDate.get(date);
    if (!rec) {
      const t = targetForDate(sorted, date);
      rec = {
        date,
        itemsLogged: 0,
        waterMl: 0,
        waterTargetMl: t?.water_ml != null ? Number(t.water_ml) : null,
        proteinG: 0,
        proteinTargetG: t?.protein_g != null ? Number(t.protein_g) : null,
        vegetableServings: 0,
        activityMinutes: 0,
      };
      byDate.set(date, rec);
    }
    return rec;
  };

  for (const log of input.mealLogs) {
    const items = log.meal_log_items ?? [];
    const rec = day(log.local_date);
    rec.itemsLogged = (rec.itemsLogged ?? 0) + items.length;
    total += items.length;
    if (log.meal_type === "breakfast") breakfast.set(log.local_date, (breakfast.get(log.local_date) ?? 0) + items.length);
    const list = vegItems.get(log.local_date) ?? [];
    for (const item of items) {
      list.push({ name: item.name, grams: item.grams == null ? null : Number(item.grams) });
      if (item.source) sources[item.source] = (sources[item.source] ?? 0) + 1;
    }
    vegItems.set(log.local_date, list);
  }
  for (const [date, list] of vegItems) day(date).vegetableServings = vegetableServings(list);

  for (const t of input.totals) {
    if (!t.local_date) continue;
    day(t.local_date).proteinG = Number(t.protein_g ?? 0);
  }
  for (const w of input.water) {
    const rec = day(w.local_date);
    rec.waterMl = (rec.waterMl ?? 0) + Number(w.amount_ml);
  }
  for (const e of input.exercise) {
    const rec = day(e.local_date);
    rec.activityMinutes = (rec.activityMinutes ?? 0) + Number(e.duration_min);
  }

  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  return {
    days,
    breakfastDays: days.map((d) => ({ ...d, itemsLogged: breakfast.get(d.date) ?? 0 })),
    mealLogItemsTotal: total,
    logSourceCounts: sources,
  };
}

export function toGamificationStats(
  agg: Pick<HabitAggregates, "mealLogItemsTotal" | "logSourceCounts">,
  habitDays: Pick<GamificationStats, "loggingDays" | "waterGoalDays" | "proteinGoalDays" | "vegetableDays">,
  counts: { recipesCreated: number; weightLogsTotal: number; mealPlansCreated: number; challengesCompleted: number },
): GamificationStats {
  return {
    mealLogItemsTotal: agg.mealLogItemsTotal,
    logSourceCounts: agg.logSourceCounts,
    ...habitDays,
    ...counts,
  };
}
