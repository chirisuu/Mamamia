import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaContentBlock, BetaMessageParam, BetaUsage } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { AiError, type AiErrorMeta } from "./errors";
import { normalizePhotoAnalysis, normalizeTextParse, type PhotoAnalysis, type TextParse } from "./normalize";
import { estimateCostUsd, isHaikuModel, totalTokens } from "./pricing";
import { PHOTO_SYSTEM_PROMPT, PHOTO_USER_INSTRUCTION, TEXT_SYSTEM_PROMPT, textUserMessage } from "./prompts";
import type {
  AiCallMeta,
  AiCallResult,
  CallOptions,
  ChatInput,
  ChatStreamEvent,
  NutritionAI,
  PhotoInput,
  TextInput,
} from "./provider";
import { photoAnalysisSchema, textParseSchema } from "./schemas";

/**
 * Implementación con Claude (SDK @anthropic-ai/sdk 0.133), según docs/AI_INTEGRATION_NOTES.md:
 * `client.beta.messages.parse` + `betaZodOutputFormat` para JSON, `client.beta.messages.stream`
 * para el chat, reintento server-side (`fallbacks: "default"`, salvo Haiku), `output_config.effort`
 * sin `thinking` disabled, sin temperature ni tool_choice forzado, y revisión de `stop_reason`.
 */

export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export type AnthropicModels = { vision: string; text: string; chat: string };

type MessagesClient = Pick<Anthropic, "beta">;

/** Parámetros de reintento server-side: no se envían con Haiku (allí no existen). */
export function fallbackParams(model: string): { betas?: string[]; fallbacks?: "default" } {
  return isHaikuModel(model) ? {} : { betas: [FALLBACK_BETA], fallbacks: "default" };
}

function usageMeta(model: string, usage: BetaUsage | null | undefined, startedAt: number): AiCallMeta {
  const tokens = totalTokens(usage ?? null);
  return {
    provider: "anthropic",
    model,
    inputTokens: tokens.inputTokens,
    outputTokens: tokens.outputTokens,
    estimatedCostUsd: estimateCostUsd(usage ?? null, model),
    latencyMs: Math.max(0, Math.round(Date.now() - startedAt)),
  };
}

const toErrorMeta = (meta: AiCallMeta): AiErrorMeta => ({
  model: meta.model,
  inputTokens: meta.inputTokens,
  outputTokens: meta.outputTokens,
  estimatedCostUsd: meta.estimatedCostUsd,
  latencyMs: meta.latencyMs,
});

/**
 * Traduce un error del SDK a `AiError`, del más específico al más general. En los logs solo va
 * la clase y el status, nunca el contenido de la persona.
 */
export function mapProviderError(error: unknown, startedAt?: number): AiError {
  if (error instanceof AiError) return error;
  const meta: AiErrorMeta | undefined = startedAt ? { latencyMs: Math.max(0, Math.round(Date.now() - startedAt)) } : undefined;
  if (error instanceof Anthropic.APIUserAbortError) return new AiError("AI_ABORTED", { meta, cause: error });
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    console.error("[ai] credencial rechazada por el proveedor", { status: error.status });
    return new AiError("AI_NOT_CONFIGURED", {
      message: "La IA no está disponible: la credencial del servicio no es válida. Ya lo estamos revisando; mientras tanto, busca el alimento por nombre.",
      meta,
      cause: error,
    });
  }
  if (error instanceof Anthropic.RateLimitError) return new AiError("AI_RATE_LIMITED", { meta, cause: error });
  if (error instanceof Anthropic.BadRequestError) {
    // Es un error nuestro (parámetros); se registra sin contenido del usuario.
    console.error("[ai] solicitud rechazada por el proveedor (400)", { type: (error as { type?: string }).type ?? null });
    return new AiError("AI_PROVIDER_ERROR", { meta, cause: error });
  }
  // En el SDK de TypeScript APIConnectionError hereda de APIError: va antes.
  if (error instanceof Anthropic.APIConnectionError) return new AiError("AI_UNAVAILABLE", { meta, cause: error });
  if (error instanceof Anthropic.APIError) {
    console.error("[ai] error del proveedor", { status: error.status ?? null });
    return new AiError("AI_PROVIDER_ERROR", { meta, cause: error });
  }
  // AnthropicError a secas: la salida estructurada no cumplió el esquema al parsearla.
  if (error instanceof Anthropic.AnthropicError) return new AiError("AI_INVALID_OUTPUT", { meta, cause: error });
  console.error("[ai] error inesperado", { name: error instanceof Error ? error.name : typeof error });
  return new AiError("AI_PROVIDER_ERROR", { meta, cause: error });
}

export class AnthropicNutritionAI implements NutritionAI {
  readonly provider = "anthropic" as const;
  private readonly client: MessagesClient;
  readonly models: AnthropicModels;

  constructor(options: { apiKey: string; models: AnthropicModels; client?: MessagesClient }) {
    this.models = options.models;
    this.client = options.client ?? new Anthropic({ apiKey: options.apiKey, maxRetries: 2, timeout: 60_000 });
  }

  async identifyFoodsFromPhoto(input: PhotoInput, options: CallOptions = {}): Promise<AiCallResult<PhotoAnalysis>> {
    const model = this.models.vision;
    const startedAt = Date.now();
    try {
      const response = await this.client.beta.messages.parse(
        {
          model,
          max_tokens: 16000,
          ...fallbackParams(model),
          output_config: { effort: "medium", format: betaZodOutputFormat(photoAnalysisSchema) },
          system: PHOTO_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: input.mediaType, data: input.imageBase64 } },
                { type: "text", text: PHOTO_USER_INSTRUCTION },
              ],
            },
          ],
        },
        { signal: options.signal },
      );
      const meta = usageMeta(response.model ?? model, response.usage, startedAt);
      if (response.stop_reason === "refusal") throw new AiError("AI_REFUSED", { meta: toErrorMeta(meta) });
      if (response.stop_reason === "max_tokens") throw new AiError("AI_INVALID_OUTPUT", { meta: toErrorMeta(meta) });
      const parsed = response.parsed_output;
      if (!parsed) throw new AiError("AI_INVALID_OUTPUT", { meta: toErrorMeta(meta) });
      return { output: normalizePhotoAnalysis(parsed), meta };
    } catch (error) {
      throw mapProviderError(error, startedAt);
    }
  }

  async parseFoodText(input: TextInput, options: CallOptions = {}): Promise<AiCallResult<TextParse>> {
    const model = this.models.text;
    const startedAt = Date.now();
    try {
      const response = await this.client.beta.messages.parse(
        {
          model,
          max_tokens: 16000,
          ...fallbackParams(model),
          output_config: { effort: "low", format: betaZodOutputFormat(textParseSchema) },
          system: TEXT_SYSTEM_PROMPT,
          messages: [{ role: "user", content: textUserMessage(input.text) }],
        },
        { signal: options.signal },
      );
      const meta = usageMeta(response.model ?? model, response.usage, startedAt);
      if (response.stop_reason === "refusal") throw new AiError("AI_REFUSED", { meta: toErrorMeta(meta) });
      if (response.stop_reason === "max_tokens") throw new AiError("AI_INVALID_OUTPUT", { meta: toErrorMeta(meta) });
      const parsed = response.parsed_output;
      if (!parsed) throw new AiError("AI_INVALID_OUTPUT", { meta: toErrorMeta(meta) });
      return { output: normalizeTextParse(parsed), meta };
    } catch (error) {
      throw mapProviderError(error, startedAt);
    }
  }

  async *chatStream(input: ChatInput, options: CallOptions = {}): AsyncGenerator<ChatStreamEvent, void, unknown> {
    const model = this.models.chat;
    const startedAt = Date.now();
    const messages: BetaMessageParam[] = input.messages.map((m) => ({ role: m.role, content: m.content }));
    let stream: ReturnType<MessagesClient["beta"]["messages"]["stream"]> | null = null;
    try {
      stream = this.client.beta.messages.stream(
        {
          model,
          max_tokens: 4000,
          ...fallbackParams(model),
          output_config: { effort: "low" },
          system: input.system,
          messages,
        },
        { signal: options.signal },
      );
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta" && event.delta.text) {
          yield { type: "text", text: event.delta.text };
        }
      }
      const final = await stream.finalMessage();
      const meta = usageMeta(final.model ?? model, final.usage, startedAt);
      // Negativa (antes o a mitad de la respuesta): se descarta lo parcial.
      if (final.stop_reason === "refusal") throw new AiError("AI_REFUSED", { meta: toErrorMeta(meta) });
      const blocks: BetaContentBlock[] = final.content;
      const text = blocks
        .flatMap((block) => (block.type === "text" ? [block.text] : []))
        .join("")
        .trim();
      if (!text) throw new AiError("AI_INVALID_OUTPUT", { meta: toErrorMeta(meta) });
      yield { type: "end", text, meta };
    } catch (error) {
      throw mapProviderError(error, startedAt);
    } finally {
      // Si quien consume deja de leer (la persona cerró el chat), se corta la conexión.
      if (stream && !stream.ended) stream.abort();
    }
  }
}
