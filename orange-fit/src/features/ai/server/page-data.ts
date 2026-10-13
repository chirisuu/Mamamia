import "server-only";
import { mealLabel } from "@/features/diary/lib/day-totals";
import { logTargetQuery, resolveLogTarget } from "@/features/diary/lib/log-target";
import { STANDARD_MEAL_OPTIONS } from "@/features/diary/lib/meal-time";
import { getCustomMealNames, getDiaryPageContext } from "@/features/diary/server/page-context";
import type { MealOption } from "@/features/diary/types";
import { formatShortDate } from "@/lib/format";
import { getAiStatus } from "./availability";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Datos comunes de /app/agregar/{foto,texto,voz}: sesión, "hoy" en la zona del perfil, destino
 * del registro (`?fecha=&comida=&nombre=`, igual que el resto de /app/agregar), comidas elegibles
 * y el estado honesto de la IA (configuración, consentimiento, plan, cupo).
 */
export async function getAiLogPageData(path: string, params: SearchParams) {
  const ctx = await getDiaryPageContext(path);
  const target = resolveLogTarget(params, ctx.today, ctx.hour);
  const [customNames, status] = await Promise.all([
    getCustomMealNames(ctx.supabase, ctx.user.id, target.localDate),
    getAiStatus(ctx.supabase, ctx.user.id, ctx.timezone),
  ]);
  const mealOptions: MealOption[] = [
    ...STANDARD_MEAL_OPTIONS,
    ...customNames.map((name) => ({ mealType: "custom" as const, customName: name, label: name })),
  ];
  const query = logTargetQuery(target);
  return {
    target,
    tomorrow: ctx.tomorrow,
    mealOptions,
    status,
    query,
    subtitle: `${mealLabel(target.mealType, target.customName)} · ${target.isToday ? "hoy" : formatShortDate(target.localDate)}`,
    backHref: `/app/agregar?${query}`,
    searchHref: `/app/agregar/buscar?${query}`,
  };
}
