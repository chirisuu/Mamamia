import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { describeSubscription, isTrialEligible, pickCurrentSubscription, type SubscriptionView } from "@/lib/billing/status";
import type { PaymentStatus, PlanPriceRow, SubscriptionRow } from "@/lib/billing/types";

type Client = SupabaseClient<Database>;

export type PaymentListItem = {
  id: string;
  provider: SubscriptionRow["provider"];
  amountCents: number;
  currencyCode: string;
  status: PaymentStatus;
  paidAt: string | null;
  createdAt: string;
};

export type BillingOverview = {
  /** Todas las suscripciones de la persona, más reciente primero. */
  subscriptions: SubscriptionRow[];
  /** La que importa ahora (con acceso, con cobro pendiente o la más reciente). */
  current: SubscriptionRow | null;
  /** Precio de la actual (null si ya no está activo o no se conoce). */
  currentPrice: PlanPriceRow | null;
  view: SubscriptionView | null;
  payments: PaymentListItem[];
  trialEligible: boolean;
};

/**
 * Estado de pagos de la persona, leído con SU sesión (RLS: solo ve lo suyo). Lanza si la BD falla:
 * la página muestra el error en vez de un estado inventado.
 */
export async function getBillingOverview(supabase: Client, userId: string, opts: { paymentsLimit?: number } = {}): Promise<BillingOverview> {
  const [subsRes, paymentsRes] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    supabase
      .from("payments")
      .select("id, provider, amount_cents, currency_code, status, paid_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(opts.paymentsLimit ?? 24),
  ]);
  if (subsRes.error) throw new Error(`subscriptions_read_failed:${subsRes.error.code ?? "unknown"}`);
  if (paymentsRes.error) throw new Error(`payments_read_failed:${paymentsRes.error.code ?? "unknown"}`);

  const subscriptions = subsRes.data ?? [];
  const now = new Date();
  const current = pickCurrentSubscription(subscriptions, now);

  let currentPrice: PlanPriceRow | null = null;
  if (current?.price_id) {
    const { data, error } = await supabase.from("plan_prices").select("*").eq("id", current.price_id).maybeSingle();
    if (error) throw new Error(`price_read_failed:${error.code ?? "unknown"}`);
    currentPrice = data;
  }

  const payments: PaymentListItem[] = (paymentsRes.data ?? []).map((p) => ({
    id: p.id,
    provider: p.provider,
    amountCents: p.amount_cents,
    currencyCode: p.currency_code,
    status: p.status as PaymentStatus,
    paidAt: p.paid_at,
    createdAt: p.created_at,
  }));

  return {
    subscriptions,
    current,
    currentPrice,
    view: current ? describeSubscription(current, now) : null,
    payments,
    trialEligible: isTrialEligible(
      subscriptions,
      payments.some((p) => p.status === "succeeded" || p.status === "refunded"),
    ),
  };
}
