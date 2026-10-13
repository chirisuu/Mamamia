import type { Metadata } from "next";
import Link from "next/link";
import { ChefHat, ChevronRight, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { formatNumber } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildHref, enumParam, Field, FilterBar, formatDateTime, NativeSelect, pageParam, Pagination, stringParam, SubNav } from "@/features/admin/components/admin-ui";
import { RECIPE_STATUS_LABELS, RECIPE_STATUSES } from "@/features/admin/lib/labels";
import { countPendingRecipes, listAdminRecipes, RECIPES_PER_PAGE } from "@/features/admin/server/recipes";

export const metadata: Metadata = { title: "Recetas" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const STATUS_BADGE = { pending_review: "default", published: "success", draft: "secondary", rejected: "outline" } as const;

export default async function AdminRecipesPage({ searchParams }: Props) {
  await requireRole("editor");
  const sp = await searchParams;
  const status = enumParam(sp.estado, RECIPE_STATUSES);
  const origin = enumParam(sp.origen, ["official", "users"] as const);
  const q = stringParam(sp.q, 100);
  const page = pageParam(sp.page);
  const supabase = await createSupabaseServerClient();
  const [{ rows, total }, pending] = await Promise.all([listAdminRecipes(supabase, { status, origin, q, page }), countPendingRecipes(supabase)]);
  const base = { origen: origin, q };

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Contenido"
        title="Recetas"
        description="Modera las recetas que envían las personas y edita las oficiales. Los borradores de cada persona son privados y no aparecen aquí."
        actions={
          <Button asChild>
            <Link href="/admin/recetas/nueva">
              <Plus aria-hidden="true" />
              Nueva receta oficial
            </Link>
          </Button>
        }
      />
      <SubNav
        label="Estado de las recetas"
        current={buildHref("/admin/recetas", { ...base, estado: status })}
        items={[
          { href: buildHref("/admin/recetas", base), label: "Todas" },
          { href: buildHref("/admin/recetas", { ...base, estado: "pending_review" }), label: "En revisión", count: pending },
          { href: buildHref("/admin/recetas", { ...base, estado: "published" }), label: "Publicadas" },
          { href: buildHref("/admin/recetas", { ...base, estado: "rejected" }), label: "Rechazadas" },
          { href: buildHref("/admin/recetas", { ...base, estado: "draft" }), label: "Borradores oficiales" },
        ]}
      />
      <FilterBar action="/admin/recetas" clearHref={origin || q ? buildHref("/admin/recetas", { estado: status }) : undefined}>
        {status ? <input type="hidden" name="estado" value={status} /> : null}
        <Field label="Buscar" htmlFor="q" className="lg:col-span-2">
          <Input id="q" name="q" type="search" defaultValue={q ?? ""} placeholder="Título o slug" autoComplete="off" />
        </Field>
        <Field label="Origen" htmlFor="origen">
          <NativeSelect id="origen" name="origen" defaultValue={origin ?? ""}>
            <option value="">Todas</option>
            <option value="official">Oficiales</option>
            <option value="users">De usuarios</option>
          </NativeSelect>
        </Field>
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState
          icon={ChefHat}
          title={status === "pending_review" ? "No hay recetas por revisar" : "No hay recetas con estos filtros"}
          description={status === "pending_review" ? "Cuando alguien envíe una receta a revisión, aparecerá aquí." : undefined}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground" data-numeric="">
            {formatNumber(total)} {total === 1 ? "receta" : "recetas"}
          </p>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/recetas/${r.id}`}
                  className="flex min-h-16 items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <div className="grid min-w-0 flex-1 gap-1">
                    <p className="truncate font-medium">{r.title}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={STATUS_BADGE[r.status]}>{RECIPE_STATUS_LABELS[r.status]}</Badge>
                      <Badge variant="secondary">{r.isOfficial ? "Oficial" : "De usuario"}</Badge>
                      {r.isOfficial && !r.image_path ? <Badge variant="outline">Sin imagen</Badge> : null}
                      <span className="text-xs text-muted-foreground" data-numeric="">
                        {formatDateTime(r.updated_at)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="sr-only">{r.status === "pending_review" ? "Revisar" : "Abrir"}</span>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={page} total={total} perPage={RECIPES_PER_PAGE} basePath="/admin/recetas" params={{ ...base, estado: status }} />
        </>
      )}
    </div>
  );
}
