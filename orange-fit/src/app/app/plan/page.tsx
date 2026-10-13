import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight, Link2, Plus, ShoppingBasket } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { PremiumGate } from "@/components/app/premium-gate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { hasFeature } from "@/lib/billing/entitlements";
import { addDays } from "@/lib/dates";
import { formatShortDate } from "@/lib/format";
import { TodayPlan } from "@/features/planner/components/today-plan";
import { PLAN_STATUS_LABELS } from "@/features/planner/lib/types";
import { getActivePlanToday, listPlans, type PlanSummary } from "@/features/planner/queries";
import { getRecipesPageContext } from "@/features/recipes/server/page-context";

export const metadata: Metadata = { title: "Plan de comidas" };

export default async function PlanPage() {
  const ctx = await getRecipesPageContext("/app/plan");
  const premium = await hasFeature("meal_plans");

  let plans: PlanSummary[] | null = null;
  let active: Awaited<ReturnType<typeof getActivePlanToday>> = null;
  if (premium) {
    try {
      [plans, active] = await Promise.all([listPlans(ctx.supabase, ctx.user.id), getActivePlanToday(ctx.supabase, ctx.user.id, ctx.today)]);
    } catch {
      plans = null;
    }
  }

  return (
    <>
      <AppHeader
        title="Plan de comidas"
        subtitle="Tu semana organizada con recetas reales"
        actions={
          premium ? (
            <Button asChild size="sm">
              <Link href="/app/plan/nuevo">
                <Plus aria-hidden="true" />
                Nuevo
              </Link>
            </Button>
          ) : null
        }
      />
      <div className="flex flex-col gap-6 pb-8 pt-2">
        <PremiumGate feature="meal_plans">
          {plans === null ? (
            <Alert variant="destructive">
              <AlertTitle>No pudimos cargar tus planes</AlertTitle>
              <AlertDescription>
                <p>Revisa tu conexión y vuelve a intentarlo.</p>
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <Link href="/app/plan">Reintentar</Link>
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex flex-col gap-6">
              {active?.plan && active.dayIndex != null ? (
                <TodayPlan
                  planId={active.plan.id}
                  planName={active.plan.name}
                  mealsPerDay={active.plan.params.mealsPerDay}
                  items={active.items}
                  today={ctx.today}
                  tomorrow={ctx.tomorrow}
                />
              ) : null}

              <section aria-labelledby="mis-planes" className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 id="mis-planes" className="text-lg font-semibold tracking-tight">
                    Mis planes
                  </h2>
                  <Button asChild variant="link" size="sm">
                    <Link href="/app/compras">
                      <ShoppingBasket aria-hidden="true" className="size-4" />
                      Listas de compras
                    </Link>
                  </Button>
                </div>
                {plans.length === 0 ? (
                  <EmptyState
                    icon={CalendarDays}
                    title="Aún no tienes planes"
                    description="Genera uno con tu meta y recetas reales, o ármalo a mano. Siempre puedes cambiar recetas y porciones."
                    action={
                      <Button asChild>
                        <Link href="/app/plan/nuevo">Crear mi primer plan</Link>
                      </Button>
                    }
                  />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {plans.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/app/plan/${p.id}`}
                          className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{p.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatShortDate(p.startDate)} – {formatShortDate(addDays(p.startDate, p.days - 1))} · {p.itemsCount} comidas
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {p.isShared ? (
                              <Badge variant="outline">
                                <Link2 aria-hidden="true" />
                                <span className="sr-only sm:not-sr-only">Compartido</span>
                              </Badge>
                            ) : null}
                            <Badge variant={p.status === "active" ? "default" : "secondary"}>{PLAN_STATUS_LABELS[p.status]}</Badge>
                            <ChevronRight className="size-5 text-muted-foreground" aria-hidden="true" />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </PremiumGate>
        {!premium ? (
          <p className="text-sm text-muted-foreground">
            Mientras tanto, puedes ver todas las{" "}
            <Link href="/app/recetas" className="font-medium text-primary-strong underline-offset-4 hover:underline">
              recetas
            </Link>{" "}
            y registrarlas en tu diario gratis.
          </p>
        ) : null}
      </div>
    </>
  );
}
