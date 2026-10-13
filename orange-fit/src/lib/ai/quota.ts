import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums, Json } from "@/lib/db/database.types";
import { AiError, isAiError } from "./errors";

/**
 * Flujo obligatorio de cupo (docs/DATA_MODEL.md, Notas de implementación):
 * 1) `consume_ai_quota(kind)` reserva el uso y crea la solicitud `pending` (o registra el rechazo);
 * 2) se llama al proveedor;
 * 3) `complete_ai_request(...)` la cierra una sola vez. Si devuelve false, NO se entrega el resultado.
 * Las solicitudes `failed` no cuentan contra el cupo; `pending` y `succeeded` sí.
 */

type Client = SupabaseClient<Database>;
export type AiKind = Enums<"ai_request_kind">;

export type QuotaReservation = {
  allowed: boolean;
  used: number;
  limit: number;
  plan: "free" | "premium";
  requestId: string | null;
};

const reservationSchema = z.object({
  allowed: z.boolean(),
  used: z.number().int().min(0),
  limit: z.number().int().min(0),
  plan: z.enum(["free", "premium"]),
  request_id: z.uuid().nullable(),
});

/** Se acabó el cupo (o el plan no lo incluye: `reservation.limit === 0`). */
export class AiQuotaDeniedError extends AiError {
  readonly reservation: QuotaReservation;
  constructor(reservation: QuotaReservation) {
    super("AI_QUOTA_EXCEEDED");
    this.name = "AiQuotaDeniedError";
    this.reservation = reservation;
  }
}

export async function consumeAiQuota(supabase: Client, kind: AiKind): Promise<QuotaReservation> {
  const { data, error } = await supabase.rpc("consume_ai_quota", { kind });
  if (error) {
    console.error("[ai] consume_ai_quota falló", { code: error.code ?? null });
    throw new AiError("AI_QUOTA_ERROR");
  }
  const parsed = reservationSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[ai] consume_ai_quota devolvió una forma inesperada");
    throw new AiError("AI_QUOTA_ERROR");
  }
  const r = parsed.data;
  if (r.allowed && !r.request_id) throw new AiError("AI_QUOTA_ERROR");
  return { allowed: r.allowed, used: r.used, limit: r.limit, plan: r.plan, requestId: r.request_id };
}

export type AiCompletion = {
  status: "succeeded" | "failed" | "not_configured";
  provider?: string | null;
  model?: string | null;
  output?: Json | null;
  errorCode?: string | null;
  tokensInput?: number | null;
  tokensOutput?: number | null;
  estimatedCostUsd?: number | null;
  latencyMs?: number | null;
  inputStoragePath?: string | null;
};

const intOrUndef = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? undefined : Math.max(0, Math.round(v)));

/** Cierra la solicitud. true solo si pasó de `pending` al estado final (y es de esta persona). */
export async function completeAiRequest(supabase: Client, requestId: string, completion: AiCompletion): Promise<boolean> {
  const { data, error } = await supabase.rpc("complete_ai_request", {
    request_id: requestId,
    status: completion.status,
    provider: completion.provider ?? undefined,
    model: completion.model ?? undefined,
    output: completion.output ?? undefined,
    error_code: completion.errorCode ? completion.errorCode.slice(0, 100) : undefined,
    tokens_input: intOrUndef(completion.tokensInput),
    tokens_output: intOrUndef(completion.tokensOutput),
    estimated_cost_usd:
      completion.estimatedCostUsd == null || !Number.isFinite(completion.estimatedCostUsd) ? undefined : Math.max(0, completion.estimatedCostUsd),
    latency_ms: intOrUndef(completion.latencyMs),
    input_storage_path: completion.inputStoragePath ?? undefined,
  });
  if (error) {
    console.error("[ai] complete_ai_request falló", { code: error.code ?? null });
    return false;
  }
  return data === true;
}

/** Cierra como `failed` con el código del error (y los tokens ya gastados si se conocen). Nunca lanza. */
export async function failAiRequest(
  supabase: Client,
  requestId: string,
  error: unknown,
  extra: { provider?: string; model?: string; inputStoragePath?: string | null } = {},
): Promise<boolean> {
  const code = isAiError(error) ? error.code : "UNEXPECTED";
  const meta = isAiError(error) ? error.meta : undefined;
  try {
    return await completeAiRequest(supabase, requestId, {
      status: "failed",
      provider: extra.provider,
      model: meta?.model ?? extra.model,
      errorCode: code,
      tokensInput: meta?.inputTokens,
      tokensOutput: meta?.outputTokens,
      estimatedCostUsd: meta?.estimatedCostUsd ?? null,
      latencyMs: meta?.latencyMs,
      inputStoragePath: extra.inputStoragePath ?? null,
    });
  } catch {
    return false;
  }
}

/**
 * Reserva cupo, ejecuta `work` con el id de la solicitud y la cierra. Si `work` falla, la solicitud
 * queda `failed` (no cuenta) y el error se propaga. Si el cierre no se confirma, lanza
 * AI_REQUEST_CLOSED: el resultado no se entrega.
 */
export async function runWithAiQuota<T>(
  supabase: Client,
  kind: AiKind,
  work: (requestId: string) => Promise<{ result: T; completion: Omit<AiCompletion, "status"> }>,
  onFailure: { provider?: string; model?: string } = {},
): Promise<{ result: T; requestId: string; reservation: QuotaReservation }> {
  const reservation = await consumeAiQuota(supabase, kind);
  if (!reservation.allowed || !reservation.requestId) throw new AiQuotaDeniedError(reservation);
  const requestId = reservation.requestId;
  let outcome: { result: T; completion: Omit<AiCompletion, "status"> };
  try {
    outcome = await work(requestId);
  } catch (error) {
    await failAiRequest(supabase, requestId, error, onFailure);
    throw error;
  }
  const closed = await completeAiRequest(supabase, requestId, { status: "succeeded", ...outcome.completion });
  if (!closed) throw new AiError("AI_REQUEST_CLOSED");
  return { result: outcome.result, requestId, reservation };
}
