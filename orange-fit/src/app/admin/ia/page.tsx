import type { Metadata } from "next";
import { AlertTriangle, Bot, Coins, Gauge, Hash } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { requireRole } from "@/lib/auth/session";
import { formatNumber } from "@/lib/format";
import { integrationStatus } from "@/lib/server-env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildHref, SubNav } from "@/features/admin/components/admin-ui";
import { SimpleBarChart } from "@/features/admin/components/bar-chart";
import { AI_KIND_LABELS, AI_STATUS_LABELS, labelOf } from "@/features/admin/lib/labels";
import { formatMonth, formatPercent, formatUsd, groupAiUsage, lastMonths, totalAiUsage, type AiGroup } from "@/features/admin/lib/metrics";
import { getAiUsage } from "@/features/admin/server/dashboard";

export const metadata: Metadata = { title: "Uso de IA" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const RANGES = [3, 6, 12] as const;

export default async function AdminAiPage({ searchParams }: Props) {
  await requireRole("admin");
  const sp = await searchParams;
  const raw = Number(Array.isArray(sp.meses) ? sp.meses[0] : sp.meses);
  const months = (RANGES as readonly number[]).includes(raw) ? raw : 6;
  const supabase = await createSupabaseServerClient();
  const usage = await getAiUsage(supabase, months);
  const configured = integrationStatus().ai;

  const total = totalAiUsage(usage.rows);
  const byMonth = new Map(groupAiUsage(usage.rows, (r) => r.month).map((g) => [g.key, g]));
  const monthKeys = lastMonths(months);
  const byKind = groupAiUsage(usage.rows, (r) => r.kind).sort((a, b) => b.requests - a.requests);
  const byModel = groupAiUsage(usage.rows, (r) => r.model ?? "sin modelo").sort((a, b) => b.requests - a.requests);
  const byStatus = groupAiUsage(usage.rows, (r) => r.status).sort((a, b) => b.requests - a.requests);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Administración"
        title="Uso de IA"
        description="Agregados por mes, tipo, modelo y estado. No se muestra contenido de las personas: ni fotos, ni textos, ni respuestas."
      />
      <SubNav
        label="Periodo"
        current={buildHref("/admin/ia", { meses: months === 6 ? null : months })}
        items={RANGES.map((m) => ({ href: buildHref("/admin/ia", { meses: m === 6 ? null : m }), label: `${m} meses` }))}
      />

      {!configured ? (
        <Alert variant="warning">
          <AlertTitle>IA pendiente de configurar</AlertTitle>
          <AlertDescription>
            <p>
              Falta <code>ANTHROPIC_API_KEY</code> en el servidor. Las solicitudes se registran como «Sin configurar» y no consumen cupo.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Solicitudes" value={formatNumber(total.requests)} icon={Hash} hint={`${formatNumber(total.billable)} cuentan para el cupo`} />
        <StatTile label="Costo estimado" value={formatUsd(total.costUsd)} icon={Coins} hint="Por tokens, según la tarifa de cada modelo" />
        <StatTile label="Tasa de error" value={formatPercent(total.errorRate)} icon={AlertTriangle} hint="Con error ÷ (correctas + con error)" />
        <StatTile label="Rechazos" value={formatPercent(total.rejectionRate)} icon={Gauge} hint="Sin cupo o sin configurar ÷ total" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle as="h2">Solicitudes por mes</CardTitle>
            <CardDescription>Todas, incluidas las rechazadas. Mes en hora de Lima.</CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleBarChart
              data={monthKeys.map((m) => ({ label: formatMonth(m), value: byMonth.get(m)?.requests ?? 0 }))}
              caption="Solicitudes de IA por mes"
              valueLabel="Solicitudes"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h2">Costo estimado por mes</CardTitle>
            <CardDescription>En dólares, calculado con los tokens de cada solicitud.</CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleBarChart
              data={monthKeys.map((m) => ({ label: formatMonth(m), value: byMonth.get(m)?.costUsd ?? 0 }))}
              caption="Costo estimado de IA por mes en dólares"
              valueLabel="Costo (US$)"
              valueFormat="usd"
            />
          </CardContent>
        </Card>
      </div>

      <GroupTable title="Por tipo" description="Foto, texto, voz, asistente y planes." groups={byKind} labelFor={(k) => labelOf(AI_KIND_LABELS, k)} />
      <GroupTable title="Por modelo" description="Modelo que respondió (vacío si no llegó a llamarse)." groups={byModel} labelFor={(k) => k} mono />
      <GroupTable title="Por estado" description="Correctas, con error, sin cupo, sin configurar y en curso." groups={byStatus} labelFor={(k) => labelOf(AI_STATUS_LABELS, k)} />

      <Card>
        <CardHeader>
          <CardTitle as="h2">Errores y rechazos más frecuentes</CardTitle>
          <CardDescription>Solo el código que guarda el servidor, nunca el mensaje ni el contenido.</CardDescription>
        </CardHeader>
        <CardContent>
          {usage.errors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin errores ni rechazos en este periodo.</p>
          ) : (
            <ul className="grid gap-2">
              {usage.errors.map((e) => (
                <li key={`${e.status}-${e.errorCode}`} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="font-mono">{e.errorCode}</span>
                    <span className="text-muted-foreground"> · {labelOf(AI_STATUS_LABELS, e.status)}</span>
                  </span>
                  <span className="font-semibold" data-numeric="">
                    {formatNumber(e.requests)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      {total.requests === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Bot className="size-4" aria-hidden="true" /> Todavía no hay solicitudes de IA en este periodo.
        </p>
      ) : null}
    </div>
  );
}

function GroupTable({
  title,
  description,
  groups,
  labelFor,
  mono = false,
}: {
  title: string;
  description: string;
  groups: AiGroup[];
  labelFor: (key: string) => string;
  mono?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos en este periodo.</p>
        ) : (
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">{title}</caption>
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Grupo
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Solicitudes
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Correctas
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Con error
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Rechazadas
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Tasa de error
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Tokens (entrada / salida)
                  </th>
                  <th scope="col" className="py-2 pl-3 text-right font-semibold">
                    Costo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border" data-numeric="">
                {groups.map((g) => (
                  <tr key={g.key}>
                    <th scope="row" className={mono ? "py-2 pr-3 font-mono text-xs font-medium" : "py-2 pr-3 font-medium"}>
                      {labelFor(g.key)}
                    </th>
                    <td className="px-3 py-2 text-right">{formatNumber(g.requests)}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(g.succeeded)}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(g.failed)}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(g.rejectedQuota + g.notConfigured)}</td>
                    <td className="px-3 py-2 text-right">{g.succeeded + g.failed > 0 ? formatPercent(g.errorRate) : "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {formatNumber(g.tokensInput)} / {formatNumber(g.tokensOutput)}
                    </td>
                    <td className="py-2 pl-3 text-right">{formatUsd(g.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
