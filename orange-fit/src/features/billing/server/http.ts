import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { isSupabaseConfigured } from "@/lib/env";
import { billingError } from "@/lib/billing/http";
import { isBillingError } from "@/lib/billing/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/features/auth/server/same-origin";

export type ApiSession = { supabase: SupabaseClient<Database>; user: User };

/**
 * Sesión para las rutas de pagos de la persona: comprueba origen (los route handlers no tienen la
 * protección CSRF de las server actions) y sesión. Devuelve la respuesta de error si algo falla.
 */
export async function getBillingSession(request: Request): Promise<ApiSession | Response> {
  if (!isSameOrigin(request)) return billingError(403, "FORBIDDEN", "Origen no permitido.");
  if (!isSupabaseConfigured()) return billingError(503, "NOT_CONFIGURED", "La base de datos no está configurada.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return billingError(401, "UNAUTHORIZED", "Inicia sesión para continuar.");
  return { supabase, user: data.user };
}

/** Lee el cuerpo JSON (null si no es JSON válido). */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** `BillingError` → su status y código; cualquier otra cosa → 500 genérico (con log sin datos personales). */
export function billingErrorResponse(error: unknown, tag: string): Response {
  if (isBillingError(error)) return billingError(error.status, error.code, error.message);
  console.error(tag, { reason: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
  return billingError(500, "INTERNAL", "Algo salió mal de nuestro lado. Inténtalo de nuevo en un momento.");
}

/** Límite por persona con `check_rate_limit`: true = dentro del límite, false = excedido, null = no se pudo comprobar. */
export async function withinRateLimit(
  supabase: SupabaseClient<Database>,
  bucket: string,
  maxHits: number,
  windowSeconds: number,
): Promise<boolean | null> {
  const { data, error } = await supabase.rpc("check_rate_limit", { bucket, max_hits: maxHits, window_seconds: windowSeconds });
  if (error) {
    console.error("billing_rate_limit_failed", { bucket, code: error.code });
    return null;
  }
  return data !== false;
}
