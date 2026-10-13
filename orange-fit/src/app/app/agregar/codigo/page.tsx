import type { Metadata } from "next";
import { AppHeader } from "@/components/app/app-header";
import { logTargetQuery, resolveLogTarget } from "@/features/diary/lib/log-target";
import { BarcodeFlow } from "@/features/foods/components/barcode-flow";
import { mealChoices, mealDisplayName } from "@/features/foods/lib/meals";
import { getBarcodePageContext, getCustomMealNames } from "@/features/foods/queries";
import { parseBarcode } from "@/lib/foods/barcode";
import { formatShortDate } from "@/lib/format";

export const metadata: Metadata = { title: "Código de barras" };

/**
 * Registrar por código de barras. Respeta el destino de /app/agregar (`?fecha=&comida=&nombre=`) y
 * acepta `?codigo=` para buscar al abrir (p. ej. al volver de crear el alimento propio).
 */
export default async function BarcodePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getBarcodePageContext("/app/agregar/codigo");
  const params = await searchParams;
  const target = resolveLogTarget(params, ctx.today, ctx.hour);
  const rawCode = typeof params.codigo === "string" ? params.codigo : null;
  const parsed = rawCode ? parseBarcode(rawCode) : null;
  const customNames = await getCustomMealNames(ctx.supabase, ctx.user.id, target.localDate);
  const meals = mealChoices(target.customName && !customNames.includes(target.customName) ? [...customNames, target.customName] : customNames);
  const dayLabel = target.isToday ? "hoy" : formatShortDate(target.localDate);
  const query = logTargetQuery(target);

  return (
    <>
      <AppHeader
        title="Código de barras"
        subtitle={`${mealDisplayName(target.mealType, target.customName)} · ${dayLabel}`}
        backHref={`/app/agregar?${query}`}
      />
      <BarcodeFlow
        localDate={target.localDate}
        isToday={target.isToday}
        meals={meals}
        defaultMeal={{ mealType: target.mealType, customName: target.customName }}
        initialCode={parsed?.ok ? parsed.code : null}
        targetQuery={query}
      />
    </>
  );
}
