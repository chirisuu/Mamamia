import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isConsentActive, latestConsents } from "@/features/auth/consents";
import { aiConfig } from "@/lib/ai/config";
import { getEntitlements, type Entitlements } from "@/lib/billing/entitlements";
import type { Database } from "@/lib/db/database.types";
import { DEFAULT_TIMEZONE } from "@/lib/dates";
import { quotaPeriodStart } from "../lib/period";
import { KIND_FEATURE, type AiKind, type AiStatusResponse } from "../schemas";

type Client = SupabaseClient<Database>;

const KINDS: readonly AiKind[] = ["photo", "text", "voice", "chat"];

/**
 * ¿Tiene la persona el consentimiento de IA VIGENTE? Manda la fila más reciente de
 * `consents` (puede ser una revocación).
 */
export async function hasAiConsent(supabase: Client, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("consents")
    .select("consent_type, granted, granted_at, revoked_at, created_at, version")
    .eq("user_id", userId)
    .eq("consent_type", "ai_processing");
  if (error) throw new Error(`consents: ${error.code ?? "error"}`);
  return isConsentActive(latestConsents(data ?? []), "ai_processing");
}

/** Usos del mes (pending + succeeded, como cuenta `consume_ai_quota`) por tipo. */
export async function countAiUsage(supabase: Client, userId: string, since: Date): Promise<Record<AiKind, number>> {
  const results = await Promise.all(
    KINDS.map(async (kind) => {
      const { count, error } = await supabase
        .from("ai_analysis_requests")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("kind", kind)
        .in("status", ["pending", "succeeded"])
        .gte("created_at", since.toISOString());
      if (error) throw new Error(`ai_analysis_requests: ${error.code ?? "error"}`);
      return [kind, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(results) as Record<AiKind, number>;
}

/** Estado honesto de la IA para una persona: configuración, consentimiento, plan y cupo. */
export async function getAiStatus(
  supabase: Client,
  userId: string,
  timezone: string | null | undefined,
  entitlements?: Entitlements,
): Promise<AiStatusResponse> {
  const config = aiConfig();
  const period = quotaPeriodStart(new Date(), timezone || DEFAULT_TIMEZONE);
  const [ent, consent, usage] = await Promise.all([
    entitlements ? Promise.resolve(entitlements) : getEntitlements(),
    hasAiConsent(supabase, userId),
    countAiUsage(supabase, userId, period.instant),
  ]);
  const kinds = Object.fromEntries(
    KINDS.map((kind) => {
      const limit = Math.max(0, Math.floor(Number(ent.aiLimits[kind] ?? 0)));
      return [kind, { included: ent.features.has(KIND_FEATURE[kind]) && limit > 0, used: usage[kind], limit }];
    }),
  ) as AiStatusResponse["kinds"];
  return {
    configured: config.configured,
    transcriptionConfigured: config.transcription.configured,
    consent,
    plan: ent.plan,
    kinds,
    periodStart: period.localDate,
  };
}
