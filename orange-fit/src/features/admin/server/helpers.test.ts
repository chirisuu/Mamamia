import { describe, expect, it } from "vitest";
import { settingsSchema } from "../schemas";
import { auditFiltersSchema, limaDayStartUtc } from "./audit-log";
import { reorder } from "./content";
import { aiLimitsFromRow, baseFeatures, mergeFeatures } from "./plans";
import { changedKeys, keepPaymentFlags, settingsToRows } from "./settings";
import { planFromSubscriptions } from "./users";

describe("configuración", () => {
  const data = settingsSchema.parse({
    appName: "Mi App",
    supportEmail: "",
    defaultTrialDays: 14,
    maintenanceBanner: "",
    featureFlags: [{ key: "payments_stripe", enabled: false }],
  });

  it("settingsToRows guarda «sin valor» como texto vacío (value es NOT NULL)", () => {
    expect(settingsToRows(data)).toEqual([
      { key: "app_name", value: "Mi App" },
      { key: "support_email", value: "" },
      { key: "feature_flags", value: { payments_stripe: false } },
      { key: "default_trial_days", value: 14 },
      { key: "maintenance_banner", value: "" },
    ]);
  });

  it("changedKeys trata null y vacío como iguales", () => {
    const before = new Map<string, unknown>([
      ["app_name", "Mi App"],
      ["support_email", null],
      ["feature_flags", { payments_stripe: true }],
      ["default_trial_days", 14],
    ]);
    expect(changedKeys(before, settingsToRows(data))).toEqual(["feature_flags", "maintenance_banner"]);
  });

  it("keepPaymentFlags conserva un interruptor de pagos que no llegó en el formulario", () => {
    const kept = keepPaymentFlags(data, { payments_stripe: true, payments_mercadopago: false, other: true });
    expect(kept.featureFlags).toEqual([
      { key: "payments_stripe", enabled: false },
      { key: "payments_mercadopago", enabled: false },
    ]);
    expect(keepPaymentFlags(data, null)).toBe(data);
  });
});

describe("planes", () => {
  it("conserva las funciones base y agrega solo las de pago elegidas", () => {
    const current = ["manual_logging", "dashboard", "ai_photo", "exports"];
    expect(baseFeatures(current)).toEqual(["manual_logging", "dashboard"]);
    expect(mergeFeatures(current, ["meal_plans", "ai_photo"])).toEqual(["manual_logging", "dashboard", "ai_photo", "meal_plans"]);
  });

  it("aiLimitsFromRow: ausente o inválido = 0", () => {
    expect(aiLimitsFromRow({ photo: 120, text: -3, chat: "9", voice: 2.7 })).toEqual({ photo: 120, text: 0, voice: 2, chat: 0, plan: 0 });
    expect(aiLimitsFromRow(null)).toEqual({ photo: 0, text: 0, voice: 0, chat: 0, plan: 0 });
  });
});

describe("usuarios", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  it("plan vigente con el mismo criterio que is_premium", () => {
    expect(planFromSubscriptions([{ status: "active", trial_end: null, current_period_end: "2026-11-01T00:00:00Z" }], now)).toEqual({ plan: "premium", status: "active" });
    expect(planFromSubscriptions([{ status: "trialing", trial_end: "2026-10-12T00:00:00Z", current_period_end: "2026-11-01T00:00:00Z" }], now)).toEqual({ plan: "free", status: "trialing" });
    expect(planFromSubscriptions([{ status: "canceled", trial_end: null, current_period_end: "2026-11-01T00:00:00Z" }], now)).toEqual({ plan: "free", status: "canceled" });
    expect(planFromSubscriptions([], now)).toEqual({ plan: "free", status: null });
  });
});

describe("contenidos y auditoría", () => {
  it("reorder mueve dentro de los límites", () => {
    expect(reorder(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(reorder(["a", "b", "c"], "c", "down")).toBeNull();
    expect(reorder(["a"], "x", "up")).toBeNull();
  });

  it("filtros de auditoría: valores inválidos se ignoran", () => {
    expect(auditFiltersSchema.parse({ action: "food.", table: "auth.users", actor: "no-uuid", from: "2026-13-01", page: "abc" })).toEqual({
      action: "food.",
      table: "auth.users",
      actor: undefined,
      from: undefined,
      to: undefined,
      page: 1,
    });
    expect(auditFiltersSchema.parse({ action: "x%' or 1=1" }).action).toBeUndefined();
    expect(limaDayStartUtc("2026-10-13")).toBe("2026-10-13T05:00:00.000Z");
  });
});
