import type { Metadata } from "next";
import Link from "next/link";
import { Camera, HeartHandshake, Trophy } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { PremiumGate } from "@/components/app/premium-gate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdherenceCard } from "@/features/progress/components/adherence-card";
import { MeasurementsChart } from "@/features/progress/components/measurements-chart";
import { MeasurementsForm } from "@/features/progress/components/measurements-form";
import { PeriodComparison } from "@/features/progress/components/period-comparison";
import { MeasurementHistory, WeightHistory } from "@/features/progress/components/progress-history";
import { TrendCard } from "@/features/progress/components/trend-card";
import { WeightChart } from "@/features/progress/components/weight-chart";
import { WeightForm, type ExistingWeight } from "@/features/progress/components/weight-form";
import { adherenceDays, weightChartPoints } from "@/features/progress/lib/analytics";
import { getProgressData, type MeasurementRecord, type ProgressData } from "@/features/progress/server/progress";
import { getTrackingContext } from "@/features/progress/server/tracking-context";
import { hasFeature } from "@/lib/billing/entitlements";
import { addDays } from "@/lib/dates";
import { computeStreaks, projectGoalDate, weeklyAdherence, weightTrend, type GoalProjection } from "@/lib/nutrition";

export const metadata: Metadata = { title: "Progreso" };

/** Ventana de la tendencia actual: las últimas 6 semanas (lo más antiguo describe otra etapa). */
const TREND_DAYS = 42;

export default async function ProgressPage() {
  const ctx = await getTrackingContext("/app/progreso");
  const [advanced, data] = await Promise.all([
    hasFeature("advanced_analytics").catch(() => false),
    getProgressData(ctx.supabase, ctx.user.id, ctx.today).catch((): ProgressData | null => null),
  ]);

  const header = (
    <AppHeader
      title="Progreso"
      actions={
        <>
          {!ctx.hideWeight ? (
            <Button asChild variant="ghost" size="icon" className="rounded-full">
              <Link href="/app/progreso/fotos" aria-label="Fotos de progreso">
                <Camera aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="icon" className="rounded-full">
            <Link href="/app/logros" aria-label="Logros">
              <Trophy aria-hidden="true" />
            </Link>
          </Button>
        </>
      }
    />
  );

  if (!data) {
    return (
      <>
        {header}
        <Alert variant="destructive" className="mt-2">
          <AlertTitle>No pudimos cargar tu progreso</AlertTitle>
          <AlertDescription>
            <p>Revisa tu conexión y vuelve a intentarlo.</p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href="/app/progreso">Reintentar</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </>
    );
  }

  const intake = adherenceDays(data.totals, data.targets);
  const hasTargets = data.targets.length > 0;
  const weekly = hasTargets ? weeklyAdherence(intake, ctx.today, ctx.today) : null;
  const streaks = hasTargets ? computeStreaks(intake, ctx.today) : null;
  const adherence = <AdherenceCard weekly={weekly} streaks={streaks} hasTargets={hasTargets} />;

  // Con antecedente de TCA: sin números de peso, medidas ni proyecciones (como en Inicio).
  if (ctx.hideWeight) {
    return (
      <>
        {header}
        <div className="grid gap-4 pt-2 lg:grid-cols-2 lg:items-start">
          <Alert variant="info">
            <HeartHandshake aria-hidden="true" />
            <AlertTitle>Tu progreso, enfocado en hábitos</AlertTitle>
            <AlertDescription>
              Por lo que nos contaste en tu perfil, aquí no mostramos números de peso, medidas ni proyecciones. Nos enfocamos en
              tus hábitos. Si tu profesional de salud te pide registrar tu peso, conversa con él o ella cómo hacerlo.
            </AlertDescription>
          </Alert>
          {adherence}
        </div>
      </>
    );
  }

  const goalKg = ctx.goal?.target_weight_kg != null ? Number(ctx.goal.target_weight_kg) : null;
  const recent = data.entries.filter((e) => e.date >= addDays(ctx.today, -(TREND_DAYS - 1)));
  const trend = weightTrend(recent);
  let projection: GoalProjection | null = null;
  if (goalKg != null) {
    try {
      projection = projectGoalDate(trend, goalKg);
    } catch {
      projection = null;
    }
  }
  const chartFrom = addDays(ctx.today, advanced ? -364 : -89);
  const points = weightChartPoints(data.entries, chartFrom, ctx.today);
  const comparisonEntries = advanced ? data.entries.filter((e) => e.date >= addDays(ctx.today, -179)) : [];

  const existing: Record<string, ExistingWeight> = {};
  for (const w of data.weights.filter((w) => w.local_date >= addDays(ctx.today, -120))) {
    existing[w.local_date] = { weightKg: w.weight_kg, bodyFatPct: w.body_fat_pct, bodyFatMethod: w.body_fat_method, note: w.note };
  }
  const measurementsByDate: Record<string, MeasurementRecord> = {};
  for (const m of data.measurements) measurementsByDate[m.local_date] = m;
  const measurementSince = advanced ? null : addDays(ctx.today, -29);
  const chartMeasurements = measurementSince ? data.measurements.filter((m) => m.local_date >= measurementSince) : data.measurements;

  return (
    <>
      {header}
      <div className="grid gap-4 pt-2 lg:grid-cols-2 lg:items-start">
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Registrar peso</CardTitle>
              <CardDescription>Un pesaje por día. Si ya registraste ese día, se actualiza.</CardDescription>
            </CardHeader>
            <CardContent>
              <WeightForm today={ctx.today} existing={existing} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Tu peso</CardTitle>
              <CardDescription>Pesaje del día y promedio de 7 días{goalKg != null ? ", con tu meta" : ""}.</CardDescription>
            </CardHeader>
            <CardContent>
              <WeightChart points={points} today={ctx.today} goalKg={goalKg} advanced={advanced} />
            </CardContent>
          </Card>

          <TrendCard trend={trend} projection={projection} goalKg={goalKg} />

          <section aria-labelledby="comparar-titulo" className="grid gap-3">
            <h2 id="comparar-titulo" className="text-base font-semibold">
              Comparar periodos
            </h2>
            <PremiumGate feature="advanced_analytics">
              <Card>
                <CardContent>
                  <PeriodComparison entries={comparisonEntries} today={ctx.today} />
                </CardContent>
              </Card>
            </PremiumGate>
          </section>
        </div>

        <div className="grid gap-4">
          {adherence}

          <Card>
            <CardHeader>
              <CardTitle as="h2">Medidas corporales</CardTitle>
              <CardDescription>Cintura, cadera, pecho, brazo, muslo, pantorrilla y cuello, en cm.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <MeasurementsForm today={ctx.today} byDate={measurementsByDate} />
              <MeasurementsChart rows={chartMeasurements} advanced={advanced} since={measurementSince} />
              <div className="grid gap-2">
                <h3 className="text-sm font-semibold">Historial de medidas</h3>
                <MeasurementHistory rows={data.measurements} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Historial de pesajes</CardTitle>
            </CardHeader>
            <CardContent>
              <WeightHistory rows={data.weights} />
            </CardContent>
          </Card>

          <Button asChild variant="outline">
            <Link href="/app/progreso/fotos">
              <Camera aria-hidden="true" />
              Fotos de progreso
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}
