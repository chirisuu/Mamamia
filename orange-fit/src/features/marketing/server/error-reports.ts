import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { publicEnv } from "@/lib/env";
import type { ErrorReportRow } from "../error-report";

export type InsertErrorReportResult = { ok: true } | { ok: false; status: 429 | 500; code: string };

/**
 * Cliente anónimo (sin sesión) que reenvía la IP real del visitante: el límite de la BD para anónimos
 * (20/h) se cuenta por `x-forwarded-for`, y sin esto todos compartirían la IP del servidor de Next.
 */
export function createAnonReporterClient(clientIp: string | null): SupabaseClient<Database> {
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL || !publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase no está configurado.");
  }
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: clientIp ? { "x-forwarded-for": clientIp } : {} },
  });
}

/**
 * Inserta el reporte con RLS (anon: `user_id` null; con sesión: el propio). Sin `.select()`: solo el
 * staff puede leer `error_reports`. La BD responde PT429 (HTTP 429) al pasar el límite.
 */
export async function insertErrorReport(supabase: SupabaseClient<Database>, row: ErrorReportRow): Promise<InsertErrorReportResult> {
  const { error, status } = await supabase.from("error_reports").insert({ ...row, status: "new" });
  if (!error) return { ok: true };
  if (status === 429 || error.code === "PT429") return { ok: false, status: 429, code: "RATE_LIMITED" };
  return { ok: false, status: 500, code: error.code || "INSERT_FAILED" };
}
