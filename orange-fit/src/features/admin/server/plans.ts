import "server-only";
import type { z } from "zod";
import { PREMIUM_FEATURES } from "@/lib/billing/features";
import type { Tables } from "@/lib/db/database.types";
import { AI_KINDS } from "../lib/labels";
import type { planPriceSchema, planSchema } from "../schemas";
import { AdminOpError, dbError, logAdminAction, type Db } from "./db";

export type AdminPlan = Tables<"plans"> & { prices: Tables<"plan_prices">[] };

export async function listPlans(supabase: Db): Promise<AdminPlan[]> {
  const [{ data: plans, error }, { data: prices, error: priceError }] = await Promise.all([
    supabase.from("plans").select("*").order("sort_order").order("id"),
    supabase.from("plan_prices").select("*").order("currency_code").order("interval").order("created_at"),
  ]);
  if (error || priceError) throw dbError(error ?? priceError, "No se pudieron leer los planes.");
  return (plans ?? []).map((p) => ({ ...p, prices: (prices ?? []).filter((x) => x.plan_id === p.id) }));
}

/** Funciones que no son de pago (manual_logging, dashboard…): el panel las conserva tal cual. */
export function baseFeatures(features: readonly string[]): string[] {
  const premium = new Set<string>(PREMIUM_FEATURES);
  return features.filter((f) => !premium.has(f));
}

/** Une las funciones base existentes con las de pago elegidas (orden estable, sin repetidos). */
export function mergeFeatures(current: readonly string[], premiumSelected: readonly string[]): string[] {
  const selected = new Set(premiumSelected);
  return [...new Set([...baseFeatures(current), ...PREMIUM_FEATURES.filter((f) => selected.has(f))])];
}

export function aiLimitsFromRow(value: unknown): Record<(typeof AI_KINDS)[number], number> {
  const obj = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    AI_KINDS.map((k) => {
      const n = obj[k];
      return [k, typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0];
    }),
  ) as Record<(typeof AI_KINDS)[number], number>;
}

export async function updatePlan(supabase: Db, data: z.output<typeof planSchema>): Promise<void> {
  const { data: current, error: readError } = await supabase.from("plans").select("id, features").eq("id", data.planId).maybeSingle();
  if (readError) throw dbError(readError, "No se pudo leer el plan.");
  if (!current) throw new AdminOpError("NOT_FOUND", "El plan no existe.");

  const features = mergeFeatures(current.features, data.premiumFeatures);
  const { data: updated, error } = await supabase
    .from("plans")
    .update({
      name: data.name,
      description: data.description,
      is_active: data.isActive,
      sort_order: data.sortOrder,
      features,
      ai_monthly_limits: data.aiLimits,
    })
    .eq("id", data.planId)
    .select("id");
  if (error) throw dbError(error, "No se pudo guardar el plan.");
  if (!updated?.length) throw new AdminOpError("FORBIDDEN", "No tienes permiso para editar planes.");
  await logAdminAction(supabase, {
    action: "plan.update",
    targetTable: "plans",
    targetId: data.planId,
    metadata: { is_active: data.isActive, premium_features: data.premiumFeatures.length },
  });
}

export async function savePlanPrice(supabase: Db, data: z.output<typeof planPriceSchema>): Promise<{ id: string; created: boolean }> {
  const row = {
    plan_id: data.planId,
    interval: data.interval,
    currency_code: data.currencyCode,
    amount_cents: data.amountCents,
    trial_days: data.trialDays,
    stripe_price_id: data.stripePriceId,
    mercadopago_plan_id: data.mercadopagoPlanId,
    is_active: data.isActive,
  };
  const query = data.priceId
    ? supabase.from("plan_prices").update(row).eq("id", data.priceId).select("id")
    : supabase.from("plan_prices").insert(row).select("id");
  const { data: saved, error } = await query;
  if (error) {
    if (error.code === "23505") {
      const msg = /stripe/.test(error.message)
        ? "Ese ID de Stripe ya está en otro precio."
        : /mercadopago/.test(error.message)
          ? "Ese ID de Mercado Pago ya está en otro precio."
          : "Ya hay un precio activo para ese plan, intervalo y moneda. Desactiva el otro primero.";
      throw new AdminOpError("CONFLICT", msg);
    }
    if (error.code === "23503") throw new AdminOpError("NOT_FOUND", "El plan no existe.");
    throw dbError(error, "No se pudo guardar el precio.");
  }
  const id = saved?.[0]?.id;
  if (!id) throw new AdminOpError(data.priceId ? "NOT_FOUND" : "FORBIDDEN", data.priceId ? "El precio no existe." : "No tienes permiso para crear precios.");
  await logAdminAction(supabase, {
    action: data.priceId ? "plan_price.update" : "plan_price.create",
    targetTable: "plan_prices",
    targetId: id,
    metadata: {
      plan_id: data.planId,
      interval: data.interval,
      currency: data.currencyCode,
      amount_cents: data.amountCents,
      is_active: data.isActive,
    },
  });
  return { id, created: !data.priceId };
}
