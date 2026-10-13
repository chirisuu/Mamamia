import type { Metadata } from "next";
import Link from "next/link";
import { Target } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireUser } from "@/lib/auth/session";
import { formatKcal, formatKg, formatNumber, formatShortDate } from "@/lib/format";
import { ACTIVITY_LEVELS, GOAL_LABELS, isActivityLevel, isGoal } from "@/lib/nutrition";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DIET_PATTERN_LABELS } from "@/features/onboarding/options";
import { CurrentTarget } from "@/features/profile/components/current-target";
import { ManualTargetsForm } from "@/features/profile/components/manual-targets-form";
import { RecalculateCard, type RecalcPreview } from "@/features/profile/components/recalculate-card";
import { TargetHistory } from "@/features/profile/components/target-history";
import { getTargetsOverview, personLabel } from "@/features/profile/queries";
import { loadPlanContext, manualContext, previewPlan } from "@/features/profile/server/targets";

export const metadata: Metadata = { title: "Metas y objetivo" };

export default async function GoalsPage() {
  const user = await requireUser("/app/perfil/metas");
  const supabase = await createSupabaseServerClient();
  const ctx = await loadPlanContext(supabase, user.id);
  if (!ctx) {
    return (
      <>
        <AppHeader title="Metas y objetivo" backHref="/app/perfil" backLabel="Volver a Perfil" />
        <EmptyState icon={Target} title="No encontramos tu perfil" description="Vuelve a intentarlo en un momento." className="mt-4" />
      </>
    );
  }
  const preview = previewPlan(ctx);
  const mctx = manualContext(ctx, preview);
  const { active, history, people } = await getTargetsOverview(supabase, user.id, ctx.today);
  const goal = ctx.goal;
  const upcoming = history.find((r) => r.effective_from > ctx.today) ?? null;

  const recalc: RecalcPreview = preview.ok
    ? {
        ok: true,
        energyKcal: preview.plan.targets.energyKcal,
        proteinG: preview.plan.targets.proteinG,
        carbsG: preview.plan.targets.carbsG,
        fatG: preview.plan.targets.fatG,
        weightKg: preview.weightSource.weightKg,
        weightDate: preview.weightSource.localDate,
        weightKind: preview.weightSource.kind,
        maintenanceByProfile: preview.plan.maintenanceByProfile,
      }
    : { ok: false, reason: preview.reason };

  return (
    <>
      <AppHeader title="Metas y objetivo" backHref="/app/perfil" backLabel="Volver a Perfil" />
      <div className="grid gap-8 pb-10 pt-2">
        <section aria-labelledby="current-title" className="grid gap-3">
          <h2 id="current-title" className="text-lg font-semibold tracking-tight">
            Tu meta vigente
          </h2>
          {active ? (
            <CurrentTarget target={active} setBy={active.source === "professional" ? personLabel(people, active.created_by) : null} />
          ) : (
            <EmptyState
              icon={Target}
              title="Aún no tienes una meta vigente"
              description="Calcúlala con tu peso más reciente o escríbela a mano aquí abajo."
            />
          )}
          {upcoming ? (
            <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Desde el {formatShortDate(upcoming.effective_from)} empieza una meta de {formatKcal(upcoming.energy_kcal)}
              {upcoming.source === "professional" ? ` fijada por ${personLabel(people, upcoming.created_by)}` : ""}.
            </p>
          ) : null}
        </section>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Tu objetivo</CardTitle>
            <CardDescription>Con esto se calculan tus metas automáticas.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {goal ? (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Objetivo</dt>
                  <dd className="font-medium">{isGoal(goal.goal_type) ? GOAL_LABELS[goal.goal_type] : goal.goal_type}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Actividad</dt>
                  <dd className="font-medium">{isActivityLevel(goal.activity_level) ? ACTIVITY_LEVELS[goal.activity_level].label : "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Ritmo</dt>
                  <dd className="font-medium" data-numeric="">
                    {goal.weekly_rate_kg != null && Number(goal.weekly_rate_kg) > 0 ? `${formatNumber(Number(goal.weekly_rate_kg), 2)} kg/semana` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Peso objetivo</dt>
                  <dd className="font-medium" data-numeric="">
                    {goal.target_weight_kg != null ? formatKg(Number(goal.target_weight_kg)) : "Sin definir"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Alimentación</dt>
                  <dd className="font-medium">
                    {goal.diet_pattern ? (DIET_PATTERN_LABELS[goal.diet_pattern as keyof typeof DIET_PATTERN_LABELS] ?? goal.diet_pattern) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Comidas al día</dt>
                  <dd className="font-medium">{goal.meals_per_day ?? "—"}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">No tienes un objetivo activo.</p>
            )}
            {goal?.requires_professional_review ? (
              <Badge variant="soft" className="whitespace-normal">
                Tu perfil pide revisar tu objetivo con un profesional de salud
              </Badge>
            ) : null}
            <Button asChild variant="outline" className="justify-self-start">
              <Link href="/onboarding?rehacer=1">Actualizar mi objetivo</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Recalcular con tu peso más reciente</CardTitle>
            <CardDescription>Misma fórmula, con tus datos de hoy.</CardDescription>
          </CardHeader>
          <CardContent>
            <RecalculateCard preview={recalc} currentKcal={active?.energy_kcal ?? null} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Ajuste manual</CardTitle>
            <CardDescription>
              Si tu nutricionista te dio otros números o prefieres ajustar los tuyos. Cuidamos que no bajes de un mínimo seguro.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ManualTargetsForm
              context={mctx}
              defaults={{
                energyKcal: active?.energy_kcal ?? null,
                proteinG: active?.protein_g ?? null,
                carbsG: active?.carbs_g ?? null,
                fatG: active?.fat_g ?? null,
                fiberG: active?.fiber_g ?? null,
                waterMl: active?.water_ml ?? null,
              }}
            />
          </CardContent>
        </Card>

        <section aria-labelledby="history-title" className="grid gap-3">
          <h2 id="history-title" className="text-lg font-semibold tracking-tight">
            Historial
          </h2>
          <TargetHistory
            rows={history}
            activeId={active?.id ?? null}
            today={ctx.today}
            creatorLabel={(row) => (row.source === "professional" ? personLabel(people, row.created_by) : null)}
          />
        </section>
      </div>
    </>
  );
}
