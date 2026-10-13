import type { Metadata } from "next";
import { AppHeader } from "@/components/app/app-header";
import { PremiumGate } from "@/components/app/premium-gate";
import { hasFeature } from "@/lib/billing/entitlements";
import { PlanCreator } from "@/features/planner/components/plan-creator";
import { getPlannerContext } from "@/features/planner/queries";
import { getRecipesPageContext } from "@/features/recipes/server/page-context";

export const metadata: Metadata = { title: "Nuevo plan" };

export default async function NewPlanPage() {
  const ctx = await getRecipesPageContext("/app/plan/nuevo");
  const [premium, canExport, canShop] = await Promise.all([hasFeature("meal_plans"), hasFeature("exports"), hasFeature("shopping_list")]);
  const planner = premium ? await getPlannerContext(ctx.supabase, ctx.user.id, ctx.today) : null;
  return (
    <>
      <AppHeader title="Nuevo plan" subtitle="Generado sin IA o armado a mano" backHref="/app/plan" backLabel="Volver a planes" />
      <div className="pt-2">
        <PremiumGate feature="meal_plans">
          {planner ? (
            <PlanCreator
              defaults={planner.defaults}
              pool={planner.pool}
              today={ctx.today}
              tomorrow={ctx.tomorrow}
              autoPlansBlocked={planner.autoPlansBlocked}
              riskMessages={planner.riskMessages}
              targetNotes={planner.targets?.notes ?? []}
              budgetNote={planner.budgetNote}
              canExport={canExport}
              canShop={canShop}
            />
          ) : null}
        </PremiumGate>
      </div>
    </>
  );
}
