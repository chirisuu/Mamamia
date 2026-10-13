import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { formatNumber } from "@/lib/format";
import { integrationStatus } from "@/lib/server-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Field, FilterBar, formatDateTime, NativeSelect, Pagination } from "@/features/admin/components/admin-ui";
import { AUDIT_ACTION_GROUPS, AUDIT_ACTION_LABELS, AUDIT_TABLES } from "@/features/admin/lib/labels";
import { AUDIT_PER_PAGE, auditFiltersSchema, listAuditLogs, listStaff } from "@/features/admin/server/audit-log";

export const metadata: Metadata = { title: "Auditoría" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

/** Metadatos mínimos (ids, códigos, conteos) en una línea legible. */
function formatMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  return Object.entries(metadata as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

export default async function AdminAuditPage({ searchParams }: Props) {
  await requireRole("admin");
  const sp = await searchParams;
  const filters = auditFiltersSchema.parse({
    action: first(sp.accion),
    table: first(sp.tabla),
    actor: first(sp.autor),
    from: first(sp.desde),
    to: first(sp.hasta),
    page: first(sp.page) ?? 1,
  });

  const supabase = await createSupabaseServerClient();
  // El cliente admin (solo para mostrar el correo del staff) se crea tras requireRole("admin").
  const admin = integrationStatus().supabaseAdmin ? createSupabaseAdminClient() : null;
  const [{ rows, total }, staff] = await Promise.all([listAuditLogs(supabase, filters), listStaff(supabase, admin)]);
  const emailOf = new Map(staff.map((s) => [s.id, s.email]));
  const params = { accion: filters.action, tabla: filters.table, autor: filters.actor, desde: filters.from, hasta: filters.to };
  const filtered = Object.values(params).some(Boolean);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Administración"
        title="Auditoría"
        description="Cada cambio hecho desde el panel queda aquí: quién, qué y cuándo. Solo ids y códigos, nunca datos de salud."
      />

      <FilterBar action="/admin/auditoria" clearHref={filtered ? "/admin/auditoria" : undefined} className="lg:grid-cols-6">
        <Field label="Acción" htmlFor="accion">
          <NativeSelect id="accion" name="accion" defaultValue={filters.action ?? ""}>
            <option value="">Todas</option>
            {AUDIT_ACTION_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Tabla" htmlFor="tabla">
          <NativeSelect id="tabla" name="tabla" defaultValue={filters.table ?? ""}>
            <option value="">Todas</option>
            {AUDIT_TABLES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Autor" htmlFor="autor">
          <NativeSelect id="autor" name="autor" defaultValue={filters.actor ?? ""}>
            <option value="">Todo el equipo</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.email ?? `${s.id.slice(0, 8)}…`}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Desde" htmlFor="desde">
          <Input id="desde" name="desde" type="date" defaultValue={filters.from ?? ""} />
        </Field>
        <Field label="Hasta" htmlFor="hasta">
          <Input id="hasta" name="hasta" type="date" defaultValue={filters.to ?? ""} />
        </Field>
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={filtered ? "Nada coincide con los filtros" : "Todavía no hay acciones registradas"}
          description={filtered ? "Prueba con otro rango de fechas o quita algún filtro." : "Cuando el equipo cambie algo desde el panel, aparecerá aquí."}
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground" data-numeric="">
            {formatNumber(total)} {total === 1 ? "registro" : "registros"} · fechas en hora de Lima
          </p>
          <ol className="grid gap-2">
            {rows.map((row) => {
              const meta = formatMetadata(row.metadata);
              const actor = row.actor_id ? (emailOf.get(row.actor_id) ?? `${row.actor_id.slice(0, 8)}…`) : "Sistema";
              return (
                <li key={row.id} className="grid gap-1.5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-[12rem_1fr] sm:gap-4">
                  <div className="grid content-start gap-0.5">
                    <p className="text-sm font-medium" data-numeric="">
                      {formatDateTime(row.created_at)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground" title={actor}>
                      {actor}
                    </p>
                  </div>
                  <div className="grid min-w-0 gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{AUDIT_ACTION_LABELS[row.action] ?? row.action}</p>
                      <Badge variant="outline" className="font-mono">
                        {row.action}
                      </Badge>
                    </div>
                    {row.target_table ? (
                      <p className="break-all font-mono text-xs text-muted-foreground">
                        {row.target_table}
                        {row.target_id ? ` · ${row.target_id}` : ""}
                      </p>
                    ) : null}
                    {meta ? <p className="break-words text-sm text-muted-foreground">{meta}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
          <Pagination page={filters.page} total={total} perPage={AUDIT_PER_PAGE} basePath="/admin/auditoria" params={params} />
        </>
      )}
    </div>
  );
}
