import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app/app-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getRoles, hasRole, requireUser } from "@/lib/auth/session";
import { addDays } from "@/lib/dates";
import { formatKcal, formatKg, formatShortDate } from "@/lib/format";
import { ACTIVITY_LEVELS, GOAL_LABELS, HEALTH_FLAGS, isActivityLevel, isGoal } from "@/lib/nutrition";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HEALTH_FLAG_LABELS } from "@/features/onboarding/options";
import { CurrentTarget } from "@/features/profile/components/current-target";
import { ManualTargetsForm } from "@/features/profile/components/manual-targets-form";
import { TargetHistory } from "@/features/profile/components/target-history";
import { getTargetsOverview, personLabel } from "@/features/profile/queries";
import { loadPlanContext, manualContext, previewPlan } from "@/features/profile/server/targets";
import { Scale, UtensilsCrossed } from "lucide-react";

export const metadata: Metadata = { title: "Paciente" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Vista del profesional: datos de una persona que le dio acceso (todo vía RLS) y propuesta de metas. */
export default async function PatientPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  if (!UUID.test(userId)) notFound();
  const user = await requireUser(`/app/perfil/profesional/pacientes/${userId}`);
  if (!hasRole(await getRoles(), "professional")) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: access } = await supabase
    .from("professional_access")
    .select("scope, granted_at")
    .eq("professional_id", user.id)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!access) notFound();

  const ctx = await loadPlanContext(supabase, userId);
  if (!ctx) notFound();
  const preview = previewPlan(ctx);
  const mctx = manualContext(ctx, preview);
  const [{ active, history, people }, { data: weights }, { data: totals }] = await Promise.all([
    getTargetsOverview(supabase, userId, ctx.today),
    supabase.from("weight_logs").select("local_date, weight_kg").eq("user_id", userId).order("local_date", { ascending: false }).limit(8),
    supabase
      .from("daily_nutrition_totals")
      .select("local_date, energy_kcal, protein_g, items_count")
      .eq("user_id", userId)
      .gte("local_date", addDays(ctx.today, -6))
      .order("local_date", { ascending: false }),
  ]);
  const name = ctx.profile.display_name || "Persona sin nombre";
  const goal = ctx.goal;
  const canWrite = access.scope === "read_logs_write_targets";
  const flags = (goal?.health_flags ?? []).filter((f): f is (typeof HEALTH_FLAGS)[number] => (HEALTH_FLAGS as readonly string[]).includes(f));
  const label = (id: string | null) => (id === user.id ? "ti" : personLabel(people, id, "otro profesional"));

  return (
    <>
      <AppHeader title={name} subtitle="Vista profesional" backHref="/app/perfil/profesional" backLabel="Volver a Acceso profesional" />
      <div className="grid gap-8 pb-10 pt-2">
        {goal?.requires_professional_review || flags.length > 0 ? (
          <Alert variant="info">
            <AlertTitle>Requiere revisión profesional</AlertTitle>
            <AlertDescription>
              <p>{flags.length > 0 ? flags.map((f) => HEALTH_FLAG_LABELS[f]).join(" · ") : "Por edad o IMC, el cribado pidió acompañamiento."}</p>
            </AlertDescription>
          </Alert>
        ) : null}

        <section aria-labelledby="pt-current" className="grid gap-3">
          <h2 id="pt-current" className="text-lg font-semibold tracking-tight">
            Meta vigente
          </h2>
          {active ? (
            <CurrentTarget target={active} setBy={active.source === "professional" ? label(active.created_by) : null} />
          ) : (
            <EmptyState title="Sin meta vigente" description="Esta persona aún no tiene una meta para hoy." />
          )}
        </section>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Objetivo</CardTitle>
          </CardHeader>
          <CardContent>
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
                  <dt className="text-muted-foreground">Gasto estimado</dt>
                  <dd className="font-medium">{mctx.tdee != null ? formatKcal(mctx.tdee) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Metabolismo basal</dt>
                  <dd className="font-medium">{mctx.bmr != null ? formatKcal(mctx.bmr) : "—"}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Sin objetivo activo.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="flex items-center gap-2">
                <UtensilsCrossed className="size-4" aria-hidden="true" /> Últimos 7 días
              </CardTitle>
            </CardHeader>
            <CardContent>
              {totals && totals.length > 0 ? (
                <ul className="grid gap-2 text-sm" data-numeric="">
                  {totals.map((d) => (
                    <li key={d.local_date} className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{d.local_date ? formatShortDate(d.local_date) : "—"}</span>
                      <span className="font-medium">
                        {formatKcal(d.energy_kcal ?? 0)} · P {Math.round(d.protein_g ?? 0)} g
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Sin comidas registradas esta semana.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle as="h2" className="flex items-center gap-2">
                <Scale className="size-4" aria-hidden="true" /> Pesajes recientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weights && weights.length > 0 ? (
                <ul className="grid gap-2 text-sm" data-numeric="">
                  {weights.map((w) => (
                    <li key={w.local_date} className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{formatShortDate(w.local_date)}</span>
                      <span className="font-medium">{formatKg(Number(w.weight_kg))}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Sin pesajes registrados.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Fijar una meta</CardTitle>
            <CardDescription>
              {canWrite
                ? "La persona verá que la fijaste tú. Puedes indicar desde qué día rige."
                : "Esta persona te dio acceso solo para ver: no puedes fijar metas."}
            </CardDescription>
          </CardHeader>
          {canWrite ? (
            <CardContent>
              <ManualTargetsForm
                context={mctx}
                professional={{ patientId: userId, today: ctx.today }}
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
          ) : null}
        </Card>

        <section aria-labelledby="pt-history" className="grid gap-3">
          <h2 id="pt-history" className="text-lg font-semibold tracking-tight">
            Historial de metas
          </h2>
          <TargetHistory
            rows={history}
            activeId={active?.id ?? null}
            today={ctx.today}
            creatorLabel={(row) => (row.source === "professional" ? `por ${label(row.created_by)}` : null)}
          />
        </section>
      </div>
    </>
  );
}
