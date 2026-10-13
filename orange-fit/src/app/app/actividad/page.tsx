import type { Metadata } from "next";
import Link from "next/link";
import { Flame, Timer, Watch } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { CountExerciseToggle } from "@/features/activity/components/count-exercise-toggle";
import { ExerciseForm } from "@/features/activity/components/exercise-form";
import { ExerciseHistory } from "@/features/activity/components/exercise-history";
import { activityOverview } from "@/features/activity/lib/activity-calc";
import { EXERCISE_BACKFILL_DAYS, getActivityPageData, type ActivityPageData } from "@/features/activity/server/activity";
import { getTrackingContext } from "@/features/progress/server/tracking-context";
import { formatDuration, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Actividad" };

export default async function ActivityPage() {
  const ctx = await getTrackingContext("/app/actividad");
  const data = await getActivityPageData(ctx.supabase, ctx.user.id, ctx.today).catch((): ActivityPageData | null => null);

  if (!data) {
    return (
      <>
        <AppHeader title="Actividad" backHref="/app" backLabel="Volver a Inicio" />
        <Alert variant="destructive" className="mt-2">
          <AlertTitle>No pudimos cargar tu actividad</AlertTitle>
          <AlertDescription>
            <p>Revisa tu conexión y vuelve a intentarlo.</p>
            <Link href="/app/actividad" className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary-strong underline-offset-4 hover:underline">
              Reintentar
            </Link>
          </AlertDescription>
        </Alert>
      </>
    );
  }

  const overview = activityOverview(
    data.logs.map((l) => ({ local_date: l.localDate, duration_min: l.durationMin, energy_kcal: l.energyKcal })),
    ctx.today,
  );

  return (
    <>
      <AppHeader title="Actividad" subtitle="Todo movimiento cuenta" backHref="/app" backLabel="Volver a Inicio" />
      <div className="grid gap-6 pt-2 lg:grid-cols-2 lg:items-start">
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Hoy" icon={Timer} value={formatDuration(overview.today.minutes)} hint={`${formatNumber(overview.today.kcal)} kcal netas`} />
            <StatTile
              label="Esta semana"
              icon={Flame}
              value={formatDuration(overview.week.minutes)}
              hint={`${overview.week.sessions} ${overview.week.sessions === 1 ? "sesión" : "sesiones"}`}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle as="h2">Registrar ejercicio</CardTitle>
              <CardDescription>Elige la actividad y cuánto duró. Calculamos las calorías netas estimadas.</CardDescription>
            </CardHeader>
            <CardContent>
              <ExerciseForm today={ctx.today} backfillDays={EXERCISE_BACKFILL_DAYS} weight={data.weight} hideWeight={ctx.hideWeight} />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Tu presupuesto del día</CardTitle>
            </CardHeader>
            <CardContent>
              <CountExerciseToggle initial={ctx.profile?.count_exercise_calories ?? false} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle as="h2">Historial</CardTitle>
              <CardDescription>Últimos {EXERCISE_BACKFILL_DAYS} días.</CardDescription>
            </CardHeader>
            <CardContent>
              <ExerciseHistory logs={data.logs} />
            </CardContent>
          </Card>
          <Alert variant="info">
            <Watch aria-hidden="true" />
            <AlertTitle>Apple Health y Health Connect</AlertTitle>
            <AlertDescription>
              Hoy no hay sincronización con relojes ni apps de salud: registra tus sesiones aquí o copia las calorías activas
              con la opción «De mi reloj o app».
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </>
  );
}
