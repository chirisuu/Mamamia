import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Client = SupabaseClient<Database>;

export class ChallengeOpError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "ALREADY_ACTIVE" | "DB_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "ChallengeOpError";
  }
}

/** Unirse a un reto activo desde hoy. Un mismo reto no puede estar activo dos veces (índice único). */
export async function joinChallenge(supabase: Client, userId: string, challengeId: string, today: string): Promise<{ id: string }> {
  const { data: challenge, error: readError } = await supabase
    .from("challenges")
    .select("id")
    .eq("id", challengeId)
    .eq("is_active", true)
    .maybeSingle();
  if (readError) throw new ChallengeOpError("DB_ERROR", "No pudimos leer el reto.");
  if (!challenge) throw new ChallengeOpError("NOT_FOUND", "Ese reto ya no está disponible.");
  const { data, error } = await supabase
    .from("user_challenges")
    .insert({ user_id: userId, challenge_id: challengeId, started_on: today, status: "active", progress: {} })
    .select("id")
    .single();
  if (error?.code === "23505") throw new ChallengeOpError("ALREADY_ACTIVE", "Ya estás participando en este reto.");
  if (error || !data) throw new ChallengeOpError("DB_ERROR", "No pudimos unirte al reto.");
  return { id: data.id };
}

/** Dejar un reto (sin castigo: el avance queda guardado en el historial y se puede retomar). */
export async function abandonChallenge(supabase: Client, userId: string, userChallengeId: string): Promise<void> {
  const { data, error } = await supabase
    .from("user_challenges")
    .update({ status: "abandoned" })
    .eq("id", userChallengeId)
    .eq("user_id", userId)
    .eq("status", "active")
    .select("id");
  if (error) throw new ChallengeOpError("DB_ERROR", "No pudimos actualizar el reto.");
  if (!data?.length) throw new ChallengeOpError("NOT_FOUND", "Ese reto ya no está activo.");
}
