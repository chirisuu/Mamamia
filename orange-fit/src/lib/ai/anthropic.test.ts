/**
 * Proveedor Anthropic con el SDK simulado (vi.mock): nunca se llama a la API real.
 * Cubre éxito con parsed_output, negativa, parsed_output null, errores tipados, parámetros
 * obligatorios (fallbacks, effort, salida estructurada) y el chat en streaming.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ parse: vi.fn(), stream: vi.fn(), ctor: vi.fn() }));

vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  const Real = actual.default;
  class FakeAnthropic {
    static AnthropicError = Real.AnthropicError;
    static APIError = Real.APIError;
    static APIConnectionError = Real.APIConnectionError;
    static APIConnectionTimeoutError = Real.APIConnectionTimeoutError;
    static APIUserAbortError = Real.APIUserAbortError;
    static BadRequestError = Real.BadRequestError;
    static AuthenticationError = Real.AuthenticationError;
    static PermissionDeniedError = Real.PermissionDeniedError;
    static NotFoundError = Real.NotFoundError;
    static RateLimitError = Real.RateLimitError;
    static InternalServerError = Real.InternalServerError;
    beta = { messages: { parse: mocks.parse, stream: mocks.stream } };
    constructor(options: unknown) {
      mocks.ctor(options);
    }
  }
  return { ...actual, default: FakeAnthropic };
});

import Anthropic from "@anthropic-ai/sdk";
import { AnthropicNutritionAI, FALLBACK_BETA, mapProviderError } from "./anthropic";
import { AiError } from "./errors";

const models = { vision: "claude-opus-5-5", text: "claude-opus-5-5", chat: "claude-opus-5-5" };
const usage = { input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };

const photoOutput = {
  is_food_image: true,
  uncertainty_note: "No se ve si el arroz lleva aceite.",
  items: [
    {
      name_es: "arroz blanco cocido",
      preparation: "no se distingue",
      estimated_grams: { min: 200, best: 150, max: 120 },
      confidence: 0.82,
      visible_evidence: "Granos blancos sueltos en medio plato.",
    },
  ],
};

function message(overrides: Record<string, unknown> = {}) {
  return { model: "claude-opus-5-5", stop_reason: "end_turn", content: [], usage, parsed_output: photoOutput, ...overrides };
}

const headers = new Headers();

describe("AnthropicNutritionAI.identifyFoodsFromPhoto", () => {
  beforeEach(() => {
    mocks.parse.mockReset();
    mocks.stream.mockReset();
    mocks.ctor.mockReset();
  });

  it("devuelve la salida normalizada, el uso y el costo estimado", async () => {
    mocks.parse.mockResolvedValue(message());
    const ai = new AnthropicNutritionAI({ apiKey: "sk-test", models });
    const res = await ai.identifyFoodsFromPhoto({ imageBase64: "QUJD", mediaType: "image/jpeg" });

    expect(mocks.ctor).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "sk-test", maxRetries: 2, timeout: 60_000 }));
    expect(res.output.isFoodImage).toBe(true);
    expect(res.output.items[0]).toMatchObject({
      nameEs: "arroz blanco cocido",
      preparation: null,
      estimatedGrams: { min: 120, best: 150, max: 200 },
      confidence: 0.82,
    });
    // Sin nutrientes: la IA solo dice qué y cuánto.
    expect(JSON.stringify(res.output)).not.toMatch(/kcal|calor|protein/i);
    expect(res.meta).toMatchObject({ provider: "anthropic", model: "claude-opus-5-5", inputTokens: 1000, outputTokens: 500 });
    expect(res.meta.estimatedCostUsd).toBeCloseTo(0.014, 6); // 1000×4/1e6 + 500×20/1e6
  });

  it("envía los parámetros verificados: fallbacks, effort, salida estructurada, sin temperature/thinking/tool_choice", async () => {
    mocks.parse.mockResolvedValue(message());
    const ai = new AnthropicNutritionAI({ apiKey: "sk-test", models });
    await ai.identifyFoodsFromPhoto({ imageBase64: "QUJD", mediaType: "image/png" });
    const params = mocks.parse.mock.calls[0]![0];
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.betas).toEqual([FALLBACK_BETA]);
    expect(params.fallbacks).toBe("default");
    expect(params.output_config.effort).toBe("medium");
    expect(params.output_config.format.type).toBe("json_schema");
    expect(params).not.toHaveProperty("temperature");
    expect(params).not.toHaveProperty("thinking");
    expect(params).not.toHaveProperty("tool_choice");
    expect(params.system).toMatch(/No des calorías/);
    const content = params.messages[0].content;
    expect(content[0]).toEqual({ type: "image", source: { type: "base64", media_type: "image/png", data: "QUJD" } });
  });

  it("con Haiku no envía fallbacks ni el beta de reintento", async () => {
    mocks.parse.mockResolvedValue(message({ model: "claude-haiku-5-5" }));
    const ai = new AnthropicNutritionAI({ apiKey: "sk-test", models: { ...models, vision: "claude-haiku-5-5" } });
    const res = await ai.identifyFoodsFromPhoto({ imageBase64: "QUJD", mediaType: "image/jpeg" });
    const params = mocks.parse.mock.calls[0]![0];
    expect(params).not.toHaveProperty("fallbacks");
    expect(params).not.toHaveProperty("betas");
    expect(res.meta.estimatedCostUsd).toBeCloseTo(0.00035, 8);
  });

  it("negativa (stop_reason refusal) → AI_REFUSED con los tokens gastados, sin resultado", async () => {
    mocks.parse.mockResolvedValue(message({ stop_reason: "refusal", parsed_output: null }));
    const ai = new AnthropicNutritionAI({ apiKey: "sk-test", models });
    const error = await ai.identifyFoodsFromPhoto({ imageBase64: "QUJD", mediaType: "image/jpeg" }).catch((e) => e);
    expect(error).toBeInstanceOf(AiError);
    expect(error).toMatchObject({ code: "AI_REFUSED", status: 422 });
    expect(error.meta).toMatchObject({ inputTokens: 1000, outputTokens: 500 });
  });

  it("parsed_output null → AI_INVALID_OUTPUT (nunca se inventa)", async () => {
    mocks.parse.mockResolvedValue(message({ parsed_output: null }));
    const ai = new AnthropicNutritionAI({ apiKey: "sk-test", models });
    await expect(ai.identifyFoodsFromPhoto({ imageBase64: "QUJD", mediaType: "image/jpeg" })).rejects.toMatchObject({
      code: "AI_INVALID_OUTPUT",
      status: 502,
    });
  });

  it("respuesta cortada por max_tokens → AI_INVALID_OUTPUT", async () => {
    mocks.parse.mockResolvedValue(message({ stop_reason: "max_tokens" }));
    const ai = new AnthropicNutritionAI({ apiKey: "sk-test", models });
    await expect(ai.identifyFoodsFromPhoto({ imageBase64: "QUJD", mediaType: "image/jpeg" })).rejects.toMatchObject({ code: "AI_INVALID_OUTPUT" });
  });

  it("salida que no cumple el esquema (el SDK lanza AnthropicError) → AI_INVALID_OUTPUT", async () => {
    mocks.parse.mockRejectedValue(new Anthropic.AnthropicError("Failed to parse structured output: …"));
    const ai = new AnthropicNutritionAI({ apiKey: "sk-test", models });
    await expect(ai.identifyFoodsFromPhoto({ imageBase64: "QUJD", mediaType: "image/jpeg" })).rejects.toMatchObject({ code: "AI_INVALID_OUTPUT" });
  });

  it("error de autenticación → AI_NOT_CONFIGURED (503)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.parse.mockRejectedValue(new Anthropic.AuthenticationError(401, { type: "authentication_error" }, "invalid x-api-key", headers));
    const ai = new AnthropicNutritionAI({ apiKey: "sk-bad", models });
    await expect(ai.identifyFoodsFromPhoto({ imageBase64: "QUJD", mediaType: "image/jpeg" })).rejects.toMatchObject({
      code: "AI_NOT_CONFIGURED",
      status: 503,
    });
  });

  it("límite del proveedor → AI_RATE_LIMITED (429)", async () => {
    mocks.parse.mockRejectedValue(new Anthropic.RateLimitError(429, { type: "rate_limit_error" }, "rate limited", headers));
    const ai = new AnthropicNutritionAI({ apiKey: "sk-test", models });
    await expect(ai.identifyFoodsFromPhoto({ imageBase64: "QUJD", mediaType: "image/jpeg" })).rejects.toMatchObject({
      code: "AI_RATE_LIMITED",
      status: 429,
    });
  });
});

describe("mapProviderError", () => {
  it("clasifica del más específico al más general", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(mapProviderError(new Anthropic.APIConnectionError({ message: "down" })).code).toBe("AI_UNAVAILABLE");
    expect(mapProviderError(new Anthropic.APIConnectionTimeoutError()).code).toBe("AI_UNAVAILABLE");
    expect(mapProviderError(new Anthropic.APIUserAbortError()).code).toBe("AI_ABORTED");
    expect(mapProviderError(new Anthropic.BadRequestError(400, {}, "bad", headers)).code).toBe("AI_PROVIDER_ERROR");
    expect(mapProviderError(new Anthropic.InternalServerError(529, {}, "overloaded", headers)).code).toBe("AI_PROVIDER_ERROR");
    expect(mapProviderError(new Anthropic.PermissionDeniedError(403, {}, "nope", headers)).code).toBe("AI_NOT_CONFIGURED");
    expect(mapProviderError(new TypeError("x")).code).toBe("AI_PROVIDER_ERROR");
    const already = new AiError("AI_REFUSED");
    expect(mapProviderError(already)).toBe(already);
  });
});

describe("AnthropicNutritionAI.parseFoodText", () => {
  beforeEach(() => mocks.parse.mockReset());

  it("usa effort low, normaliza y marca las aclaraciones", async () => {
    mocks.parse.mockResolvedValue(
      message({
        parsed_output: {
          items: [
            { food_query: "pollo", quantity: 150, unit: "g", grams_if_stated: 150, needs_clarification: false, clarification_question: null },
            { food_query: "arroz blanco cocido", quantity: 1, unit: "Taza", grams_if_stated: null, needs_clarification: null, clarification_question: null },
            { food_query: "palta", quantity: 0, unit: "unidad pequeña", grams_if_stated: null, needs_clarification: false, clarification_question: null },
          ],
        },
      }),
    );
    const ai = new AnthropicNutritionAI({ apiKey: "sk-test", models });
    const res = await ai.parseFoodText({ text: "Comí 150 g de pollo, una taza de arroz y palta" });
    const params = mocks.parse.mock.calls[0]![0];
    expect(params.output_config.effort).toBe("low");
    expect(params.messages[0].content).toContain("Comí 150 g de pollo");
    expect(res.output.items).toHaveLength(3);
    expect(res.output.items[0]).toMatchObject({ foodQuery: "pollo", gramsIfStated: 150, needsClarification: false });
    expect(res.output.items[1]).toMatchObject({ unit: "taza", needsClarification: false, clarificationQuestion: null });
    // Sin cantidad → 1 y pregunta.
    expect(res.output.items[2]).toMatchObject({ quantity: 1, needsClarification: true });
    expect(res.output.items[2]!.clarificationQuestion).toMatch(/palta/);
  });
});

type StreamEvent = { type: string; delta?: { type: string; text?: string } };

function fakeStream(events: StreamEvent[], final: Record<string, unknown>) {
  const abort = vi.fn();
  let ended = false;
  return {
    abort,
    get ended() {
      return ended;
    },
    async *[Symbol.asyncIterator]() {
      for (const e of events) yield e;
      ended = true;
    },
    finalMessage: vi.fn(async () => final),
  };
}

describe("AnthropicNutritionAI.chatStream", () => {
  beforeEach(() => mocks.stream.mockReset());

  it("emite trozos de texto y termina con el texto completo y el uso", async () => {
    const stream = fakeStream(
      [
        { type: "message_start" },
        { type: "content_block_delta", delta: { type: "text_delta", text: "Hola, " } },
        { type: "content_block_delta", delta: { type: "thinking_delta" } },
        { type: "content_block_delta", delta: { type: "text_delta", text: "¿cómo vas?" } },
      ],
      { model: "claude-opus-5-5", stop_reason: "end_turn", usage, content: [{ type: "text", text: "Hola, ¿cómo vas?" }] },
    );
    mocks.stream.mockReturnValue(stream);
    const ai = new AnthropicNutritionAI({ apiKey: "sk-test", models });
    const events = [];
    for await (const e of ai.chatStream({ system: "S", messages: [{ role: "user", content: "hola" }] })) events.push(e);
    expect(events.filter((e) => e.type === "text").map((e) => (e as { text: string }).text)).toEqual(["Hola, ", "¿cómo vas?"]);
    const end = events.at(-1) as { type: "end"; text: string; meta: { estimatedCostUsd: number } };
    expect(end.type).toBe("end");
    expect(end.text).toBe("Hola, ¿cómo vas?");
    expect(end.meta.estimatedCostUsd).toBeCloseTo(0.014, 6);
    const params = mocks.stream.mock.calls[0]![0];
    expect(params).toMatchObject({ fallbacks: "default", betas: [FALLBACK_BETA], output_config: { effort: "low" }, system: "S" });
    expect(params).not.toHaveProperty("thinking");
  });

  it("negativa a mitad de la respuesta → AI_REFUSED (el parcial se descarta)", async () => {
    mocks.stream.mockReturnValue(
      fakeStream([{ type: "content_block_delta", delta: { type: "text_delta", text: "Parcial" } }], {
        model: "claude-opus-5-5",
        stop_reason: "refusal",
        usage,
        content: [{ type: "text", text: "Parcial" }],
      }),
    );
    const ai = new AnthropicNutritionAI({ apiKey: "sk-test", models });
    const seen: string[] = [];
    const run = async () => {
      for await (const e of ai.chatStream({ system: "S", messages: [{ role: "user", content: "x" }] })) seen.push(e.type);
    };
    await expect(run()).rejects.toMatchObject({ code: "AI_REFUSED" });
    expect(seen).toEqual(["text"]);
  });

  it("si quien consume deja de leer, se corta la conexión", async () => {
    const stream = fakeStream(
      [
        { type: "content_block_delta", delta: { type: "text_delta", text: "a" } },
        { type: "content_block_delta", delta: { type: "text_delta", text: "b" } },
      ],
      { model: "claude-opus-5-5", stop_reason: "end_turn", usage, content: [] },
    );
    mocks.stream.mockReturnValue(stream);
    const ai = new AnthropicNutritionAI({ apiKey: "sk-test", models });
    for await (const e of ai.chatStream({ system: "S", messages: [{ role: "user", content: "x" }] })) {
      expect(e.type).toBe("text");
      break;
    }
    expect(stream.abort).toHaveBeenCalled();
  });
});
