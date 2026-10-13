import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { formatNumber } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { setFoodVerificationAction } from "@/features/admin/actions/foods";
import { ActionButton, ConfirmActionButton } from "@/features/admin/components/action-buttons";
import { pageParam, Pagination } from "@/features/admin/components/admin-ui";
import { FoodRowSummary } from "@/features/admin/components/food-list";
import { FoodsNav } from "@/features/admin/components/foods-nav";
import { FOODS_PER_PAGE, listVerificationQueue } from "@/features/admin/server/foods";

export const metadata: Metadata = { title: "Verificación de alimentos" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function FoodVerificationPage({ searchParams }: Props) {
  await requireRole("editor");
  const page = pageParam((await searchParams).page);
  const supabase = await createSupabaseServerClient();
  const { rows, total } = await listVerificationQueue(supabase, page);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Alimentos"
        title="Cola de verificación"
        description="Alimentos públicos sin revisar, del más antiguo al más nuevo. Compara con la fuente antes de marcarlos."
      />
      <FoodsNav current="/admin/alimentos/verificacion" pending={total} />
      <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
        <li className="rounded-xl bg-muted px-3 py-2">
          <strong className="text-foreground">Revisado:</strong> valores coherentes con su fuente.
        </li>
        <li className="rounded-xl bg-muted px-3 py-2">
          <strong className="text-foreground">Verificado:</strong> contrastado con una fuente oficial o la etiqueta.
        </li>
        <li className="rounded-xl bg-muted px-3 py-2">
          <strong className="text-foreground">Rechazado:</strong> deja de salir en búsquedas; no se borra.
        </li>
      </ul>

      {rows.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="No hay alimentos por verificar" description="La cola está al día." />
      ) : (
        <>
          <p className="text-sm text-muted-foreground" data-numeric="">
            {formatNumber(total)} por verificar
          </p>
          <ul className="grid gap-3">
            {rows.map((food) => (
              <li key={food.id} className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <FoodRowSummary food={food} />
                <p className="break-words text-xs text-muted-foreground">Fuente: {food.source_ref ?? "sin referencia"}</p>
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    size="sm"
                    variant="secondary"
                    action={setFoodVerificationAction.bind(null, { foodId: food.id, status: "verified" })}
                    successMessage={`«${food.name}» verificado.`}
                  >
                    Verificado
                  </ActionButton>
                  <ActionButton
                    size="sm"
                    variant="outline"
                    action={setFoodVerificationAction.bind(null, { foodId: food.id, status: "curated" })}
                    successMessage={`«${food.name}» marcado como revisado.`}
                  >
                    Revisado
                  </ActionButton>
                  <ConfirmActionButton
                    size="sm"
                    variant="ghost"
                    action={setFoodVerificationAction.bind(null, { foodId: food.id, status: "rejected" })}
                    successMessage={`«${food.name}» rechazado.`}
                    title="¿Rechazar este alimento?"
                    description={<p>«{food.name}» dejará de aparecer en las búsquedas. No se borra: quien ya lo registró conserva su historial.</p>}
                    confirmLabel="Sí, rechazar"
                    destructive
                  >
                    Rechazar
                  </ConfirmActionButton>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/admin/alimentos/${food.id}`}>
                      <Pencil aria-hidden="true" />
                      Editar
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} total={total} perPage={FOODS_PER_PAGE} basePath="/admin/alimentos/verificacion" params={{}} />
        </>
      )}
    </div>
  );
}
