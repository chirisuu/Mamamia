import type { Metadata } from "next";
import Link from "next/link";
import { Apple, Bot, Bug, ChefHat, CreditCard, Newspaper, TrendingUp, UserCheck, UserPlus, Users, XCircle, type LucideIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { getRoles, hasRole, requireRole } from "@/lib/auth/session";
import { formatCents, formatNumber } from "@/lib/format";
import { integrationStatus } from "@/lib/server-env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SimpleBarChart } from "@/features/admin/components/bar-chart";
import { formatDateTime } from "@/features/admin/components/admin-ui";
import { IntegrationsCard } from "@/features/admin/components/integrations-card";
import { AI_KIND_LABELS, AI_STATUS_LABELS, labelOf } from "@/features/admin/lib/labels";
import { formatPercent, formatUsd, type AdminMetrics } from "@/features/admin/lib/metrics";
import { getAdminMetrics, getWorkQueues } from "@/features/admin/server/dashboard";
import { AdminOpError } from "@/features/admin/server/db";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  await requireRole("editor");
  const isAdmin = hasRole(await getRoles(), "admin");
  const supabase = await createSupabaseServerClient();

  const [queues, metrics] = await Promise.all([
    getWorkQueues(supabase),
    isAdmin
      ? getAdminMetrics(supabase).then(
          (m) => ({ ok: true as const, m }),
          (e: unknown) => ({ ok: false as const, message: e instanceof AdminOpError ? e.message : "No se pudieron leer las métricas." }),
        )
      : null,
  ]);

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Panel" title="Dashboard" description="Pendientes del equipo, uso de la app e integraciones. Solo agregados: aquí no hay datos personales." />

      <section aria-labelledby="pendientes" className="grid gap-3">
        <h2 id="pendientes" className="text-lg font-semibold tracking-tight">
          Pendientes
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <QueueTile href="/admin/alimentos/verificacion" label="Alimentos por verificar" value={queues.foodsUnverified} icon={Apple} />
          <QueueTile href="/admin/recetas?estado=pending_review" label="Recetas en revisión" value={queues.recipesPending} icon={ChefHat} />
          <QueueTile href="/admin/contenidos?estado=draft" label="Contenidos en borrador" value={queues.contentDrafts} icon={Newspaper} />
          {isAdmin ? <QueueTile href="/admin/errores" label="Errores nuevos" value={queues.errorsNew} icon={Bug} /> : null}
        </div>
      </section>

      {metrics === null ? (
        <Alert>
          <AlertTitle>Métricas de negocio</AlertTitle>
          <AlertDescription>
            <p>Las métricas de usuarios, ingresos e IA son visibles para administradores.</p>
          </AlertDescription>
        </Alert>
      ) : metrics.ok ? (
        <MetricsSection m={metrics.m} />
      ) : (
        <Alert variant="destructive">
          <AlertTitle>No pudimos cargar las métricas</AlertTitle>
          <AlertDescription>
            <p>{metrics.message}</p>
          </AlertDescription>
        </Alert>
      )}

      <IntegrationsCard status={integrationStatus()} />
    </div>
  );
}

function QueueTile({ href, label, value, icon }: { href: string; label: string; value: number; icon: LucideIcon }) {
  return (
    <Link href={href} className="rounded-2xl outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]">
      <StatTile label={label} value={formatNumber(value)} icon={icon} tone={value > 0 ? "primary" : "default"} hint={value > 0 ? "Revisar ahora" : "Al día"} className="h-full hover:bg-accent/40" />
    </Link>
  );
}

function MetricsSection({ m }: { m: AdminMetrics }) {
  const revenue = Object.entries(m.revenueMonthCents).filter(([, cents]) => cents > 0);
  const usersChart = [
    { label: "Total", value: m.usersTotal },
    { label: "Nuevos 30 d", value: m.usersNew30d },
    { label: "Activos 30 d", value: m.usersActive30d },
    { label: "Activos 7 d", value: m.usersActive7d },
    { label: "Premium", value: m.premiumActive },
  ];
  const aiByKind = Object.entries(m.aiRequestsByKind)
    .map(([k, v]) => ({ label: labelOf(AI_KIND_LABELS, k), value: v }))
    .sort((a, b) => b.value - a.value);
  const aiByStatus = Object.entries(m.aiRequestsByStatus)
    .map(([k, v]) => ({ label: labelOf(AI_STATUS_LABELS, k), value: v }))
    .sort((a, b) => b.value - a.value);

  return (
    <section aria-labelledby="metricas" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="metricas" className="text-lg font-semibold tracking-tight">
          Uso y negocio
        </h2>
        <p className="text-xs text-muted-foreground">
          Mes en hora de Lima · actualizado {formatDateTime(m.generatedAt)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Usuarios" value={formatNumber(m.usersTotal)} icon={Users} hint={`+${formatNumber(m.usersNew7d)} en 7 días · +${formatNumber(m.usersNew30d)} en 30`} />
        <StatTile label="Activos (registraron comida)" value={formatNumber(m.usersActive7d)} icon={UserCheck} hint={`7 días · ${formatNumber(m.usersActive30d)} en 30 días`} />
        <StatTile label="Premium vigentes" value={formatNumber(m.premiumActive)} icon={UserPlus} hint={`${formatNumber(m.premiumPaying)} pagando · ${formatNumber(m.premiumTrialing)} en prueba`} />
        <StatTile label="Conversión a pago" value={formatPercent(m.conversionRate)} icon={TrendingUp} hint="Pagando ÷ usuarios totales" />
        <StatTile
          label="Ingresos del mes"
          value={revenue.length ? formatCents(revenue[0][1], revenue[0][0]) : formatCents(0)}
          icon={CreditCard}
          hint={revenue.length > 1 ? revenue.slice(1).map(([cur, cents]) => formatCents(cents, cur)).join(" · ") : "Pagos confirmados"}
        />
        <StatTile label="Cancelaciones del mes" value={formatNumber(m.cancellationsMonth)} icon={XCircle} />
        <StatTile label="Solicitudes de IA (mes)" value={formatNumber(m.aiRequestsMonth)} icon={Bot} hint="Cuentan para el cupo" />
        <StatTile label="Costo estimado de IA" value={formatUsd(m.aiCostUsdMonth)} icon={Bot} hint="Estimado por tokens" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle as="h3">Usuarios</CardTitle>
            <CardDescription>Totales, nuevos, activos y Premium.</CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={usersChart} caption="Usuarios por segmento" valueLabel="Usuarios" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h3">IA por tipo (mes)</CardTitle>
            <CardDescription>Foto, texto, voz y asistente.</CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={aiByKind} caption="Solicitudes de IA por tipo en el mes" valueLabel="Solicitudes" multicolor />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h3">IA por estado (mes)</CardTitle>
            <CardDescription>
              Detalle en <Link href="/admin/ia" className="font-medium text-primary-strong underline underline-offset-4">uso de IA</Link>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={aiByStatus} caption="Solicitudes de IA por estado en el mes" valueLabel="Solicitudes" multicolor />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
