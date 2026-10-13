/**
 * Lectura tipada de `admin_metrics()` y `admin_ai_usage()` (jsonb). Puras y probadas: si la
 * forma cambia, los valores ausentes quedan en 0/vacío en vez de romper el panel.
 */

const num = (v: unknown): number => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
};

const numRecord = (v: unknown): Record<string, number> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, num(x)]));
};

export type AdminMetrics = {
  generatedAt: string | null;
  monthStart: string | null;
  usersTotal: number;
  usersNew7d: number;
  usersNew30d: number;
  usersActive7d: number;
  usersActive30d: number;
  premiumActive: number;
  premiumTrialing: number;
  premiumPaying: number;
  /** 0–1 */
  conversionRate: number;
  revenueMonthCents: Record<string, number>;
  cancellationsMonth: number;
  aiRequestsMonth: number;
  aiRequestsByKind: Record<string, number>;
  aiRequestsByStatus: Record<string, number>;
  aiCostUsdMonth: number;
};

export function parseAdminMetrics(raw: unknown): AdminMetrics {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    generatedAt: typeof o.generated_at === "string" ? o.generated_at : null,
    monthStart: typeof o.month_start === "string" ? o.month_start : null,
    usersTotal: num(o.users_total),
    usersNew7d: num(o.users_new_7d),
    usersNew30d: num(o.users_new_30d),
    usersActive7d: num(o.users_active_7d),
    usersActive30d: num(o.users_active_30d),
    premiumActive: num(o.premium_active),
    premiumTrialing: num(o.premium_trialing),
    premiumPaying: num(o.premium_paying),
    conversionRate: num(o.conversion_rate),
    revenueMonthCents: numRecord(o.revenue_month_cents),
    cancellationsMonth: num(o.cancellations_month),
    aiRequestsMonth: num(o.ai_requests_month),
    aiRequestsByKind: numRecord(o.ai_requests_by_kind),
    aiRequestsByStatus: numRecord(o.ai_requests_by_status),
    aiCostUsdMonth: num(o.ai_cost_usd_month),
  };
}

export function formatPercent(ratio: number, decimals = 1): string {
  if (!Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toLocaleString("es-PE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} %`;
}

export function formatUsd(amount: number, decimals = 2): string {
  if (!Number.isFinite(amount)) return "—";
  return `US$ ${amount.toLocaleString("es-PE", { minimumFractionDigits: decimals, maximumFractionDigits: Math.max(decimals, 4) })}`;
}

/* -------------------------------------------------------------------------- */
/* Uso de IA                                                                    */
/* -------------------------------------------------------------------------- */

export type AiUsageRow = {
  month: string;
  kind: string;
  model: string | null;
  status: string;
  requests: number;
  costUsd: number;
  tokensInput: number;
  tokensOutput: number;
  avgLatencyMs: number | null;
};

export type AiUsage = {
  from: string | null;
  months: number;
  rows: AiUsageRow[];
  errors: Array<{ status: string; errorCode: string; requests: number }>;
};

export function parseAiUsage(raw: unknown): AiUsage {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const rows = Array.isArray(o.rows) ? o.rows : [];
  const errors = Array.isArray(o.errors) ? o.errors : [];
  return {
    from: typeof o.from === "string" ? o.from : null,
    months: num(o.months),
    rows: rows.map((r) => {
      const x = (r ?? {}) as Record<string, unknown>;
      return {
        month: String(x.month ?? ""),
        kind: String(x.kind ?? ""),
        model: typeof x.model === "string" && x.model ? x.model : null,
        status: String(x.status ?? ""),
        requests: num(x.requests),
        costUsd: num(x.cost_usd),
        tokensInput: num(x.tokens_input),
        tokensOutput: num(x.tokens_output),
        avgLatencyMs: x.avg_latency_ms == null ? null : num(x.avg_latency_ms),
      };
    }),
    errors: errors.map((e) => {
      const x = (e ?? {}) as Record<string, unknown>;
      return { status: String(x.status ?? ""), errorCode: String(x.error_code ?? ""), requests: num(x.requests) };
    }),
  };
}

export type AiGroup = {
  key: string;
  requests: number;
  /** Las que cuentan para el cupo y el costo: pending + succeeded + failed. */
  billable: number;
  succeeded: number;
  failed: number;
  rejectedQuota: number;
  notConfigured: number;
  costUsd: number;
  tokensInput: number;
  tokensOutput: number;
  /** failed / (succeeded + failed) */
  errorRate: number;
  /** (rejected_quota + not_configured) / requests */
  rejectionRate: number;
};

/** Agrupa filas por una dimensión (mes, tipo, modelo) y calcula tasas. */
export function groupAiUsage(rows: readonly AiUsageRow[], by: (row: AiUsageRow) => string): AiGroup[] {
  const map = new Map<string, AiGroup>();
  for (const r of rows) {
    const key = by(r);
    const g =
      map.get(key) ??
      ({
        key,
        requests: 0,
        billable: 0,
        succeeded: 0,
        failed: 0,
        rejectedQuota: 0,
        notConfigured: 0,
        costUsd: 0,
        tokensInput: 0,
        tokensOutput: 0,
        errorRate: 0,
        rejectionRate: 0,
      } satisfies AiGroup);
    g.requests += r.requests;
    if (r.status === "pending" || r.status === "succeeded" || r.status === "failed") g.billable += r.requests;
    if (r.status === "succeeded") g.succeeded += r.requests;
    if (r.status === "failed") g.failed += r.requests;
    if (r.status === "rejected_quota") g.rejectedQuota += r.requests;
    if (r.status === "not_configured") g.notConfigured += r.requests;
    g.costUsd += r.costUsd;
    g.tokensInput += r.tokensInput;
    g.tokensOutput += r.tokensOutput;
    map.set(key, g);
  }
  return [...map.values()].map((g) => ({
    ...g,
    costUsd: Math.round(g.costUsd * 1e6) / 1e6,
    errorRate: g.succeeded + g.failed > 0 ? g.failed / (g.succeeded + g.failed) : 0,
    rejectionRate: g.requests > 0 ? (g.rejectedQuota + g.notConfigured) / g.requests : 0,
  }));
}

/** Totales de toda la ventana. */
export function totalAiUsage(rows: readonly AiUsageRow[]): AiGroup {
  return groupAiUsage(rows, () => "total")[0] ?? groupAiUsage([{ month: "", kind: "", model: null, status: "", requests: 0, costUsd: 0, tokensInput: 0, tokensOutput: 0, avgLatencyMs: null }], () => "total")[0];
}

/** "2026-10" → "oct 2026" */
export function formatMonth(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return month;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 15));
  return d.toLocaleDateString("es-PE", { month: "short", year: "numeric", timeZone: "UTC" }).replace(/\./g, "");
}

/** Últimos `months` meses ("YYYY-MM") hasta el actual, en hora de Lima (UTC−5, sin horario de verano). */
export function lastMonths(months: number, now: Date = new Date()): string[] {
  const lima = new Date(now.getTime() - 5 * 3_600_000);
  const year = lima.getUTCFullYear();
  const month = lima.getUTCMonth();
  const out: string[] = [];
  for (let i = Math.max(1, Math.floor(months)) - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
