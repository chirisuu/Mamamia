import { AI_RATE_LIMITS, aiErrorResponse, aiJsonError, aiJsonOk, enforceAiRateLimit, guardAiRoute } from "@/features/ai/server/http";
import type { TranscribeResponse } from "@/features/ai/schemas";
import { runWithAiQuota } from "@/lib/ai/quota";
import { isAcceptedAudioType, MAX_AUDIO_BYTES, transcribeAudio } from "@/lib/ai/transcription";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

/**
 * POST /api/ai/transcribe (multipart: `audio` ≤ 8 MB). Adaptador opcional: solo funciona con
 * TRANSCRIPTION_PROVIDER=openai y OPENAI_API_KEY; si no, 503 TRANSCRIPTION_NOT_CONFIGURED.
 * Consume cupo de voz. El audio no se guarda y el texto no se almacena en la solicitud.
 */
export async function POST(request: Request) {
  const guard = await guardAiRoute("voice", "transcription");
  if (!guard.ok) return guard.response;
  const { supabase } = guard;

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_AUDIO_BYTES + 512 * 1024) {
    return aiJsonError(413, "AUDIO_TOO_LARGE", "El audio es demasiado largo. Graba un mensaje más corto (hasta 1 minuto).");
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return aiJsonError(400, "VALIDATION", "Envía el audio como formulario (campo «audio»).");
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return aiJsonError(400, "VALIDATION", "No recibimos audio.");
  if (audio.size > MAX_AUDIO_BYTES) {
    return aiJsonError(413, "AUDIO_TOO_LARGE", "El audio es demasiado largo. Graba un mensaje más corto (hasta 1 minuto).");
  }
  if (!isAcceptedAudioType(audio.type)) return aiJsonError(415, "AUDIO_TYPE", "Formato de audio no compatible.");

  const limited = await enforceAiRateLimit(supabase, AI_RATE_LIMITS.voice.bucket, AI_RATE_LIMITS.voice.max, AI_RATE_LIMITS.voice.window);
  if (limited) return limited;

  try {
    const { result, requestId, reservation } = await runWithAiQuota(
      supabase,
      "voice",
      async () => {
        const transcript = await transcribeAudio(audio, { signal: request.signal });
        return {
          result: transcript,
          completion: {
            provider: "openai",
            model: transcript.model,
            // Sin el texto: solo su largo. El precio por minuto no se estima aquí (costo null).
            output: { stage: "transcription", chars: transcript.text.length },
            latencyMs: transcript.latencyMs,
          },
        };
      },
      { provider: "openai" },
    );
    return aiJsonOk<TranscribeResponse>({ requestId, text: result.text, quota: { used: reservation.used, limit: reservation.limit } });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
