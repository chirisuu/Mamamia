import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";
import { isSameOrigin } from "@/features/auth/server/same-origin";
import { deleteAccount } from "@/features/profile/server/delete-account";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ confirm: z.literal("ELIMINAR") });

const json = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Elimina la cuenta de quien tiene la sesión (body { confirm: "ELIMINAR" }). Necesita la clave de
 * service role: sin ella responde 503 y no borra nada.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json(403, "FORBIDDEN", "Origen no permitido.");
  if (!isSupabaseConfigured()) return json(503, "NOT_CONFIGURED", "La base de datos no está configurada.");

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return json(401, "UNAUTHORIZED", "Inicia sesión para eliminar tu cuenta.");

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return json(400, "CONFIRMATION_REQUIRED", 'Escribe "ELIMINAR" para confirmar.');

  if (!serverEnv().SUPABASE_SERVICE_ROLE_KEY) {
    return json(
      503,
      "NOT_CONFIGURED",
      "La eliminación de cuentas está pendiente de configurar en el servidor. Escríbenos y la haremos por ti.",
    );
  }

  const outcome = await deleteAccount(createSupabaseAdminClient(), user.id);
  if (!outcome.ok) {
    if (outcome.status === 500) console.error("account_delete_failed", { code: outcome.code });
    return json(outcome.status, outcome.code, outcome.message);
  }

  // La cuenta ya no existe: solo borramos las cookies de este navegador.
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.json({ ok: true, redirectTo: "/" }, { headers: { "Cache-Control": "no-store" } });
}
