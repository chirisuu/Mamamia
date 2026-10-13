import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { parseSignupConsents } from "@/features/auth/consents";

/**
 * Al registrarse aún no hay sesión, así que la aceptación de términos y privacidad viaja en
 * `user_metadata`. Cuando la persona confirma su correo (ya con sesión), la pasamos a `consents`.
 * Idempotente: si ya hay una fila de términos, no hace nada.
 */
export async function recordSignupConsents(supabase: SupabaseClient<Database>, user: User): Promise<void> {
  const meta = parseSignupConsents(user.user_metadata);
  if (!meta) return;

  const { data: existing, error: readError } = await supabase
    .from("consents")
    .select("id")
    .eq("user_id", user.id)
    .eq("consent_type", "terms")
    .limit(1);
  if (readError || (existing && existing.length > 0)) return;

  // La fecha de aceptación se respeta solo si es coherente (entre la creación de la cuenta y ahora).
  const accepted = Date.parse(meta.accepted_at);
  const created = Date.parse(user.created_at);
  const now = Date.now();
  const grantedAt =
    Number.isFinite(accepted) && accepted <= now && (!Number.isFinite(created) || accepted >= created - 60 * 60 * 1000)
      ? new Date(accepted).toISOString()
      : new Date(now).toISOString();

  await supabase.from("consents").insert([
    { user_id: user.id, consent_type: "terms", version: meta.version, granted: true, granted_at: grantedAt },
    { user_id: user.id, consent_type: "privacy", version: meta.version, granted: true, granted_at: grantedAt },
  ]);
}
