import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app/app-header";
import { PremiumGate } from "@/components/app/premium-gate";
import { hasFeature } from "@/lib/billing/entitlements";
import { PlanEditor } from "@/features/planner/components/plan-editor";
import { PlanLockedActions } from "@/features/planner/components/plan-locked-actions";
import { getPlan, getPlannerContext } from "@/features/planner/queries";
import { getRecipesPageContext } from "@/features/recipes/server/page-context";

export const metadata: Metadata = { title: "Plan de comidas" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await getRecipesPageContext(`/app/plan/${id}`);
  const plan = await getPlan(ctx.supabase, ctx.user.id, id);
  if (!plan) notFound();
  const [premium, canExport, canShop] = await Promise.all([hasFeature("meal_plans"), hasFeature("exports"), hasFeature("shopping_list")]);

  if (!premium) {
    return (
      <>
        <AppHeader title={plan.name} backHref="/app/plan" backLabel="Volver a planes" />
        <div className="flex flex-col gap-4 pt-2">
          <PremiumGate feature="meal_plans">{null}</PremiumGate>
          <PlanLockedActions planId={plan.id} shared={Boolean(plan.shareToken)} />
        </div>
      </>
    );
  }

  const planner = await getPlannerContext(ctx.supabase, ctx.user.id, ctx.today);
  const canRegenerate = plan.params.targetKcal != null && !planner.autoPlansBlocked && planner.pool.length > 0;
  return (
    <>
      <AppHeader title={plan.name} subtitle="Revisa, ajusta y guarda" backHref="/app/plan" backLabel="Volver a planes" />
      <div className="pt-2">
        <PlanEditor
          // Al guardar, el servidor devuelve ítems nuevos: el editor se reinicia con ellos.
          key={plan.updatedAt}
          initialDraft={{
            id: plan.id,
            name: plan.name,
            startDate: plan.startDate,
            days: plan.days,
            generator: plan.generator,
            status: plan.status,
            params: plan.params,
            items: plan.items,
          }}
          pool={planner.pool}
          planId={plan.id}
          shareToken={plan.shareToken}
          today={ctx.today}
          tomorrow={ctx.tomorrow}
          canRegenerate={canRegenerate}
          canExport={canExport}
          canShop={canShop}
          floorNote={plan.params.floorApplied ? "Tu meta guardada estaba por debajo del mínimo prudente: este plan usa el piso de seguridad." : null}
        />
      </div>
    </>
  );
}
