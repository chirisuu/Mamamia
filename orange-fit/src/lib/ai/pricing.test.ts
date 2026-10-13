import { describe, expect, it } from "vitest";
import { estimateCostUsd, isHaikuModel, priceFor, totalTokens } from "./pricing";

describe("pricing", () => {
  it("precios por millón de tokens de los modelos configurables", () => {
    expect(priceFor("claude-opus-5-5")).toEqual({ inputPerMTok: 4, outputPerMTok: 20 });
    expect(priceFor("claude-sonnet-5-5")).toEqual({ inputPerMTok: 2, outputPerMTok: 10 });
    expect(priceFor("claude-haiku-5-5")).toEqual({ inputPerMTok: 0.1, outputPerMTok: 0.5 });
    expect(priceFor("anthropic.claude-opus-5-5")).toEqual({ inputPerMTok: 4, outputPerMTok: 20 });
    expect(priceFor("modelo-desconocido")).toBeNull();
    expect(priceFor(null)).toBeNull();
  });

  it("costo estimado = entrada × precio + salida × precio (6 decimales)", () => {
    expect(estimateCostUsd({ input_tokens: 1_000_000, output_tokens: 1_000_000 }, "claude-opus-5-5")).toBe(24);
    expect(estimateCostUsd({ input_tokens: 1200, output_tokens: 300 }, "claude-sonnet-5-5")).toBe(0.0054);
    expect(estimateCostUsd({ input_tokens: 2000, output_tokens: 1000 }, "claude-haiku-5-5")).toBe(0.0007);
  });

  it("caché: escritura ×1.25 y lectura ×0.1 del precio de entrada", () => {
    expect(
      estimateCostUsd({ input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 1000, cache_read_input_tokens: 10_000 }, "claude-opus-5-5"),
    ).toBe(0.009);
  });

  it("con reintento server-side suma cada intento con el precio de su modelo", () => {
    const usage = {
      input_tokens: 500,
      output_tokens: 200,
      iterations: [
        { type: "message", model: "claude-opus-5-5", input_tokens: 500, output_tokens: 0 },
        { type: "fallback_message", model: "claude-opus-4-8", input_tokens: 500, output_tokens: 200 },
      ],
    };
    // 500×4 + 500×5 + 200×25 = 9500 → /1e6
    expect(estimateCostUsd(usage, "claude-opus-5-5")).toBe(0.0095);
    expect(totalTokens(usage)).toEqual({ inputTokens: 1000, outputTokens: 200 });
  });

  it("modelo sin precio conocido → null (no se inventa)", () => {
    expect(estimateCostUsd({ input_tokens: 10, output_tokens: 10 }, "otro-modelo")).toBeNull();
    expect(
      estimateCostUsd({ input_tokens: 10, output_tokens: 10, iterations: [{ model: "x", input_tokens: 1, output_tokens: 1 }] }, "claude-opus-5-5"),
    ).toBeNull();
    expect(estimateCostUsd(null, "claude-opus-5-5")).toBeNull();
  });

  it("detecta la familia Haiku", () => {
    expect(isHaikuModel("claude-haiku-5-5")).toBe(true);
    expect(isHaikuModel("claude-opus-5-5")).toBe(false);
  });
});
