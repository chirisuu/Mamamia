import "server-only";
import { serverEnv } from "@/lib/server-env";

/**
 * Adaptador OPCIONAL de transcripción de voz (OpenAI `/v1/audio/transcriptions` por REST).
 * Solo se activa con TRANSCRIPTION_PROVIDER=openai y OPENAI_API_KEY; si no, la ruta responde 503
 * TRANSCRIPTION_NOT_CONFIGURED y la pantalla de voz ofrece el dictado del navegador o el texto.
 * El audio no se guarda: se reenvía al proveedor y se descarta.
 */

export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
export const ACCEPTED_AUDIO_TYPES = [
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
] as const;

const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";
/** Modelo por defecto; se puede cambiar con OPENAI_TRANSCRIPTION_MODEL. */
const DEFAULT_MODEL = "whisper-1";

export class TranscriptionError extends Error {
  constructor(
    readonly code:
      | "TRANSCRIPTION_NOT_CONFIGURED"
      | "TRANSCRIPTION_FAILED"
      | "TRANSCRIPTION_RATE_LIMITED"
      | "TRANSCRIPTION_UNAVAILABLE"
      | "TRANSCRIPTION_EMPTY",
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "TranscriptionError";
  }
}

export function transcriptionConfigured(): boolean {
  const env = serverEnv();
  return env.TRANSCRIPTION_PROVIDER === "openai" && Boolean(env.OPENAI_API_KEY);
}

/** Tipo base sin parámetros ("audio/webm;codecs=opus" → "audio/webm"). */
export function baseAudioType(type: string): string {
  return type.split(";")[0]!.trim().toLowerCase();
}

export function isAcceptedAudioType(type: string): boolean {
  return (ACCEPTED_AUDIO_TYPES as readonly string[]).includes(baseAudioType(type));
}

const EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

export type TranscriptionResult = { text: string; model: string; latencyMs: number };

export async function transcribeAudio(
  audio: Blob,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<TranscriptionResult> {
  const env = serverEnv();
  if (env.TRANSCRIPTION_PROVIDER !== "openai" || !env.OPENAI_API_KEY) {
    throw new TranscriptionError("TRANSCRIPTION_NOT_CONFIGURED", 503, "La transcripción de voz en el servidor está pendiente de configurar.");
  }
  const model = env.OPENAI_TRANSCRIPTION_MODEL?.trim() || DEFAULT_MODEL;
  const type = baseAudioType(audio.type || "audio/webm");
  const form = new FormData();
  form.append("file", new File([audio], `dictado.${EXTENSIONS[type] ?? "webm"}`, { type }));
  form.append("model", model);
  form.append("language", "es");
  form.append("response_format", "json");
  const startedAt = Date.now();
  let res: Response;
  try {
    res = await (options.fetchImpl ?? fetch)(OPENAI_TRANSCRIPTIONS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: form,
      signal: options.signal ?? AbortSignal.timeout(60_000),
    });
  } catch {
    throw new TranscriptionError("TRANSCRIPTION_UNAVAILABLE", 503, "No pudimos conectar con el servicio de transcripción. Inténtalo de nuevo.");
  }
  if (res.status === 401 || res.status === 403) {
    console.error("[ai] transcripción: credencial rechazada", { status: res.status });
    throw new TranscriptionError("TRANSCRIPTION_NOT_CONFIGURED", 503, "La transcripción no está disponible: la credencial no es válida.");
  }
  if (res.status === 429) {
    throw new TranscriptionError("TRANSCRIPTION_RATE_LIMITED", 429, "El servicio de transcripción está ocupado. Espera un momento y vuelve a intentarlo.");
  }
  if (!res.ok) {
    console.error("[ai] transcripción falló", { status: res.status });
    throw new TranscriptionError("TRANSCRIPTION_FAILED", 502, "No pudimos transcribir el audio. Inténtalo de nuevo o escríbelo.");
  }
  const body = (await res.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
  if (!text) throw new TranscriptionError("TRANSCRIPTION_EMPTY", 422, "No entendimos nada en el audio. Habla más cerca del micrófono o escríbelo.");
  return { text: text.slice(0, 1000), model, latencyMs: Date.now() - startedAt };
}
