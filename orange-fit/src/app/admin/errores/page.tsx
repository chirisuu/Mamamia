import type { Metadata } from "next";
import { Bug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { formatNumber } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { setErrorStatusAction } from "@/features/admin/actions/errors";
import { ActionButton } from "@/features/admin/components/action-buttons";
import { buildHref, enumParam, Field, FilterBar, formatDateTime, pageParam, Pagination, stringParam, SubNav } from "@/features/admin/components/admin-ui";
import { ERROR_STATUS_LABELS, ERROR_STATUSES, type ErrorStatus } from "@/features/admin/lib/labels";
import { ERRORS_PER_PAGE, listErrorReports } from "@/features/admin/server/errors";

export const metadata: Metadata = { title: "Errores" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const NEXT_STEPS: Record<ErrorStatus, Array<{ status: ErrorStatus; label: string }>> = {
  new: [
    { status: "triaged", label: "Marcar en revisión" },
    { status: "resolved", label: "Marcar resuelto" },
  ],
  triaged: [
    { status: "resolved", label: "Marcar resuelto" },
    { status: "new", label: "Volver a nuevo" },
  ],
  resolved: [{ status: "triaged", label: "Reabrir" }],
};

const STATUS_BADGE: Record<ErrorStatus, "default" | "soft" | "secondary"> = { new: "default", triaged: "soft", resolved: "secondary" };

export default async function AdminErrorsPage({ searchParams }: Props) {
  await requireRole("admin");
  const sp = await searchParams;
  const status = enumParam(sp.estado, ERROR_STATUSES) ?? (sp.estado === "todos" ? null : "new");
  const route = stringParam(sp.ruta, 120);
  const page = pageParam(sp.page);
  const supabase = await createSupabaseServerClient();
  const { rows, total, counts } = await listErrorReports(supabase, { status, route, page });
  const tabParam = status ?? "todos";

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Administración"
        title="Errores"
        description="Errores que vio la gente en la app (mensaje, ruta y referencia). No incluyen datos personales: solo si había sesión."
      />
      <SubNav
        label="Estado de los errores"
        current={buildHref("/admin/errores", { estado: tabParam === "new" ? null : tabParam, ruta: route })}
        items={[
          { href: buildHref("/admin/errores", { ruta: route }), label: "Nuevos", count: counts.new },
          { href: buildHref("/admin/errores", { estado: "triaged", ruta: route }), label: "En revisión", count: counts.triaged },
          { href: buildHref("/admin/errores", { estado: "resolved", ruta: route }), label: "Resueltos" },
          { href: buildHref("/admin/errores", { estado: "todos", ruta: route }), label: "Todos" },
        ]}
      />
      <FilterBar action="/admin/errores" clearHref={route ? buildHref("/admin/errores", { estado: tabParam === "new" ? null : tabParam }) : undefined}>
        {tabParam !== "new" ? <input type="hidden" name="estado" value={tabParam} /> : null}
        <Field label="Ruta" htmlFor="ruta" className="sm:col-span-2 lg:col-span-3">
          <Input id="ruta" name="ruta" type="search" defaultValue={route ?? ""} placeholder="/app/diario" autoComplete="off" />
        </Field>
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState
          icon={Bug}
          title={status === "new" && !route ? "No hay errores nuevos" : "No hay errores con estos filtros"}
          description={status === "new" && !route ? "Cuando alguien vea una pantalla de error, se registrará aquí." : undefined}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground" data-numeric="">
            {formatNumber(total)} {total === 1 ? "reporte" : "reportes"}
          </p>
          <ul className="grid gap-3">
            {rows.map((r) => {
              const current = (ERROR_STATUSES as readonly string[]).includes(r.status) ? (r.status as ErrorStatus) : "new";
              return (
                <li key={r.id} className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={STATUS_BADGE[current]}>{ERROR_STATUS_LABELS[current]}</Badge>
                    <span className="text-sm text-muted-foreground" data-numeric="">
                      {formatDateTime(r.created_at)}
                    </span>
                    <span className="text-sm text-muted-foreground">· {r.hasUser ? "Con sesión" : "Sin sesión"}</span>
                  </div>
                  <p className="break-words font-medium">{r.message}</p>
                  <dl className="grid gap-1 text-sm sm:grid-cols-[6rem_1fr]">
                    <dt className="text-muted-foreground">Ruta</dt>
                    <dd className="break-all font-mono text-xs">{r.route ?? "—"}</dd>
                    <dt className="text-muted-foreground">Referencia</dt>
                    <dd className="break-all font-mono text-xs">{r.digest ?? "—"}</dd>
                    <dt className="text-muted-foreground">Navegador</dt>
                    <dd className="line-clamp-2 break-all text-xs text-muted-foreground">{r.user_agent ?? "—"}</dd>
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    {NEXT_STEPS[current].map((step) => (
                      <ActionButton
                        key={step.status}
                        variant={step.status === "resolved" ? "secondary" : "outline"}
                        size="sm"
                        action={setErrorStatusAction.bind(null, { id: r.id, status: step.status })}
                        successMessage={`Marcado como «${ERROR_STATUS_LABELS[step.status].toLowerCase()}».`}
                      >
                        {step.label}
                      </ActionButton>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination page={page} total={total} perPage={ERRORS_PER_PAGE} basePath="/admin/errores" params={{ estado: tabParam === "new" ? null : tabParam, ruta: route }} />
        </>
      )}
    </div>
  );
}
