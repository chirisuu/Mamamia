import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DayNav } from "@/features/diary/components/day-nav";
import { DayTotalsCard } from "@/features/diary/components/day-totals-card";
import { DiaryMeals } from "@/features/diary/components/diary-meals";
import { logTargetQuery } from "@/features/diary/lib/log-target";
import { dayLabel, defaultMealForHour, isAllowedDiaryDate, MIN_DIARY_DATE } from "@/features/diary/lib/meal-time";
import { getDiaryDay, getTemplates, type DiaryDay } from "@/features/diary/queries";
import { getDiaryPageContext } from "@/features/diary/server/page-context";
import type { TemplateSummary } from "@/features/diary/types";
import { isIsoDate } from "@/lib/dates";
import { formatLongDate } from "@/lib/format";

export const metadata: Metadata = { title: "Diario" };

export default async function DiaryDayPage({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = await params;
  if (!isIsoDate(fecha) || fecha < MIN_DIARY_DATE) notFound();
  const ctx = await getDiaryPageContext(`/app/diario/${fecha}`);
  // Más allá de mañana no se registra: se lleva al último día permitido.
  if (!isAllowedDiaryDate(fecha, ctx.today)) redirect(`/app/diario/${ctx.tomorrow}`);

  let day: DiaryDay | null = null;
  let templates: TemplateSummary[] = [];
  try {
    [day, templates] = await Promise.all([getDiaryDay(ctx.supabase, ctx.user.id, fecha), getTemplates(ctx.supabase, ctx.user.id)]);
  } catch {
    day = null;
  }

  const addHref = `/app/agregar?${logTargetQuery({
    localDate: fecha,
    mealType: fecha === ctx.today ? defaultMealForHour(ctx.hour) : "breakfast",
    customName: null,
  })}`;

  return (
    <>
      <AppHeader
        title="Diario"
        subtitle={fecha === ctx.today ? `Hoy, ${formatLongDate(fecha)}` : formatLongDate(fecha)}
        actions={
          <Button asChild size="sm">
            <Link href={addHref}>
              <Plus aria-hidden="true" />
              Agregar
            </Link>
          </Button>
        }
      />
      <div className="flex flex-col gap-4 pt-2">
        <DayNav date={fecha} today={ctx.today} maxDate={ctx.tomorrow} />
        {day ? (
          <>
            <DayTotalsCard totals={day.totals} target={day.target} />
            {day.totals.itemsCount === 0 ? (
              <p className="text-sm text-muted-foreground">
                {fecha > ctx.today
                  ? "Puedes dejar listo lo de mañana: agrégalo a cualquier comida."
                  : `${dayLabel(fecha, ctx.today)} aún no tiene registros. Empieza por cualquier comida.`}
              </p>
            ) : null}
            <DiaryMeals date={fecha} today={ctx.today} maxDate={ctx.tomorrow} meals={day.meals} templates={templates} />
          </>
        ) : (
          <Alert variant="destructive">
            <AlertTitle>No pudimos cargar tu diario</AlertTitle>
            <AlertDescription>
              <p>Revisa tu conexión y recarga la página.</p>
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link href={`/app/diario/${fecha}`}>Reintentar</Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </>
  );
}
