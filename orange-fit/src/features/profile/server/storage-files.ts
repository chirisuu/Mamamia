import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

/** Buckets con archivos del usuario en `{user_id}/…` (ver migración 011). */
export const USER_BUCKETS = ["progress-photos", "meal-photos", "recipe-images"] as const;
export type UserBucket = (typeof USER_BUCKETS)[number];

const PAGE = 1000;
const MAX_DEPTH = 6;
const MAX_FILES = 20_000;

/**
 * Lista recursivamente los archivos bajo `prefix` (sin barra final). Storage devuelve las carpetas
 * con `id = null`. Lanza si la API de Storage falla: quien llama decide cómo informarlo.
 */
export async function listFilesRecursive(client: SupabaseClient<Database>, bucket: string, prefix: string): Promise<string[]> {
  const files: string[] = [];
  const walk = async (path: string, depth: number): Promise<void> => {
    if (depth > MAX_DEPTH) return;
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await client.storage.from(bucket).list(path, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw new Error(`storage_list_failed:${bucket}`);
      if (!data || data.length === 0) break;
      for (const item of data) {
        const full = `${path}/${item.name}`;
        if (item.id === null) await walk(full, depth + 1);
        else files.push(full);
        if (files.length >= MAX_FILES) return;
      }
      if (data.length < PAGE) break;
    }
  };
  await walk(prefix, 0);
  return files;
}

/** Borra todos los archivos de `{userId}/` en los buckets del usuario. Requiere el cliente admin. */
export async function removeUserFiles(admin: SupabaseClient<Database>, userId: string): Promise<Record<UserBucket, number>> {
  const removed = { "progress-photos": 0, "meal-photos": 0, "recipe-images": 0 } as Record<UserBucket, number>;
  for (const bucket of USER_BUCKETS) {
    const paths = await listFilesRecursive(admin, bucket, userId);
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const { error } = await admin.storage.from(bucket).remove(chunk);
      if (error) throw new Error(`storage_remove_failed:${bucket}`);
      removed[bucket] += chunk.length;
    }
  }
  return removed;
}
