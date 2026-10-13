import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { aiConfig } from "@/lib/ai/config";
import { AiError, isAiError } from "@/lib/ai/errors";
import { ImageInputError } from "@/lib/ai/image";
import { AiQuotaDeniedError } from "@/lib/ai/quota";
import { TranscriptionError } from "@/lib/ai/transcription";
import { getEntitlements, type Entitlements } from "@/lib/billing/entitlements";
import { FEATURE_LABELS } from "@/lib/billing/features";
import type { Database } from "@/lib/db/database.types";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { KIND_FEATURE, type AiApiErrorBody, type AiKind, type AiQuotaDto } from "../schemas";
import { hasAiConsent } from "./availability";

type Client = SupabaseClient<Database>;

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export function aiJsonError(
  status: number,
  code: string,
  message: string,
  extra: { quota?: AiQuotaDto } = {},
  headers: Record<string, string> = {},
): NextResponse<AiApiErrorBody> {
  return NextResponse.json({ error: { code, message, ...extra } }, { status, headers: { ...NO_STORE, ...headers } });
}

export function aiJsonOk<T>(body: T): NextResponse<T> {
  return NextResponse.json(body, { status: 200, headers: NO_STORE });
}

export type AiGuardOk = { ok: true; supabase: Client; user: User; entitlements: Entitlements };
export type AiGuardResult = AiGuardOk | { ok: false; response: NextResponse };

/**
 * Guarda común de /api/ai/*: sesión (401) → plan con la función (403 PREMIUM_REQUIRED) →
 * consentimiento ai_processing VIGENTE (403 CONSENT_REQUIRED) → proveedor configurado (503).
 * Ninguna guarda consume cupo.
 */
export async function guardAiRoute(kind: AiKind, needs: "ai" | "transcription" = "ai"): Promise<AiGuardResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, response: aiJsonError(503, "NOT_CONFIGURED", "La base de datos no está configurada.") };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ok: false, response: aiJsonError(401, "UNAUTHORIZED", "Inicia sesión para usar la IA.") };
  }
  const user = data.user;
  const entitlements = await getEntitlements();
  const feature = KIND_FEATURE[kind];
  if (!entitlements.features.has(feature)) {
    return {
      ok: false,
      response: aiJsonError(403, "PREMIUM_REQUIRED", `${FEATURE_LABELS[feature]} es parte de Premium.`),
    };
  }
  let consent: boolean;
  try {
    consent = await hasAiConsent(supabase, user.id);
  } catch {
    return { ok: false, response: aiJsonError(500, "UNEXPECTED", "No pudimos verificar tus permisos. Inténtalo de nuevo.") };
  }
  if (!consent) {
    return {
      ok: false,
      response: aiJsonError(
        403,
        "CONSENT_REQUIRED",
        "Para usar la IA necesitas autorizar el análisis con IA: tus fotos, audios o textos de comidas se envían a un proveedor externo.",
      ),
    };
  }
  const config = aiConfig();
  if (needs === "ai" && !config.configured) {
    return { ok: false, response: aiJsonError(503, "AI_NOT_CONFIGURED", new AiError("AI_NOT_CONFIGURED").message) };
  }
  if (needs === "transcription" && !config.transcription.configured) {
    return {
      ok: false,
      response: aiJsonError(
        503,
        "TRANSCRIPTION_NOT_CONFIGURED",
        "La transcripción de audio en el servidor está pendiente de configurar. Usa el dictado de tu navegador o escribe lo que comiste.",
      ),
    };
  }
  return { ok: true, supabase, user, entitlements };
}

/** Límite por persona con `check_rate_limit` (independiente del cupo mensual). */
export async function enforceAiRateLimit(supabase: Client, bucket: string, maxHits: number, windowSeconds: number): Promise<NextResponse | null> {
  const { data: allowed, error } = await supabase.rpc("check_rate_limit", {
    bucket,
    max_hits: maxHits,
    window_seconds: windowSeconds,
  });
  if (error) return aiJsonError(500, "RATE_LIMIT_ERROR", "No pudimos procesar la solicitud. Inténtalo de nuevo.");
  if (!allowed) {
    return aiJsonError(429, "RATE_LIMITED", "Hiciste muchas solicitudes seguidas. Espera un momento y vuelve a intentarlo.", {}, {
      "Retry-After": String(windowSeconds),
    });
  }
  return null;
}

export const AI_RATE_LIMITS = {
  photo: { bucket: "ai_photo", max: 6, window: 60 },
  text: { bucket: "ai_text", max: 12, window: 60 },
  voice: { bucket: "ai_voice", max: 12, window: 60 },
  chat: { bucket: "ai_chat", max: 20, window: 60 },
} as const satisfies Record<AiKind, { bucket: string; max: number; window: number }>;

/** Respuesta JSON para cualquier error del flujo de IA (sin filtrar detalles internos). */
export function aiErrorResponse(error: unknown): NextResponse {
  if (error instanceof AiQuotaDeniedError) {
    const quota = { used: error.reservation.used, limit: error.reservation.limit };
    if (error.reservation.limit === 0) {
      return aiJsonError(403, "PREMIUM_REQUIRED", "Tu plan no incluye esta función de IA.", { quota });
    }
    return aiJsonError(429, "AI_QUOTA_EXCEEDED", error.message, { quota });
  }
  if (isAiError(error)) return aiJsonError(error.status, error.code, error.message);
  if (error instanceof ImageInputError) {
    const status = error.code === "IMAGE_TOO_LARGE" ? 413 : error.code === "IMAGE_TYPE" ? 415 : 400;
    return aiJsonError(status, error.code, error.message);
  }
  if (error instanceof TranscriptionError) return aiJsonError(error.status, error.code, error.message);
  console.error("[ai] error inesperado en la ruta", { name: error instanceof Error ? error.name : typeof error });
  return aiJsonError(500, "UNEXPECTED", "Algo salió mal. No se registró nada; inténtalo de nuevo.");
}

/** Lee el cuerpo JSON sin lanzar (null si no es JSON válido). */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
