import type { Metadata } from "next";
import { AppHeader } from "@/components/app/app-header";
import { FoodSearch } from "@/features/diary/components/food-search";
import { mealLabel } from "@/features/diary/lib/day-totals";
import { logTargetQuery, resolveLogTarget } from "@/features/diary/lib/log-target";
import { STANDARD_MEAL_OPTIONS } from "@/features/diary/lib/meal-time";
import { getFavoriteFoods, getRecentFoods, type RecentFood } from "@/features/diary/queries";
import { getCustomMealNames, getDiaryPageContext } from "@/features/diary/server/page-context";
import type { PickerFood } from "@/features/diary/types";
import { formatShortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Buscar alimento" };

export default async function SearchFoodPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getDiaryPageContext("/app/agregar/buscar");
  const params = await searchParams;
  const target = resolveLogTarget(params, ctx.today, ctx.hour);
  const q = typeof params.q === "string" ? params.q.slice(0, 80) : "";

  let recent: RecentFood[] = [];
  let favorites: PickerFood[] = [];
  let listsError = false;
  try {
    [recent, favorites] = await Promise.all([getRecentFoods(ctx.supabase, ctx.user.id), getFavoriteFoods(ctx.supabase, ctx.user.id)]);
  } catch {
    listsError = true;
  }
  const customNames = await getCustomMealNames(ctx.supabase, ctx.user.id, target.localDate);
  const mealOptions = [
    ...STANDARD_MEAL_OPTIONS,
    ...customNames.map((name) => ({ mealType: "custom" as const, customName: name, label: name })),
  ];
  const dayLabel = target.isToday ? "hoy" : formatShortDate(target.localDate);

  return (
    <>
      <AppHeader
        title="Buscar alimento"
        subtitle={`${mealLabel(target.mealType, target.customName)} · ${dayLabel}`}
        backHref={`/app/agregar?${logTargetQuery(target)}`}
      />
      <div className="pt-2">
        <FoodSearch
          localDate={target.localDate}
          maxDate={ctx.tomorrow}
          defaultMeal={target.mealType}
          defaultCustomName={target.customName}
          mealOptions={mealOptions}
          recent={recent}
          favorites={favorites}
          initialQuery={q}
          listsError={listsError}
        />
      </div>
    </>
  );
}
