/**
 * Orquestación de análisis con un proveedor de IA y un Supabase falsos: comprueba el flujo de cupo,
 * que lo guardado en la solicitud no tiene nutrientes y que NUNCA se escribe en el diario (eso solo
 * pasa con la confirmación de la persona).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { NutritionAI } from "@/lib/ai/provider";
import { AiError } from "@/lib/ai/errors";
import { testFood } from "../lib/__fixtures__/foods";

const mocks = vi.hoisted(() => ({ matchCandidates: vi.fn() }));
vi.mock("@/lib/ai/matching", () => ({ matchCandidates: mocks.matchCandidates }));

import { analyzePhoto, analyzeText, mealPhotoPath } from "./analyze";

const REQUEST_ID = "6f1c2b9e-1d2a-4f3b-9c8d-7e6f5a4b3c2d";
const USER_ID = "0a0a0a0a-0b0b-4c0c-8d0d-0e0e0e0e0e0e";
const arroz = testFood({ id: "11111111-1111-4111-8111-111111111111", name: "Arroz blanco cocido" });

function fakeSupabase(opts: { allowed?: boolean; complete?: boolean; uploadError?: boolean } = {}) {
  const rpc = vi.fn(async (fn: string, ...rest: unknown[]) => {
    void rest;
    if (fn === "consume_ai_quota") {
      return opts.allowed === false
        ? { data: { allowed: false, used: 120, limit: 120, plan: "premium", request_id: null }, error: null }
        : { data: { allowed: true, used: 4, limit: 120, plan: "premium", request_id: REQUEST_ID }, error: null };
    }
    if (fn === "complete_ai_request") return { data: opts.complete ?? true, error: null };
    throw new Error(`rpc inesperado ${fn}`);
  });
  const from = vi.fn((table: string) => {
    throw new Error(`no debería tocar la tabla ${table}`);
  });
  const upload = vi.fn(async () => (opts.uploadError ? { data: null, error: { name: "StorageError" } } : { data: { path: "x" }, error: null }));
  const remove = vi.fn(async () => ({ data: [], error: null }));
  const storage = { from: vi.fn(() => ({ upload, remove })) };
  return { client: { rpc, from, storage } as unknown as SupabaseClient<Database>, rpc, from, upload, remove };
}

function fakeAI(overrides: Partial<NutritionAI> = {}): NutritionAI {
  const meta = { provider: "anthropic" as const, model: "claude-opus-5-5", inputTokens: 1200, outputTokens: 300, estimatedCostUsd: 0.0108, latencyMs: 900 };
  return {
    provider: "anthropic",
    identifyFoodsFromPhoto: vi.fn(async () => ({
      output: {
        isFoodImage: true,
        uncertaintyNote: "No se ve el aceite.",
        items: [{ nameEs: "arroz blanco cocido", preparation: null, estimatedGrams: { min: 120, best: 150, max: 200 }, confidence: 0.8, visibleEvidence: "Granos" }],
      },
      meta,
    })),
    parseFoodText: vi.fn(async () => ({
      output: { items: [{ foodQuery: "arroz blanco cocido", quantity: 1, unit: "taza", gramsIfStated: null, needsClarification: false, clarificationQuestion: null }] },
      meta,
    })),
    chatStream: vi.fn(),
    ...overrides,
  } as NutritionAI;
}

const image = { buffer: Buffer.from([1, 2, 3]), mediaType: "image/jpeg" as const, width: 10, height: 10, bytes: 3 };

describe("analyzeText", () => {
  beforeEach(() => mocks.matchCandidates.mockReset().mockResolvedValue([[arroz]]));

  it("cupo → IA → coincidencias de la base → cierre; devuelve candidatos y NO registra nada", async () => {
    const { client, rpc, from } = fakeSupabase();
    const res = await analyzeText({ supabase: client, userId: USER_ID, ai: fakeAI() }, { text: "una taza de arroz", mode: "text" });
    expect(res).toMatchObject({ requestId: REQUEST_ID, mode: "text", quota: { used: 4, limit: 120 } });
    expect(res.candidates[0]).toMatchObject({ key: "t0", foodQuery: "arroz blanco cocido", matches: [arroz] });
    expect(rpc).toHaveBeenNthCalledWith(1, "consume_ai_quota", { kind: "text" });
    const completion = rpc.mock.calls[1]![1] as Record<string, unknown>;
    expect(completion).toMatchObject({ request_id: REQUEST_ID, status: "succeeded", model: "claude-opus-5-5", tokens_input: 1200, estimated_cost_usd: 0.0108 });
    // En la solicitud solo queda qué propuso la IA y los ids de la base, nunca nutrientes.
    expect(JSON.stringify(completion.output)).not.toMatch(/kcal|energy|protein|carbs|fat_g/i);
    expect((completion.output as { items: Array<{ match_food_ids: string[] }> }).items[0]!.match_food_ids).toEqual([arroz.id]);
    expect(from).not.toHaveBeenCalled();
  });

  it("modo voz consume el cupo de voz", async () => {
    const { client, rpc } = fakeSupabase();
    await analyzeText({ supabase: client, userId: USER_ID, ai: fakeAI() }, { text: "una taza de arroz", mode: "voice" });
    expect(rpc).toHaveBeenNthCalledWith(1, "consume_ai_quota", { kind: "voice" });
  });

  it("sin cupo no llama a la IA", async () => {
    const ai = fakeAI();
    const { client } = fakeSupabase({ allowed: false });
    await expect(analyzeText({ supabase: client, userId: USER_ID, ai }, { text: "arroz", mode: "text" })).rejects.toMatchObject({ code: "AI_QUOTA_EXCEEDED" });
    expect(ai.parseFoodText).not.toHaveBeenCalled();
  });

  it("si complete_ai_request devuelve false, no se entrega el resultado", async () => {
    const { client } = fakeSupabase({ complete: false });
    await expect(analyzeText({ supabase: client, userId: USER_ID, ai: fakeAI() }, { text: "arroz", mode: "text" })).rejects.toMatchObject({
      code: "AI_REQUEST_CLOSED",
    });
  });
});

describe("analyzePhoto", () => {
  beforeEach(() => mocks.matchCandidates.mockReset().mockResolvedValue([[arroz]]));

  it("sin elegir guardarla, la foto no se sube", async () => {
    const { client, upload, from } = fakeSupabase();
    const res = await analyzePhoto({ supabase: client, userId: USER_ID, ai: fakeAI() }, { image, savePhoto: false, localDate: "2026-10-13" });
    expect(res).toMatchObject({ isFoodImage: true, photoSaved: null, uncertaintyNote: "No se ve el aceite." });
    expect(res.candidates[0]).toMatchObject({ key: "p0", estimatedGrams: { min: 120, best: 150, max: 200 }, confidence: 0.8 });
    expect(upload).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("si la persona lo elige, se guarda en meal-photos/{uid}/… y la ruta queda en la solicitud", async () => {
    const { client, upload, rpc } = fakeSupabase();
    const res = await analyzePhoto({ supabase: client, userId: USER_ID, ai: fakeAI() }, { image, savePhoto: true, localDate: "2026-10-13" });
    const path = mealPhotoPath(USER_ID, "2026-10-13", REQUEST_ID);
    expect(path).toBe(`${USER_ID}/2026-10-13/${REQUEST_ID}.jpg`);
    expect(upload).toHaveBeenCalledWith(path, image.buffer, { contentType: "image/jpeg", upsert: false });
    expect(res.photoSaved).toBe(true);
    expect(rpc.mock.calls[1]![1]).toMatchObject({ status: "succeeded", input_storage_path: path });
  });

  it("si la IA falla: solicitud failed con el código, foto borrada y error propagado", async () => {
    const ai = fakeAI({ identifyFoodsFromPhoto: vi.fn(async () => Promise.reject(new AiError("AI_REFUSED"))) });
    const { client, rpc, remove } = fakeSupabase();
    await expect(analyzePhoto({ supabase: client, userId: USER_ID, ai }, { image, savePhoto: true, localDate: "2026-10-13" })).rejects.toMatchObject({
      code: "AI_REFUSED",
    });
    expect(rpc.mock.calls[1]![1]).toMatchObject({ status: "failed", error_code: "AI_REFUSED" });
    expect(remove).toHaveBeenCalledWith([mealPhotoPath(USER_ID, "2026-10-13", REQUEST_ID)]);
  });
});
