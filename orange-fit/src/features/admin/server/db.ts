import "server-only";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/database.types";

export type Db = SupabaseClient<Database>;

/** Error de una operación admin con código y mensaje en español para mostrar al staff. */
export class AdminOpError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AdminOpError";
  }
}

/**
 * RPC de funciones que aún no están en `database.types.ts` (migración 20261013100801, los tipos
 * no se regeneran durante el trabajo en paralelo). Se llama como método para conservar `this`.
 */
export async function rpcUntyped<T>(supabase: Db, fn: string, args?: Record<string, unknown>): Promise<{ data: T | null; error: PostgrestError | null }> {
  const client = supabase as unknown as {
    rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: PostgrestError | null }>;
  };
  const { data, error } = await client.rpc(fn, args);
  return { data: (data as T | null) ?? null, error };
}

/** Traduce errores de Postgres/PostgREST a mensajes para el staff (sin filtrar detalles internos). */
export function dbError(error: PostgrestError | { code?: string; message?: string } | null, fallback: string): AdminOpError {
  const code = error?.code ?? "";
  if (code === "42501") return new AdminOpError("FORBIDDEN", "No tienes permiso para esta acción.");
  if (code === "23505") return new AdminOpError("CONFLICT", "Ya existe un registro con esos datos.");
  if (code === "23514") return new AdminOpError("CHECK", error?.message && /p[uú]blic/i.test(error.message) ? error.message : "Algún valor no cumple las reglas de la base.");
  if (code === "23503") return new AdminOpError("IN_USE", "El registro está en uso por otros datos.");
  if (code === "P0002") return new AdminOpError("NOT_FOUND", error?.message ?? "No existe.");
  if (code === "22023") return new AdminOpError("INVALID", error?.message ?? "Datos inválidos.");
  if (code === "PGRST116") return new AdminOpError("NOT_FOUND", "No existe o no tienes acceso.");
  return new AdminOpError("DB_ERROR", fallback);
}

export type AuditEntry = {
  action: string;
  targetTable?: string | null;
  targetId?: string | null;
  /** Solo ids, códigos y conteos: nunca datos de salud ni contenido de usuarios. */
  metadata?: Record<string, Json | undefined>;
};

/**
 * Registra la acción en `admin_audit_logs` vía `log_admin_action` (única vía de escritura).
 * Se llama después de que la mutación salió bien; si la auditoría falla, se informa al staff.
 */
export async function logAdminAction(supabase: Db, entry: AuditEntry): Promise<void> {
  const metadata = Object.fromEntries(Object.entries(entry.metadata ?? {}).filter(([, v]) => v !== undefined)) as Json;
  const { error } = await supabase.rpc("log_admin_action", {
    action: entry.action,
    target_table: entry.targetTable ?? undefined,
    target_id: entry.targetId ?? undefined,
    metadata,
  });
  if (error) {
    console.error("[admin] auditoría falló", { action: entry.action, code: error.code });
    throw new AdminOpError("AUDIT_FAILED", "El cambio se guardó, pero no se pudo registrar en la auditoría. Avisa a un administrador.");
  }
}
