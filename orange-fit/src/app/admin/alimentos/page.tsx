import type { Metadata } from "next";
import Link from "next/link";
import { Apple, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { formatNumber } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enumParam, Field, FilterBar, NativeSelect, pageParam, Pagination, stringParam } from "@/features/admin/components/admin-ui";
import { FoodList } from "@/features/admin/components/food-list";
import { FoodsNav } from "@/features/admin/components/foods-nav";
import { FOOD_SOURCE_LABELS, FOOD_SOURCES, VERIFICATION_LABELS, VERIFICATION_STATUSES } from "@/features/admin/lib/labels";
import { countUnverifiedFoods, FOODS_PER_PAGE, listFoods } from "@/features/admin/server/foods";

export const metadata: Metadata = { title: "Alimentos" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminFoodsPage({ searchParams }: Props) {
  await requireRole("editor");
  const sp = await searchParams;
  const q = stringParam(sp.q, 100);
  const source = enumParam(sp.fuente, FOOD_SOURCES);
  const status = enumParam(sp.estado, VERIFICATION_STATUSES);
  const visibility = enumParam(sp.visibilidad, ["public", "hidden"] as const);
  const page = pageParam(sp.page);
  const supabase = await createSupabaseServerClient();
  const [{ rows, total }, pending] = await Promise.all([listFoods(supabase, { q, source, status, visibility, page }), countUnverifiedFoods(supabase)]);
  const params = { q, fuente: source, estado: status, visibilidad: visibility };
  const filtered = Object.values(params).some(Boolean);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Contenido"
        title="Alimentos"
        description="Catálogo público: valores por 100 g con su procedencia. Los alimentos propios de cada persona no aparecen aquí."
        actions={
          <Button asChild>
            <Link href="/admin/alimentos/nuevo">
              <Plus aria-hidden="true" />
              Nuevo alimento
            </Link>
          </Button>
        }
      />
      <FoodsNav current="/admin/alimentos" pending={pending} />
      <FilterBar action="/admin/alimentos" clearHref={filtered ? "/admin/alimentos" : undefined} className="lg:grid-cols-5">
        <Field label="Buscar" htmlFor="q">
          <Input id="q" name="q" type="search" defaultValue={q ?? ""} placeholder="Nombre o código de barras" autoComplete="off" />
        </Field>
        <Field label="Fuente" htmlFor="fuente">
          <NativeSelect id="fuente" name="fuente" defaultValue={source ?? ""}>
            <option value="">Todas</option>
            {FOOD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {FOOD_SOURCE_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Verificación" htmlFor="estado">
          <NativeSelect id="estado" name="estado" defaultValue={status ?? ""}>
            <option value="">Todas</option>
            {VERIFICATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {VERIFICATION_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Visibilidad" htmlFor="visibilidad">
          <NativeSelect id="visibilidad" name="visibilidad" defaultValue={visibility ?? ""}>
            <option value="">Todos</option>
            <option value="public">En el catálogo</option>
            <option value="hidden">Fuera del catálogo</option>
          </NativeSelect>
        </Field>
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState
          icon={Apple}
          title={filtered ? "Ningún alimento coincide" : "El catálogo está vacío"}
          description={filtered ? "Prueba con otra palabra o quita filtros." : "Crea el primero o impórtalo desde USDA."}
          action={
            <Button asChild variant="outline">
              <Link href="/admin/alimentos/nuevo">Nuevo alimento</Link>
            </Button>
          }
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground" data-numeric="">
            {formatNumber(total)} {total === 1 ? "alimento" : "alimentos"}
          </p>
          <FoodList foods={rows} />
          <Pagination page={page} total={total} perPage={FOODS_PER_PAGE} basePath="/admin/alimentos" params={params} />
        </>
      )}
    </div>
  );
}
