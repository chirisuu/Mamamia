import { describe, expect, it } from "vitest";
import { PROVIDER_FLAG } from "@/lib/billing/catalog";
import { changedFlagKeys, ensurePaymentFlags, isPaymentFlag, PAYMENT_FLAGS } from "./flags";
import { formatMonth, formatPercent, groupAiUsage, lastMonths, parseAdminMetrics, parseAiUsage, totalAiUsage, type AiUsageRow } from "./metrics";

describe("interruptores de pagos", () => {
  it("usan las mismas claves que lee el módulo de pagos", () => {
    for (const f of PAYMENT_FLAGS) expect(PROVIDER_FLAG[f.provider]).toBe(f.key);
    expect(isPaymentFlag("payments_mercadopago")).toBe(true);
    expect(isPaymentFlag("ai_photo")).toBe(false);
  });

  it("ensurePaymentFlags agrega los que falten como habilitados (igual que providerAvailability)", () => {
    expect(ensurePaymentFlags([{ key: "payments_mercadopago", enabled: false }, { key: "ai_text", enabled: true }])).toEqual([
      { key: "ai_text", enabled: true },
      { key: "payments_mercadopago", enabled: false },
      { key: "payments_stripe", enabled: true },
    ]);
  });

  it("changedFlagKeys lista solo lo que cambió", () => {
    expect(changedFlagKeys({ a: true, b: false, c: true }, { a: true, b: true, d: false })).toEqual(["b", "c", "d"]);
  });
});

describe("admin_metrics", () => {
  it("lee la forma de la función y tolera faltantes", () => {
    const m = parseAdminMetrics({
      users_total: 10,
      users_new_7d: "2",
      premium_paying: 3,
      conversion_rate: 0.3,
      revenue_month_cents: { PEN: 5980, USD: "799" },
      ai_requests_by_kind: { photo: 4 },
      ai_cost_usd_month: 0.012345,
    });
    expect(m).toMatchObject({ usersTotal: 10, usersNew7d: 2, premiumPaying: 3, conversionRate: 0.3, revenueMonthCents: { PEN: 5980, USD: 799 }, aiCostUsdMonth: 0.012345 });
    expect(m.usersActive7d).toBe(0);
    expect(parseAdminMetrics(null).usersTotal).toBe(0);
    expect(formatPercent(0.3)).toBe("30.0 %");
  });
});

describe("uso de IA", () => {
  const row = (r: Partial<AiUsageRow>): AiUsageRow => ({
    month: "2026-10",
    kind: "photo",
    model: "claude-opus-5-5",
    status: "succeeded",
    requests: 0,
    costUsd: 0,
    tokensInput: 0,
    tokensOutput: 0,
    avgLatencyMs: null,
    ...r,
  });

  it("agrupa y calcula tasas de error y rechazo", () => {
    const rows = [
      row({ status: "succeeded", requests: 8, costUsd: 0.4 }),
      row({ status: "failed", requests: 2, costUsd: 0.05 }),
      row({ status: "rejected_quota", requests: 5 }),
      row({ kind: "text", status: "not_configured", requests: 5, model: null }),
    ];
    const total = totalAiUsage(rows);
    expect(total).toMatchObject({ requests: 20, billable: 10, succeeded: 8, failed: 2, rejectedQuota: 5, notConfigured: 5, costUsd: 0.45 });
    expect(total.errorRate).toBeCloseTo(0.2);
    expect(total.rejectionRate).toBeCloseTo(0.5);
    const byKind = groupAiUsage(rows, (r) => r.kind);
    expect(byKind.find((g) => g.key === "text")).toMatchObject({ requests: 5, errorRate: 0, rejectionRate: 1 });
    expect(totalAiUsage([]).requests).toBe(0);
  });

  it("parseAiUsage no expone nada fuera de los agregados", () => {
    const u = parseAiUsage({ months: 6, rows: [{ month: "2026-10", kind: "photo", model: "", status: "failed", requests: "3", cost_usd: 0.1, user_id: "x" }], errors: [{ status: "failed", error_code: "timeout", requests: 3 }] });
    expect(u.rows[0]).toEqual({ month: "2026-10", kind: "photo", model: null, status: "failed", requests: 3, costUsd: 0.1, tokensInput: 0, tokensOutput: 0, avgLatencyMs: null });
    expect(u.errors).toEqual([{ status: "failed", errorCode: "timeout", requests: 3 }]);
  });

  it("lastMonths usa la hora de Lima y cruza años", () => {
    // 1 de enero 03:00 UTC = 31 de diciembre 22:00 en Lima.
    expect(lastMonths(3, new Date("2027-01-01T03:00:00Z"))).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(lastMonths(2, new Date("2027-01-01T06:00:00Z"))).toEqual(["2026-12", "2027-01"]);
    expect(formatMonth("2026-10")).toMatch(/oct/);
  });
});
