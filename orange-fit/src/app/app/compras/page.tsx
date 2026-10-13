import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ShoppingBasket } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { PremiumGate } from "@/components/app/premium-gate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { hasFeature } from "@/lib/billing/entitlements";
import { formatShortDate } from "@/lib/format";
import { listPlans, type PlanSummary } from "@/features/planner/queries";
import { PLAN_STATUS_LABELS } from "@/features/planner/lib/types";
import { getRecipesPageContext } from "@/features/recipes/server/page-context";
import { GenerateListForm } from "@/features/shopping/components/generate-list-form";
import { ListProgressBadge } from "@/features/shopping/components/shopping-list-view";
import { listShoppingLists, type ShoppingListSummary } from "@/features/shopping/queries";

export const metadata: Metadata = { title: "Lista de compras" };

export default async function ShoppingPage() {
  const ctx = await getRecipesPageContext("/app/compras");
  const premium = await hasFeature("shopping_list");
  let lists: ShoppingListSummary[] | null = null;
  let plans: PlanSummary[] = [];
  try {
    [lists, plans] = await Promise.all([listShoppingLists(ctx.supabase, ctx.user.id), premium ? listPlans(ctx.supabase, ctx.user.id) : Promise.resolve([])]);
  } catch {
    lists = null;
  }
  const usablePlans = plans.filter((p) => p.itemsCount > 0 && p.status !== "archived");

  return (
    <>
      <AppHeader title="Lista de compras" subtitle="Desde tu plan, con precios referenciales" />
      <div className="flex flex-col gap-6 pb-8 pt-2">
        <PremiumGate feature="shopping_list">
          <section aria-labelledby="nueva-lista" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 id="nueva-lista" className="text-base font-semibold">
              Nueva lista desde un plan
            </h2>
            {usablePlans.length ? (
              <GenerateListForm
                plans={usablePlans.map((p) => ({ id: p.id, label: `${p.name} · ${PLAN_STATUS_LABELS[p.status]} · ${formatShortDate(p.startDate)}` }))}
              />
            ) : (
              <div className="flex flex-col items-start gap-2 text-sm">
                <p className="text-muted-foreground">Necesitas un plan guardado con comidas para armar la lista.</p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/app/plan/nuevo">Crear un plan</Link>
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Sumamos los ingredientes de todas las recetas, los agrupamos por categoría y calculamos cantidades de compra. Los precios son
              referenciales, no en tiempo real.
            </p>
          </section>
        </PremiumGate>

        <section aria-labelledby="mis-listas" className="flex flex-col gap-3">
          <h2 id="mis-listas" className="text-lg font-semibold tracking-tight">
            Mis listas
          </h2>
          {lists === null ? (
            <Alert variant="destructive">
              <AlertTitle>No pudimos cargar tus listas</AlertTitle>
              <AlertDescription>
                <p>Revisa tu conexión y vuelve a intentarlo.</p>
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <Link href="/app/compras">Reintentar</Link>
                </Button>
              </AlertDescription>
            </Alert>
          ) : lists.length === 0 ? (
            <EmptyState icon={ShoppingBasket} title="Aún no tienes listas" description="Cuando generes una desde tu plan, aparecerá aquí." />
          ) : (
            <ul className="flex flex-col gap-2">
              {lists.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/app/compras/${l.id}`}
                    className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{l.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatShortDate(l.createdAt.slice(0, 10))}
                        {l.planName ? ` · ${l.planName}` : ""}
                      </p>
                    </div>
                    <ListProgressBadge checked={l.checkedCount} total={l.itemsCount} />
                    <ChevronRight className="size-5 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
