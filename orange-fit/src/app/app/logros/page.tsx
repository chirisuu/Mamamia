import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, Carrot, Droplets, Drumstick, PartyPopper } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { BadgeGrid } from "@/features/gamification/components/badge-grid";
import { ChallengeList } from "@/features/gamification/components/challenge-list";
import { syncAchievements, type AchievementsSnapshot } from "@/features/gamification/server/sync";
import { getTrackingContext } from "@/features/progress/server/tracking-context";
import { localDateInTz } from "@/lib/dates";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Logros" };

export default async function AchievementsPage() {
  const ctx = await getTrackingContext("/app/logros");
  // Se evalúa al abrir: así también cuentan los registros hechos desde otras pantallas (diario, recetas…).
  const snapshot = await syncAchievements(ctx.supabase, ctx.user.id, ctx.today).catch((): AchievementsSnapshot | null => null);

  if (!snapshot) {
    return (
      <>
        <AppHeader title="Logros" backHref="/app/progreso" backLabel="Volver a Progreso" />
        <Alert variant="destructive" className="mt-2">
          <AlertTitle>No pudimos cargar tus logros</AlertTitle>
          <AlertDescription>
            <p>Revisa tu conexión y vuelve a intentarlo. Lo que ya ganaste no se pierde.</p>
            <Link href="/app/logros" className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary-strong underline-offset-4 hover:underline">
              Reintentar
            </Link>
          </AlertDescription>
        </Alert>
      </>
    );
  }

  // Con antecedente de TCA no invitamos a pesarse: esa insignia solo se ve si ya se ganó.
  const badges = ctx.hideWeight ? snapshot.badges.filter((b) => b.earned || b.criteriaType !== "weight_logs_total") : snapshot.badges;
  const earnedCount = badges.filter((b) => b.earned).length;
  const fresh = [...snapshot.newlyEarnedBadges.map((code) => badges.find((b) => b.code === code)?.name).filter(Boolean)];
  const timeZone = ctx.timeZone;

  return (
    <>
      <AppHeader title="Logros" subtitle="Lo que ya hiciste por ti" backHref="/app/progreso" backLabel="Volver a Progreso" />
      <div className="grid gap-6 pt-2 lg:grid-cols-2 lg:items-start">
        <div className="grid gap-4">
          {fresh.length > 0 || snapshot.newlyCompletedChallenges.length > 0 ? (
            <Alert variant="success">
              <PartyPopper aria-hidden="true" />
              <AlertTitle>¡Felicitaciones!</AlertTitle>
              <AlertDescription>
                {fresh.length > 0 ? `Ganaste: ${fresh.join(", ")}. ` : ""}
                {snapshot.newlyCompletedChallenges.length > 0 ? "Además completaste un reto." : ""}
              </AlertDescription>
            </Alert>
          ) : null}

          <section aria-labelledby="habitos-titulo" className="grid gap-3">
            <h2 id="habitos-titulo" className="text-base font-semibold">
              Tus días con hábitos
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Días registrando" icon={CalendarCheck} value={formatNumber(snapshot.totals.loggingDays)} />
              <StatTile label="Días con tu meta de agua" icon={Droplets} value={formatNumber(snapshot.totals.waterGoalDays)} />
              <StatTile label="Días con proteína en meta" icon={Drumstick} value={formatNumber(snapshot.totals.proteinGoalDays)} />
              <StatTile label="Días con verduras" icon={Carrot} value={formatNumber(snapshot.totals.vegetableDays)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Cuentan días distintos, no seguidos: un día sin registrar no borra nada de lo que ya lograste.
            </p>
          </section>

          <Card>
            <CardHeader>
              <CardTitle as="h2">Insignias</CardTitle>
              <CardDescription>
                {earnedCount === 0
                  ? "Tu primera insignia está cerca: empieza registrando una comida."
                  : `Llevas ${earnedCount} de ${badges.length}. Una insignia ganada no se pierde.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BadgeGrid badges={badges} earnedDateOf={(iso) => localDateInTz(new Date(iso), timeZone)} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Retos voluntarios</CardTitle>
            <CardDescription>Únete a los que te motiven. Si un día no se da, no pierdes lo que llevas.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChallengeList challenges={snapshot.challenges} today={ctx.today} timeZone={ctx.timeZone} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
