/**
 * Cliente de /api/ai/* para el navegador. Convierte los errores JSON en `AiApiError` con su código
 * para que la UI muestre el estado honesto (sin consentimiento, sin cupo, pendiente de configurar…).
 */
import type { FoodSearchResponse, FoodWithPortions } from "@/lib/foods/api-types";
import type { AiApiErrorBody, AiQuotaDto, PhotoAnalysisResponse, TextAnalysisResponse, TranscribeResponse } from "../schemas";

export class AiApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly quota?: AiQuotaDto,
  ) {
    super(message);
    this.name = "AiApiError";
  }
}

const NETWORK_MESSAGE = "No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.";

export async function readApiError(res: Response): Promise<AiApiError> {
  const body = (await res.json().catch(() => null)) as AiApiErrorBody | null;
  const code = body?.error?.code ?? (res.status === 401 ? "UNAUTHORIZED" : "UNEXPECTED");
  const message = body?.error?.message ?? (res.status === 401 ? "Tu sesión terminó. Vuelve a ingresar." : "Algo salió mal. Inténtalo de nuevo.");
  return new AiApiError(res.status, code, message, body?.error?.quota);
}

async function request<T>(input: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, { ...init, credentials: "same-origin", cache: "no-store" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new AiApiError(0, "NETWORK", NETWORK_MESSAGE);
  }
  if (!res.ok) throw await readApiError(res);
  return (await res.json()) as T;
}

export function analyzePhotoRequest(image: Blob, savePhoto: boolean, signal?: AbortSignal): Promise<PhotoAnalysisResponse> {
  const form = new FormData();
  form.append("image", image, image instanceof File ? image.name : "foto.jpg");
  form.append("savePhoto", savePhoto ? "true" : "false");
  return request<PhotoAnalysisResponse>("/api/ai/photo", { method: "POST", body: form, signal });
}

export function analyzeTextRequest(text: string, mode: "text" | "voice", signal?: AbortSignal): Promise<TextAnalysisResponse> {
  return request<TextAnalysisResponse>("/api/ai/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, mode }),
    signal,
  });
}

export function transcribeRequest(audio: Blob, signal?: AbortSignal): Promise<TranscribeResponse> {
  const form = new FormData();
  const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
  form.append("audio", audio, `dictado.${ext}`);
  return request<TranscribeResponse>("/api/ai/transcribe", { method: "POST", body: form, signal });
}

/** Búsqueda en la base (contrato 1 del módulo alimentos). */
export async function searchFoodsRequest(q: string, signal?: AbortSignal): Promise<FoodWithPortions[]> {
  const res = await request<FoodSearchResponse>(`/api/foods/search?q=${encodeURIComponent(q)}&limit=20`, { method: "GET", signal });
  return res.foods;
}
