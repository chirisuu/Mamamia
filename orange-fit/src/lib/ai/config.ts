import "server-only";
import { serverEnv } from "@/lib/server-env";
import { AnthropicNutritionAI } from "./anthropic";
import type { NutritionAI } from "./provider";

/**
 * Configuración de la IA desde el entorno (solo servidor). Sin `ANTHROPIC_API_KEY` la IA queda
 * "pendiente de configurar": las rutas responden 503 AI_NOT_CONFIGURED y la UI lo dice.
 */
export type AiConfig = {
  configured: boolean;
  models: { vision: string; text: string; chat: string };
  transcription: { configured: boolean; provider: "openai" | null };
};

export function aiConfig(): AiConfig {
  const env = serverEnv();
  return {
    configured: Boolean(env.ANTHROPIC_API_KEY),
    models: { vision: env.AI_MODEL_VISION, text: env.AI_MODEL_TEXT, chat: env.AI_MODEL_CHAT },
    transcription: {
      configured: env.TRANSCRIPTION_PROVIDER === "openai" && Boolean(env.OPENAI_API_KEY),
      provider: env.TRANSCRIPTION_PROVIDER === "openai" ? "openai" : null,
    },
  };
}

let cached: { key: string; ai: NutritionAI } | null = null;

/** Proveedor de IA listo para usar, o null si falta la clave (nunca se simula una respuesta). */
export function getNutritionAI(): NutritionAI | null {
  const env = serverEnv();
  const key = env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if (cached?.key === key) return cached.ai;
  const ai = new AnthropicNutritionAI({
    apiKey: key,
    models: { vision: env.AI_MODEL_VISION, text: env.AI_MODEL_TEXT, chat: env.AI_MODEL_CHAT },
  });
  cached = { key, ai };
  return ai;
}
