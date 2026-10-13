import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalorieCard } from "@/features/dashboard/components/calorie-card";
import { MacrosCard } from "@/features/dashboard/components/macros-card";
import { QuickActions } from "@/features/dashboard/components/quick-actions";
import { RecommendationsCard } from "@/features/dashboard/components/recommendations-card";
import { RemindersCard } from "@/features/dashboard/components/reminders-card";
import { StatusTiles } from "@/features/dashboard/components/status-tiles";
import { WeeklyChart } from "@/features/dashboard/components/weekly-chart";
import { WelcomeCard } from "@/features/dashboard/components/welcome-card";
import { getDashboardData, type DashboardData } from "@/features/dashboard/queries";
import { getProfile, requireUser } from "@/lib/auth/session";
import { formatLongDate } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Inicio" };

export default async function HomePage() {
  const user = await requireUser("/app");
  const [profile, supabase] = await Promise.all([getProfile(), createSupabaseServerClient()]);
  let data: DashboardData | null = null;
  try {
    data = await getDashboardData(supabase, user.id, profile);
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <>
        <AppHeader title="Inicio" />
        <Alert variant="destructive" className="mt-2">
          <AlertTitle>No pudimos cargar tu resumen</AlertTitle>
          <AlertDescription>
            <p>Revisa tu conexión y vuelve a intentarlo.</p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href="/app">Reintentar</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </>
    );
  }

  const unread = data.notifications?.unreadCount ?? 0;
  const loggedDays = data.weekly.filter((d) => d.consumed != null).length;

  return (
    <>
      <AppHeader
        title={data.displayName ? `${data.greeting}, ${data.displayName}` : data.greeting}
        subtitle={formatLongDate(data.today)}
        actions={
          <Button asChild variant="ghost" size="icon" className="relative rounded-full">
            <Link href="/app/notificaciones" aria-label={unread ? `Notificaciones, ${unread} sin leer` : "Notificaciones"}>
              <Bell aria-hidden="true" />
              {unread ? (
                <span
                  aria-hidden="true"
                  className="absolute right-2 top-2 flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground"
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 pt-2 lg:grid-cols-2 lg:items-start">
        {data.isNewUser ? (
          <div className="lg:col-span-2">
            <WelcomeCard name={data.displayName} defaultMeal={data.defaultMeal} />
          </div>
        ) : null}

        <div className="grid gap-4">
          <CalorieCard budget={data.budget} consumedKcal={data.consumed.energyKcal} />
          <MacrosCard consumed={data.consumed} target={data.target} today={data.today} />
        </div>

        <div className="grid gap-4">
          <StatusTiles data={data} />
          <QuickActions />
          <RemindersCard reminders={data.reminders} notifications={data.notifications} />
          <RecommendationsCard recommendations={data.recommendations} />
        </div>

        <Card className="gap-3 lg:col-span-2">
          <CardHeader>
            <CardTitle as="h2">Últimos 7 días</CardTitle>
            <CardDescription>
              {loggedDays
                ? `kcal consumidas frente a tu meta · registraste ${loggedDays} de 7 días`
                : "Cuando registres tus comidas, aquí verás tu semana."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WeeklyChart data={data.weekly} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
