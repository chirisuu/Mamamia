/**
 * Interfaz del proveedor de IA. La app depende de esta interfaz, no del SDK: así se puede cambiar
 * de proveedor (o simularlo en pruebas) sin tocar rutas ni pantallas. Solo tipos.
 *
 * Contrato de cada método:
 * - Devuelve la salida YA normalizada y los datos de uso (tokens, modelo, costo estimado, latencia).
 * - Ante cualquier fallo lanza `AiError` (src/lib/ai/errors.ts); nunca devuelve datos inventados.
 * - Nunca calcula ni devuelve calorías o nutrientes: solo qué alimento y cuánto.
 */
import type { PhotoAnalysis, TextParse } from "./normalize";

export type AiProviderName = "anthropic";

export type AiCallMeta = {
  provider: AiProviderName;
  /** Modelo que respondió (puede ser el de respaldo si hubo reintento server-side). */
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** USD estimados con `pricing.ts`; null si el modelo no tiene precio conocido. */
  estimatedCostUsd: number | null;
  latencyMs: number;
};

export type AiCallResult<T> = { output: T; meta: AiCallMeta };

export type AiImageMediaType = "image/jpeg" | "image/png" | "image/webp";

export type PhotoInput = { imageBase64: string; mediaType: AiImageMediaType };

export type TextInput = { text: string };

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ChatInput = { system: string; messages: ChatTurn[] };

export type ChatStreamEvent =
  | { type: "text"; text: string }
  | { type: "end"; text: string; meta: AiCallMeta };

export type CallOptions = { signal?: AbortSignal };

export interface NutritionAI {
  readonly provider: AiProviderName;
  identifyFoodsFromPhoto(input: PhotoInput, options?: CallOptions): Promise<AiCallResult<PhotoAnalysis>>;
  parseFoodText(input: TextInput, options?: CallOptions): Promise<AiCallResult<TextParse>>;
  /**
   * Respuesta del asistente en streaming. Emite trozos de texto y termina con un evento `end`
   * (texto completo + uso). Si el modelo se niega a mitad de camino lanza `AiError("AI_REFUSED")`:
   * quien consume debe descartar el texto parcial.
   */
  chatStream(input: ChatInput, options?: CallOptions): AsyncGenerator<ChatStreamEvent, void, unknown>;
}
