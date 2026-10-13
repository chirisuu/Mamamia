import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Client = SupabaseClient<Database>;

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

/** Error JSON `{ error: { code, message } }` con el status correcto (docs/CONVENTIONS.md). */
export function apiError(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): NextResponse {
  return NextResponse.json({ error: { code, message, ...extra } }, { status, headers: { ...NO_STORE, ...headers } });
}

export function apiOk<T>(body: T): NextResponse {
  return NextResponse.json(body, { status: 200, headers: NO_STORE });
}

/**
 * Equivalente a `requireUser()` para route handlers: en vez de redirigir responde 401 JSON.
 * Devuelve el cliente con la sesión (RLS aplica) y el usuario validado contra Auth.
 */
export async function requireApiUser(
  unauthorizedMessage = "Inicia sesión para continuar.",
): Promise<{ ok: true; supabase: Client; user: User } | { ok: false; response: NextResponse }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, response: apiError(503, "NOT_CONFIGURED", "La base de datos no está configurada.") };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, response: apiError(401, "UNAUTHORIZED", unauthorizedMessage) };
  return { ok: true, supabase, user: data.user };
}

/**
 * Límite por usuario con `check_rate_limit` (clave = bucket + usuario). null si puede seguir;
 * si no, la respuesta 429 (o 500 si el contador falló: no se deja pasar sin control).
 */
export async function enforceRateLimit(supabase: Client, bucket: string, maxHits: number, windowSeconds: number): Promise<NextResponse | null> {
  const { data: allowed, error } = await supabase.rpc("check_rate_limit", {
    bucket,
    max_hits: maxHits,
    window_seconds: windowSeconds,
  });
  if (error) return apiError(500, "RATE_LIMIT_ERROR", "No pudimos procesar la consulta. Inténtalo de nuevo.");
  if (!allowed) {
    return apiError(429, "RATE_LIMITED", "Hiciste muchas consultas seguidas. Espera unos segundos y vuelve a intentarlo.", {}, {
      "Retry-After": String(windowSeconds),
    });
  }
  return null;
}

/** Límites de las rutas de alimentos (por usuario y minuto). */
export const FOOD_RATE_LIMITS = {
  search: { bucket: "foods_search", max: 60, window: 60 },
  detail: { bucket: "foods_detail", max: 120, window: 60 },
  barcode: { bucket: "foods_barcode", max: 30, window: 60 },
} as const;
