import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { AiError } from "./errors";
import { AiQuotaDeniedError, completeAiRequest, consumeAiQuota, runWithAiQuota } from "./quota";

const REQUEST_ID = "6f1c2b9e-1d2a-4f3b-9c8d-7e6f5a4b3c2d";

function fakeSupabase(responses: { consume?: unknown; consumeError?: unknown; complete?: unknown; completeError?: unknown }) {
  const rpc = vi.fn(async (fn: string) => {
    if (fn === "consume_ai_quota") return { data: responses.consume ?? null, error: responses.consumeError ?? null };
    if (fn === "complete_ai_request") return { data: responses.complete ?? true, error: responses.completeError ?? null };
    throw new Error(`rpc inesperado: ${fn}`);
  });
  return { client: { rpc } as unknown as SupabaseClient<Database>, rpc };
}

const allowed = { allowed: true, used: 3, limit: 120, plan: "premium", request_id: REQUEST_ID };

describe("cupo de IA", () => {
  it("consume_ai_quota → reserva con request_id", async () => {
    const { client } = fakeSupabase({ consume: allowed });
    await expect(consumeAiQuota(client, "photo")).resolves.toEqual({ allowed: true, used: 3, limit: 120, plan: "premium", requestId: REQUEST_ID });
  });

  it("error o forma inesperada del RPC → AI_QUOTA_ERROR", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(consumeAiQuota(fakeSupabase({ consumeError: { code: "42501" } }).client, "text")).rejects.toMatchObject({ code: "AI_QUOTA_ERROR" });
    await expect(consumeAiQuota(fakeSupabase({ consume: { allowed: "sí" } }).client, "text")).rejects.toMatchObject({ code: "AI_QUOTA_ERROR" });
  });

  it("sin cupo: no llama al proveedor y lanza AiQuotaDeniedError con el uso", async () => {
    const { client, rpc } = fakeSupabase({ consume: { allowed: false, used: 120, limit: 120, plan: "premium", request_id: null } });
    const work = vi.fn();
    const error = await runWithAiQuota(client, "photo", work).catch((e) => e);
    expect(error).toBeInstanceOf(AiQuotaDeniedError);
    expect(error.status).toBe(429);
    expect(error.reservation).toMatchObject({ used: 120, limit: 120 });
    expect(work).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("éxito: cierra la solicitud como succeeded con tokens, costo y salida", async () => {
    const { client, rpc } = fakeSupabase({ consume: allowed, complete: true });
    const res = await runWithAiQuota(client, "text", async (id) => ({
      result: { id },
      completion: { provider: "anthropic", model: "claude-opus-5-5", output: { items: [] }, tokensInput: 10.4, tokensOutput: 5, estimatedCostUsd: 0.0001, latencyMs: 820 },
    }));
    expect(res).toMatchObject({ result: { id: REQUEST_ID }, requestId: REQUEST_ID });
    expect(rpc).toHaveBeenLastCalledWith("complete_ai_request", {
      request_id: REQUEST_ID,
      status: "succeeded",
      provider: "anthropic",
      model: "claude-opus-5-5",
      output: { items: [] },
      error_code: undefined,
      tokens_input: 10,
      tokens_output: 5,
      estimated_cost_usd: 0.0001,
      latency_ms: 820,
      input_storage_path: undefined,
    });
  });

  it("si el proveedor falla: la solicitud queda failed con el código (no cuenta) y el error se propaga", async () => {
    const { client, rpc } = fakeSupabase({ consume: allowed, complete: true });
    const failure = new AiError("AI_REFUSED", { meta: { model: "claude-opus-5-5", inputTokens: 50, outputTokens: 0, estimatedCostUsd: 0.0002 } });
    await expect(runWithAiQuota(client, "photo", async () => Promise.reject(failure), { provider: "anthropic" })).rejects.toBe(failure);
    expect(rpc).toHaveBeenLastCalledWith(
      "complete_ai_request",
      expect.objectContaining({ request_id: REQUEST_ID, status: "failed", error_code: "AI_REFUSED", tokens_input: 50, provider: "anthropic" }),
    );
  });

  it("si complete_ai_request devuelve false, NO se entrega el resultado", async () => {
    const { client } = fakeSupabase({ consume: allowed, complete: false });
    await expect(
      runWithAiQuota(client, "text", async () => ({ result: "secreto", completion: {} })),
    ).rejects.toMatchObject({ code: "AI_REQUEST_CLOSED", status: 409 });
  });

  it("completeAiRequest devuelve false si el RPC falla", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeSupabase({ completeError: { code: "XX000" } });
    await expect(completeAiRequest(client, REQUEST_ID, { status: "succeeded" })).resolves.toBe(false);
  });
});
