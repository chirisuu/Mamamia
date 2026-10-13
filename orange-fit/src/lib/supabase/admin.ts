import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";

/**
 * Cliente con service role: SE SALTA RLS. Solo para tareas de servidor que lo
 * necesitan de verdad (webhooks de pago, eliminación de cuenta, métricas admin
 * ya autorizadas). Nunca lo uses con datos que vengan sin validar del cliente.
 */
export function createSupabaseAdminClient() {
  const key = serverEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL || !key) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY: esta operación de servidor está pendiente de configurar.");
  }
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
