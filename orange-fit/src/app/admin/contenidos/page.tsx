import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, Newspaper, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteContentPageAction, moveContentPageAction, setContentStatusAction } from "@/features/admin/actions/content";
import { ActionButton, ConfirmActionButton } from "@/features/admin/components/action-buttons";
import { enumParam, Field, FilterBar, formatDateTime, NativeSelect, stringParam } from "@/features/admin/components/admin-ui";
import { CONTENT_KIND_HINTS, CONTENT_KIND_LABELS, CONTENT_KINDS, CONTENT_STATUS_LABELS, CONTENT_STATUSES } from "@/features/admin/lib/labels";
import { listContentPages, type ContentListItem } from "@/features/admin/server/content";

export const metadata: Metadata = { title: "Contenidos" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminContentPage({ searchParams }: Props) {
  await requireRole("editor");
  const sp = await searchParams;
  const kind = enumParam(sp.tipo, CONTENT_KINDS);
  const status = enumParam(sp.estado, CONTENT_STATUSES);
  const q = stringParam(sp.q, 100);
  const supabase = await createSupabaseServerClient();
  const pages = await listContentPages(supabase, { kind, status, q });
  const filtered = Boolean(kind || status || q);
  // Subir/bajar solo tiene sentido viendo el tipo completo (sin filtros de estado ni búsqueda).
  const canReorder = !status && !q;
  const groups = CONTENT_KINDS.map((k) => ({ kind: k, items: pages.filter((p) => p.kind === k) })).filter((g) => g.items.length > 0);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Contenido"
        title="Contenidos"
        description="Preguntas frecuentes, textos legales y bloques del sitio, en markdown seguro. Solo lo publicado se ve en el sitio."
        actions={
          <Button asChild>
            <Link href="/admin/contenidos/nuevo">
              <Plus aria-hidden="true" />
              Nuevo contenido
            </Link>
          </Button>
        }
      />
      <FilterBar action="/admin/contenidos" clearHref={filtered ? "/admin/contenidos" : undefined}>
        <Field label="Buscar" htmlFor="q">
          <Input id="q" name="q" type="search" defaultValue={q ?? ""} placeholder="Título o slug" autoComplete="off" />
        </Field>
        <Field label="Tipo" htmlFor="tipo">
          <NativeSelect id="tipo" name="tipo" defaultValue={kind ?? ""}>
            <option value="">Todos</option>
            {CONTENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {CONTENT_KIND_LABELS[k]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Estado" htmlFor="estado">
          <NativeSelect id="estado" name="estado" defaultValue={status ?? ""}>
            <option value="">Todos</option>
            {CONTENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CONTENT_STATUS_LABELS[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </FilterBar>

      {groups.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title={filtered ? "Nada coincide con los filtros" : "Todavía no hay contenidos"}
          action={
            <Button asChild variant="outline">
              <Link href="/admin/contenidos/nuevo">Nuevo contenido</Link>
            </Button>
          }
        />
      ) : (
        groups.map((group) => (
          <section key={group.kind} aria-labelledby={`grupo-${group.kind}`} className="grid gap-3">
            <div className="grid gap-1">
              <h2 id={`grupo-${group.kind}`} className="text-lg font-semibold tracking-tight">
                {CONTENT_KIND_LABELS[group.kind]} <span className="text-sm font-normal text-muted-foreground">({group.items.length})</span>
              </h2>
              <p className="text-sm text-muted-foreground">{CONTENT_KIND_HINTS[group.kind]}</p>
            </div>
            <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {group.items.map((page, index) => (
                <ContentRow key={page.id} page={page} first={index === 0} last={index === group.items.length - 1} canReorder={canReorder} />
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}

function ContentRow({ page, first, last, canReorder }: { page: ContentListItem; first: boolean; last: boolean; canReorder: boolean }) {
  const published = page.status === "published";
  return (
    <li className="grid gap-3 px-4 py-3 sm:flex sm:items-center">
      <div className="grid min-w-0 flex-1 gap-1">
        <Link href={`/admin/contenidos/${page.id}`} className="truncate font-medium text-foreground underline-offset-4 hover:underline">
          {page.title}
        </Link>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant={published ? "success" : "secondary"}>{CONTENT_STATUS_LABELS[published ? "published" : "draft"]}</Badge>
          <span className="font-mono">{page.slug}</span>
          <span data-numeric="">· orden {page.sort_order}</span>
          <span>· {formatDateTime(page.updated_at)}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {canReorder ? (
          <>
            <ActionButton
              variant="ghost"
              size="icon-sm"
              aria-label={`Subir «${page.title}»`}
              disabled={first}
              action={moveContentPageAction.bind(null, { id: page.id, direction: "up" })}
              successMessage="Orden actualizado."
            >
              <ArrowUp aria-hidden="true" />
            </ActionButton>
            <ActionButton
              variant="ghost"
              size="icon-sm"
              aria-label={`Bajar «${page.title}»`}
              disabled={last}
              action={moveContentPageAction.bind(null, { id: page.id, direction: "down" })}
              successMessage="Orden actualizado."
            >
              <ArrowDown aria-hidden="true" />
            </ActionButton>
          </>
        ) : null}
        <ActionButton
          variant="outline"
          size="sm"
          action={setContentStatusAction.bind(null, { id: page.id, status: published ? "draft" : "published" })}
          successMessage={published ? "Contenido despublicado." : "Contenido publicado."}
        >
          {published ? "Despublicar" : "Publicar"}
        </ActionButton>
        <Button asChild variant="ghost" size="icon-sm">
          <Link href={`/admin/contenidos/${page.id}`} aria-label={`Editar «${page.title}»`}>
            <Pencil aria-hidden="true" />
          </Link>
        </Button>
        <ConfirmActionButton
          variant="ghost"
          size="icon-sm"
          aria-label={`Eliminar «${page.title}»`}
          action={deleteContentPageAction.bind(null, { id: page.id })}
          successMessage="Contenido eliminado."
          title="¿Eliminar este contenido?"
          description={<p>«{page.title}» se borra para siempre. Si solo quieres ocultarlo, despublícalo.</p>}
          confirmLabel="Sí, eliminar"
          destructive
        >
          <Trash2 aria-hidden="true" />
        </ConfirmActionButton>
      </div>
    </li>
  );
}
