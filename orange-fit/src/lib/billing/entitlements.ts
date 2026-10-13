import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PremiumFeature } from "./features";

export type AiLimits = Partial<Record<"photo" | "text" | "voice" | "chat" | "plan", number>>;

export type Entitlements = {
  plan: "free" | "premium";
  isPremium: boolean;
  features: Set<string>;
  aiLimits: AiLimits;
  subscription: { status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; provider: string } | null;
};

const FREE: Entitlements = { plan: "free", isPremium: false, features: new Set(), aiLimits: {}, subscription: null };

/**
 * Qué puede usar el usuario actual. La fuente de verdad es `is_premium()` en la BD
 * (suscripción trialing/active vigente, escrita solo por webhooks de pago).
 */
export const getEntitlements = cache(async (): Promise<Entitlements> => {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return FREE;
  const [{ data: premium }, { data: plans }, { data: subs }] = await Promise.all([
    supabase.rpc("is_premium"),
    supabase.from("plans").select("id, features, ai_monthly_limits").in("id", ["free", "premium"]),
    supabase
      .from("subscriptions")
      .select("status, current_period_end, cancel_at_period_end, provider")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  const plan = premium ? "premium" : "free";
  const row = plans?.find((p) => p.id === plan);
  const sub = subs?.[0];
  return {
    plan,
    isPremium: Boolean(premium),
    features: new Set(row?.features ?? []),
    aiLimits: (row?.ai_monthly_limits as AiLimits | null) ?? {},
    subscription: sub
      ? { status: sub.status, currentPeriodEnd: sub.current_period_end, cancelAtPeriodEnd: sub.cancel_at_period_end, provider: sub.provider }
      : null,
  };
});

export async function hasFeature(feature: PremiumFeature): Promise<boolean> {
  return (await getEntitlements()).features.has(feature);
}
