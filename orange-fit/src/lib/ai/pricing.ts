/**
 * Precios de referencia en USD por millón de tokens (docs/AI_INTEGRATION_NOTES.md y tabla oficial
 * cacheada 2026-10-06). Sirven para guardar un costo ESTIMADO por solicitud; la factura real es la
 * del proveedor. Un modelo desconocido no se adivina: el costo queda en null.
 */

export type ModelPrice = { inputPerMTok: number; outputPerMTok: number };

export const MODEL_PRICING: Readonly<Record<string, ModelPrice>> = {
  "claude-opus-5-5": { inputPerMTok: 4, outputPerMTok: 20 },
  "claude-sonnet-5-5": { inputPerMTok: 2, outputPerMTok: 10 },
  // Haiku 5.5: precio hasta 100K tokens de prompt (nuestras solicitudes son mucho menores).
  "claude-haiku-5-5": { inputPerMTok: 0.1, outputPerMTok: 0.5 },
  // Modelos a los que puede derivar el reintento server-side (`fallbacks: "default"`).
  "claude-opus-5": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-opus-4-8": { inputPerMTok: 5, outputPerMTok: 25 },
};

/** Precio del modelo; acepta IDs con sufijos de plataforma ("anthropic.claude-…", "…@fecha"). */
export function priceFor(model: string | null | undefined): ModelPrice | null {
  if (!model) return null;
  const id = model.trim().toLowerCase().replace(/^anthropic\./, "").replace(/@.*$/, "");
  return MODEL_PRICING[id] ?? null;
}

export function isHaikuModel(model: string): boolean {
  return /haiku/i.test(model);
}

export type UsageLike = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/** Iteración de `usage.iterations` (una por intento: modelo pedido y, si hubo, el de respaldo). */
export type UsageIterationLike = UsageLike & { type?: string; model?: string | null };

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** Costo de una cantidad de tokens con el precio de un modelo. Escritura en caché ×1.25, lectura ×0.1. */
export function costForTokens(price: ModelPrice, usage: UsageLike): number {
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const inputEquivalent = input + cacheWrite * 1.25 + cacheRead * 0.1;
  return (inputEquivalent * price.inputPerMTok + output * price.outputPerMTok) / 1_000_000;
}

/**
 * Costo estimado en USD (6 decimales, como `ai_analysis_requests.estimated_cost_usd`).
 * Si la respuesta trae `iterations` (hubo reintento en otro modelo), se suma cada intento con el
 * precio de SU modelo; si alguno es desconocido, el total es null (no inventamos).
 */
export function estimateCostUsd(
  usage: (UsageLike & { iterations?: readonly UsageIterationLike[] | null }) | null | undefined,
  model: string,
): number | null {
  if (!usage) return null;
  const iterations = usage.iterations?.filter((it) => it && (it.input_tokens != null || it.output_tokens != null)) ?? [];
  if (iterations.length > 0) {
    let total = 0;
    for (const it of iterations) {
      const price = priceFor(it.model ?? model);
      if (!price) return null;
      total += costForTokens(price, it);
    }
    return round6(total);
  }
  const price = priceFor(model);
  if (!price) return null;
  return round6(costForTokens(price, usage));
}

/** Tokens totales de entrada/salida (sumando intentos si los hay) para guardar en la solicitud. */
export function totalTokens(usage: (UsageLike & { iterations?: readonly UsageIterationLike[] | null }) | null | undefined): {
  inputTokens: number;
  outputTokens: number;
} {
  if (!usage) return { inputTokens: 0, outputTokens: 0 };
  const iterations = usage.iterations?.filter((it) => it && (it.input_tokens != null || it.output_tokens != null)) ?? [];
  const list: UsageLike[] = iterations.length > 0 ? iterations : [usage];
  let inputTokens = 0;
  let outputTokens = 0;
  for (const u of list) {
    inputTokens += (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    outputTokens += u.output_tokens ?? 0;
  }
  return { inputTokens, outputTokens };
}
