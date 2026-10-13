import { analyzeText } from "@/features/ai/server/analyze";
import { AI_RATE_LIMITS, aiErrorResponse, aiJsonError, aiJsonOk, enforceAiRateLimit, guardAiRoute, readJson } from "@/features/ai/server/http";
import { textRequestSchema, type TextAnalysisResponse } from "@/features/ai/schemas";
import { getNutritionAI } from "@/lib/ai/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

/**
 * POST /api/ai/text `{ text, mode: "text" | "voice" }`. Convierte lo que la persona escribió o
 * dictó en candidatos (alimento + cantidad) con hasta 3 coincidencias de la base cada uno.
 * `mode: "voice"` exige ai_voice y consume el cupo de voz. NO registra nada.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  const mode = body && typeof body === "object" && (body as { mode?: unknown }).mode === "voice" ? "voice" : "text";
  const guard = await guardAiRoute(mode);
  if (!guard.ok) return guard.response;
  const { supabase, user } = guard;

  const parsed = textRequestSchema.safeParse(body);
  if (!parsed.success) return aiJsonError(400, "VALIDATION", parsed.error.issues[0]?.message ?? "Revisa el texto.");

  const limits = AI_RATE_LIMITS[mode];
  const limited = await enforceAiRateLimit(supabase, limits.bucket, limits.max, limits.window);
  if (limited) return limited;

  const ai = getNutritionAI();
  if (!ai) return aiJsonError(503, "AI_NOT_CONFIGURED", "La IA está pendiente de configurar.");
  try {
    const result = await analyzeText({ supabase, userId: user.id, ai }, { text: parsed.data.text, mode, signal: request.signal });
    return aiJsonOk<TextAnalysisResponse>(result);
  } catch (error) {
    return aiErrorResponse(error);
  }
}
