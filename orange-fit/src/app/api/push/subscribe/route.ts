import { z } from "zod";
import { apiError, apiOk } from "@/features/notifications/server/http";
import { isPushConfigured } from "@/lib/notifications/push";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Forma de `PushSubscription.toJSON()` en el navegador. */
const subscribeSchema = z.object({
  endpoint: z
    .string()
    .max(2000)
    .refine((v) => v.startsWith("https://"), "El endpoint debe ser https."),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});

const unsubscribeSchema = z.object({ endpoint: z.string().min(1).max(2000) });

async function sessionClient() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * POST /api/push/subscribe — guarda la suscripción Web Push del navegador para el usuario actual
 * (rpc register_push_subscription: si el endpoint era de otra cuenta, pasa a esta).
 * 401 sin sesión · 400 datos inválidos · 429 demasiados intentos · 503 push no configurado.
 */
export async function POST(request: Request) {
  const session = await sessionClient();
  if (!session) return apiError(401, "UNAUTHORIZED", "Inicia sesión para activar las notificaciones.");
  if (!isPushConfigured()) {
    return apiError(503, "NOT_CONFIGURED", "Las notificaciones push están pendientes de configurar en este servidor.");
  }
  const parsed = subscribeSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(400, "VALIDATION", "La suscripción del navegador no es válida.");

  const { data: allowed, error: rateError } = await session.supabase.rpc("check_rate_limit", {
    bucket: "push_subscribe",
    max_hits: 20,
    window_seconds: 3600,
  });
  if (rateError) return apiError(500, "RATE_LIMIT_FAILED", "No se pudo validar la solicitud. Inténtalo de nuevo.");
  if (allowed === false) return apiError(429, "RATE_LIMITED", "Demasiados intentos. Prueba de nuevo en un rato.");

  const { data, error } = await session.supabase.rpc("register_push_subscription", {
    sub_endpoint: parsed.data.endpoint,
    sub_p256dh: parsed.data.keys.p256dh,
    sub_auth: parsed.data.keys.auth,
  });
  if (error) {
    if (error.code === "22023") return apiError(400, "VALIDATION", "La suscripción del navegador no es válida.");
    console.error("[push/subscribe] register failed", { code: error.code });
    return apiError(500, "DB_ERROR", "No se pudo guardar la suscripción.");
  }
  return apiOk({ id: data }, 201);
}

/** DELETE /api/push/subscribe — quita la suscripción de este navegador ({ endpoint }). */
export async function DELETE(request: Request) {
  const session = await sessionClient();
  if (!session) return apiError(401, "UNAUTHORIZED", "Inicia sesión para cambiar las notificaciones.");
  const parsed = unsubscribeSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(400, "VALIDATION", "Falta el endpoint de la suscripción.");
  const { data, error } = await session.supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", session.user.id)
    .eq("endpoint", parsed.data.endpoint)
    .select("id");
  if (error) {
    console.error("[push/subscribe] delete failed", { code: error.code });
    return apiError(500, "DB_ERROR", "No se pudo quitar la suscripción.");
  }
  return apiOk({ removed: data?.length ?? 0 });
}
