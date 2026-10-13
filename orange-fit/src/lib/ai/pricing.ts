/**
 * Precios de referencia en USD por millón de tokens (docs/AI_INTEGRATION_NOTES.md y tabla oficial
 * de la referencia del SDK, cacheada 2026-10-06). Sirven para guardar un costo ESTIMADO por
 * solicitud; la factura real es la del proveedor. Un modelo desconocido no se adivina: el costo
 * queda en null.
 */

export type ModelPrice = {
  inputPerMTok: number;
  outputPerMTok: number;
  /** Lectura de caché; si no se indica, 0.1 × entrada (regla general). */
  cacheReadPerMTok?: number;
};

export const MODEL_PRICING: Readonly<Record<string, ModelPrice>> = {
  // Modelos configurables (AI_MODEL_VISION / AI_MODEL_TEXT / AI_MODEL_CHAT).
  "claude-opus-5-5": { inputPerMTok: 4, outputPerMTok: 20, cacheReadPerMTok: 0.2 },
  "claude-sonnet-5-5": { inputPerMTok: 2, outputPerMTok: 10, cacheReadPerMTok: 0.2 },
  // Haiku 5.5: precio hasta 100K tokens de prompt (nuestras solicitudes son mucho menores).
  "claude-haiku-5-5": { inputPerMTok: 0.1, outputPerMTok: 0.5 },
  // Modelos a los que deriva el reintento server-side (`fallbacks: "default"`): Opus 5.5 → Opus 5
  // u Opus 4.8; Sonnet 5.5 → Sonnet 5. Y otros IDs vigentes que el operador podría configurar.
  "claude-opus-5": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-opus-4-8": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-opus-4-7": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-opus-4-6": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-sonnet-5": { inputPerMTok: 2, outputPerMTok: 10 },
  "claude-sonnet-4-6": { inputPerMTok: 3, outputPerMTok: 15 },
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5 },
  "claude-fable-5-1": { inputPerMTok: 10, outputPerMTok: 50, cacheReadPerMTok: 0.25 },
  "claude-fable-5": { inputPerMTok: 10, outputPerMTok: 50, cacheReadPerMTok: 1 },
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

/** Costo de una cantidad de tokens con el precio de un modelo. Escritura en caché ×1.25 (TTL 5 min). */
export function costForTokens(price: ModelPrice, usage: UsageLike): number {
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheReadPrice = price.cacheReadPerMTok ?? price.inputPerMTok * 0.1;
  return ((input + cacheWrite * 1.25) * price.inputPerMTok + cacheRead * cacheReadPrice + output * price.outputPerMTok) / 1_000_000;
}

type UsageWithIterations = UsageLike & { iterations?: readonly UsageIterationLike[] | null };

const countedIterations = (usage: UsageWithIterations) =>
  usage.iterations?.filter((it) => it && (it.input_tokens != null || it.output_tokens != null)) ?? [];

/**
 * Costo estimado en USD (6 decimales, como `ai_analysis_requests.estimated_cost_usd`).
 * `model` es el que respondió (`response.model`). Si la respuesta trae `iterations` (hubo reintento
 * en otro modelo), se suma cada intento con el precio de SU modelo; un intento sin modelo es del
 * modelo pedido (`requestedModel`). Si alguno es desconocido, el total es null (no inventamos).
 */
export function estimateCostUsd(usage: UsageWithIterations | null | undefined, model: string, requestedModel?: string): number | null {
  if (!usage) return null;
  const iterations = countedIterations(usage);
  if (iterations.length > 0) {
    let total = 0;
    for (const it of iterations) {
      const price = priceFor(it.model ?? requestedModel ?? model);
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
export function totalTokens(usage: UsageWithIterations | null | undefined): { inputTokens: number; outputTokens: number } {
  if (!usage) return { inputTokens: 0, outputTokens: 0 };
  const iterations = countedIterations(usage);
  const list: UsageLike[] = iterations.length > 0 ? iterations : [usage];
  let inputTokens = 0;
  let outputTokens = 0;
  for (const u of list) {
    inputTokens += (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    outputTokens += u.output_tokens ?? 0;
  }
  return { inputTokens, outputTokens };
}
