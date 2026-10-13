import type { Metadata } from "next";
import { Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { getRoles, hasRole, requireRole } from "@/lib/auth/session";
import { formatNumber } from "@/lib/format";
import { integrationStatus } from "@/lib/server-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Field, FilterBar, formatDateOnly, formatDateTime, pageParam, Pagination, stringParam } from "@/features/admin/components/admin-ui";
import { RoleManager } from "@/features/admin/components/role-manager";
import { ROLE_LABELS, labelOf } from "@/features/admin/lib/labels";
import { AdminOpError } from "@/features/admin/server/db";
import { listAdminUsers, type AdminUserPage } from "@/features/admin/server/users";

export const metadata: Metadata = { title: "Usuarios" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminUsersPage({ searchParams }: Props) {
  await requireRole("admin");
  const isSuperadmin = hasRole(await getRoles(), "superadmin");
  const sp = await searchParams;
  const page = pageParam(sp.page);
  const email = stringParam(sp.q, 120);

  const header = (
    <PageHeader
      eyebrow="Administración"
      title="Usuarios"
      description="Solo correo, fechas, plan y roles. Los datos de salud de las personas no se muestran en el panel."
    />
  );

  if (!integrationStatus().supabaseAdmin) {
    return (
      <div className="grid gap-6">
        {header}
        <Alert variant="warning">
          <AlertTitle>Pendiente de configurar</AlertTitle>
          <AlertDescription>
            <p>
              La lista de cuentas usa la API de administración de Supabase y necesita <code>SUPABASE_SERVICE_ROLE_KEY</code> en el servidor.
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  let result: AdminUserPage | null = null;
  let errorMessage: string | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    result = await listAdminUsers(supabase, createSupabaseAdminClient(), { page, email });
  } catch (error) {
    errorMessage = error instanceof AdminOpError ? error.message : "No se pudo leer la lista de usuarios.";
  }

  return (
    <div className="grid gap-6">
      {header}
      <FilterBar action="/admin/usuarios" clearHref={email ? "/admin/usuarios" : undefined}>
        <Field label="Buscar por correo" htmlFor="q" className="sm:col-span-2 lg:col-span-3">
          <Input id="q" name="q" type="search" defaultValue={email ?? ""} placeholder="nombre@correo.com" inputMode="email" autoComplete="off" />
        </Field>
      </FilterBar>

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>No pudimos cargar los usuarios</AlertTitle>
          <AlertDescription>
            <p>{errorMessage}</p>
          </AlertDescription>
        </Alert>
      ) : result && result.users.length === 0 ? (
        <EmptyState icon={Users} title={email ? "Ninguna cuenta coincide" : "Todavía no hay cuentas"} description={email ? `No encontramos correos con «${email}».` : undefined} />
      ) : result ? (
        <>
          <p className="text-sm text-muted-foreground" data-numeric="">
            {formatNumber(result.total)} {result.total === 1 ? "cuenta" : "cuentas"}
            {email ? ` con «${email}»` : ""}
          </p>
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <caption className="sr-only">Cuentas registradas</caption>
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Correo</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Alta</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Último ingreso</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Plan</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Roles</th>
                  {isSuperadmin ? <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">Acciones</span></th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.users.map((u) => (
                  <tr key={u.id} className="align-middle">
                    <td className="max-w-[18rem] truncate px-4 py-3 font-medium" title={u.email ?? undefined}>
                      {u.email ?? <span className="text-muted-foreground">Sin correo</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3" data-numeric="">{formatDateOnly(u.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3" data-numeric="">{u.lastSignInAt ? formatDateTime(u.lastSignInAt) : "Nunca"}</td>
                    <td className="px-4 py-3">
                      {u.plan === "premium" ? (
                        <Badge variant="default">{u.planStatus === "trialing" ? "Premium (prueba)" : "Premium"}</Badge>
                      ) : (
                        <Badge variant="secondary">Gratis</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length ? u.roles.map((r) => <Badge key={r} variant="outline">{labelOf(ROLE_LABELS, r)}</Badge>) : <span className="text-muted-foreground">—</span>}
                      </div>
                    </td>
                    {isSuperadmin ? (
                      <td className="px-4 py-3 text-right">
                        <RoleManager userId={u.id} email={u.email} roles={u.roles} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={result.total} perPage={result.perPage} basePath="/admin/usuarios" params={{ q: email }} />
          {!isSuperadmin ? <p className="text-xs text-muted-foreground">Solo un superadmin puede otorgar o quitar roles.</p> : null}
        </>
      ) : null}
    </div>
  );
}
