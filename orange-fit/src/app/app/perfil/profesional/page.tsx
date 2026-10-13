import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getRoles, hasRole, requireUser } from "@/lib/auth/session";
import { serverEnv } from "@/lib/server-env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AccessList, type AccessItem } from "@/features/profile/components/access-list";
import { GrantAccessForm } from "@/features/profile/components/grant-access-form";
import { getAccessOverview } from "@/features/profile/queries";
import { SCOPE_LABELS, type ProfessionalScope } from "@/features/profile/schemas";

export const metadata: Metadata = { title: "Acceso profesional" };

export default async function ProfessionalAccessPage() {
  const user = await requireUser("/app/perfil/profesional");
  const supabase = await createSupabaseServerClient();
  const [overview, roles] = await Promise.all([getAccessOverview(supabase, user.id), getRoles()]);
  const isProfessional = hasRole(roles, "professional");
  const adminReady = Boolean(serverEnv().SUPABASE_SERVICE_ROLE_KEY);

  const items: AccessItem[] = overview.granted.map((row) => {
    const p = overview.people.get(row.professional_id);
    return {
      id: row.id,
      name: p?.displayName || p?.email || "Profesional",
      email: p?.email ?? null,
      scope: row.scope,
      grantedAt: row.granted_at,
      revokedAt: row.revoked_at,
    };
  });
  const active = items.filter((i) => !i.revokedAt);
  const past = items.filter((i) => i.revokedAt);

  return (
    <>
      <AppHeader title="Acceso profesional" backHref="/app/perfil" backLabel="Volver a Perfil" />
      <div className="grid gap-8 pb-10 pt-2">
        {isProfessional ? (
          <section aria-labelledby="patients-title" className="grid gap-3">
            <div className="grid gap-1">
              <h2 id="patients-title" className="text-lg font-semibold tracking-tight">
                Personas que te dieron acceso
              </h2>
              <p className="text-sm text-muted-foreground">Como profesional, puedes ver sus registros y, si te lo permiten, fijar sus metas.</p>
            </div>
            {overview.received.length === 0 ? (
              <EmptyState icon={Users} title="Aún nadie te dio acceso" description="Pídeles que te agreguen con el correo de tu cuenta." />
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                {overview.received.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/app/perfil/profesional/pacientes/${row.user_id}`}
                      className="flex min-h-14 items-center gap-3 px-4 py-3 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{overview.patientNames.get(row.user_id) || "Persona sin nombre"}</span>
                        <span className="block text-sm text-muted-foreground">{SCOPE_LABELS[row.scope as ProfessionalScope]?.label ?? row.scope}</span>
                      </span>
                      <ChevronRight className="size-5 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle as="h2">Dar acceso a tu nutricionista</CardTitle>
            <CardDescription>
              Solo cuentas registradas como profesionales. Verá tu perfil, objetivo, metas, comidas y peso; nunca tus fotos ni tus
              conversaciones con el asistente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GrantAccessForm
              disabledReason={adminReady ? null : "La búsqueda de profesionales está pendiente de configurar en el servidor (falta SUPABASE_SERVICE_ROLE_KEY)."}
            />
          </CardContent>
        </Card>

        <section aria-labelledby="access-title" className="grid gap-3">
          <h2 id="access-title" className="text-lg font-semibold tracking-tight">
            Quién tiene acceso
          </h2>
          <AccessList items={active} />
          {past.length > 0 ? (
            <details className="rounded-2xl border border-border bg-card">
              <summary className="flex min-h-12 cursor-pointer items-center px-4 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Accesos anteriores ({past.length})
              </summary>
              <div className="p-2">
                <AccessList items={past} />
              </div>
            </details>
          ) : null}
        </section>
      </div>
    </>
  );
}
