import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { removeUserFiles, type UserBucket } from "./storage-files";

type Client = SupabaseClient<Database>;

export type DeleteAccountOutcome =
  | { ok: true; filesRemoved: Record<UserBucket, number> }
  | { ok: false; status: 409 | 500; code: string; message: string };

/** Suscripción que seguiría cobrando si borráramos la cuenta sin cancelarla en el proveedor. */
export async function hasBillableSubscription(admin: Client, userId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("subscriptions")
    .select("status, cancel_at_period_end")
    .eq("user_id", userId)
    .in("status", ["trialing", "active", "past_due"]);
  if (error) throw new Error("subscriptions_read_failed");
  return (data ?? []).some((s) => !s.cancel_at_period_end);
}

/**
 * Elimina la cuenta con el cliente admin: 1) archivos en Storage ({uid}/… de cada bucket, que no se
 * borran solos), 2) el usuario de Auth (todo lo demás cae en cascada y los triggers limpian recetas y
 * alimentos propios), 3) registro de auditoría con metadatos mínimos (sin correo ni datos de salud).
 */
export async function deleteAccount(admin: Client, userId: string): Promise<DeleteAccountOutcome> {
  if (await hasBillableSubscription(admin, userId)) {
    return {
      ok: false,
      status: 409,
      code: "ACTIVE_SUBSCRIPTION",
      message:
        "Tienes una suscripción activa. Cancélala primero para que no se te siga cobrando y luego elimina tu cuenta.",
    };
  }

  let filesRemoved: Record<UserBucket, number>;
  try {
    filesRemoved = await removeUserFiles(admin, userId);
  } catch {
    return { ok: false, status: 500, code: "STORAGE_ERROR", message: "No pudimos borrar tus archivos. No se eliminó nada más; inténtalo de nuevo." };
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return { ok: false, status: 500, code: "DELETE_FAILED", message: "No pudimos eliminar tu cuenta. Inténtalo de nuevo en un momento." };
  }

  // La auditoría no debe impedir la eliminación ya hecha: si falla, solo se pierde el registro.
  await admin
    .rpc("log_admin_action", {
      action: "account.deleted_by_user",
      target_table: "auth.users",
      target_id: userId,
      metadata: { files_removed: filesRemoved },
    })
    .then(
      () => undefined,
      () => undefined,
    );

  return { ok: true, filesRemoved };
}
