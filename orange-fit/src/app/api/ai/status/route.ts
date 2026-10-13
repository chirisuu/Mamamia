import { getAiStatus } from "@/features/ai/server/availability";
import { aiJsonError, aiJsonOk } from "@/features/ai/server/http";
import { getUserTimezone } from "@/features/ai/server/profile";
import type { AiStatusResponse } from "@/features/ai/schemas";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/ai/status → configuración (IA y transcripción), consentimiento vigente, plan y cupo
 * usado/límite del mes por tipo. Solo lectura: no consume cupo.
 */
export async function GET() {
  if (!isSupabaseConfigured()) return aiJsonError(503, "NOT_CONFIGURED", "La base de datos no está configurada.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return aiJsonError(401, "UNAUTHORIZED", "Inicia sesión para continuar.");
  try {
    const timezone = await getUserTimezone(supabase, data.user.id);
    return aiJsonOk<AiStatusResponse>(await getAiStatus(supabase, data.user.id, timezone));
  } catch {
    return aiJsonError(500, "UNEXPECTED", "No pudimos leer el estado de la IA. Inténtalo de nuevo.");
  }
}
