import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { CONSENT_VERSION, isConsentActive, latestConsents, type ConsentRow } from "@/features/auth/consents";
import {
  buildPhotoPath,
  isOwnPhotoPath,
  parsePhotoPath,
  PHOTO_BUCKET,
  PHOTO_SIGNED_URL_SECONDS,
  type PhotoExtension,
  type PhotoPose,
} from "../lib/photo-path";
import { assertLoggableDate, ProgressOpError } from "./progress";

/**
 * Fotos de progreso: bucket PRIVADO `progress-photos`, ruta {user_id}/{fecha}-{pose}-{aleatorio}.webp.
 * - Requieren el consentimiento vigente `progress_photos` (se revisa al preparar y al guardar).
 * - El navegador sube el archivo con su propia sesión (RLS de Storage: solo su carpeta); el servidor
 *   decide la ruta, valida que el objeto exista y guarda la fila.
 * - Se leen solo con URLs firmadas generadas en el servidor (1 h). Nunca hay URLs públicas.
 */
type Client = SupabaseClient<Database>;

/** Tope por día para que un error de la UI no llene el almacenamiento. */
export const MAX_PHOTOS_PER_DAY = 8;

export type PhotoOpCode = "NO_CONSENT" | "INVALID_PATH" | "NOT_UPLOADED" | "LIMIT_REACHED";

export class PhotoOpError extends Error {
  constructor(
    readonly code: PhotoOpCode,
    message: string,
  ) {
    super(message);
    this.name = "PhotoOpError";
  }
}

/** ¿Tiene vigente el consentimiento de fotos de progreso? (fila más reciente por tipo). */
export async function hasPhotoConsent(supabase: Client, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("consents")
    .select("consent_type, granted, granted_at, revoked_at, created_at, version")
    .eq("user_id", userId)
    .eq("consent_type", "progress_photos");
  if (error) throw new ProgressOpError("DB_ERROR", "No pudimos revisar tus permisos.");
  return isConsentActive(latestConsents((data ?? []) as ConsentRow[]), "progress_photos");
}

/** Registra el consentimiento expreso (nueva fila del historial). */
export async function grantPhotoConsent(supabase: Client, userId: string): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase.from("consents").insert({
    user_id: userId,
    consent_type: "progress_photos",
    version: CONSENT_VERSION,
    granted: true,
    granted_at: nowIso,
    revoked_at: null,
  });
  if (error) throw new ProgressOpError("DB_ERROR", "No pudimos guardar tu permiso. Inténtalo de nuevo.");
}

async function assertConsent(supabase: Client, userId: string): Promise<void> {
  if (!(await hasPhotoConsent(supabase, userId))) {
    throw new PhotoOpError("NO_CONSENT", "Para guardar fotos de progreso primero necesitamos tu permiso.");
  }
}

async function countForDate(supabase: Client, userId: string, localDate: string): Promise<number> {
  const { count, error } = await supabase
    .from("progress_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("local_date", localDate);
  if (error) throw new ProgressOpError("DB_ERROR", "No pudimos revisar tus fotos.");
  return count ?? 0;
}

/** Token aleatorio del nombre del archivo (16 caracteres [a-z0-9]). */
export function serverFileToken(length = 16): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(randomBytes(length), (b) => alphabet[b % alphabet.length]).join("");
}

/**
 * Paso 1: revisa permiso, fecha y tope del día y devuelve la ruta donde el navegador debe subir.
 * La ruta la decide el servidor (no el cliente).
 */
export async function preparePhotoUpload(
  supabase: Client,
  userId: string,
  input: { localDate: string; pose: PhotoPose; ext: PhotoExtension },
  today: string,
): Promise<{ path: string }> {
  assertLoggableDate(input.localDate, today);
  await assertConsent(supabase, userId);
  if ((await countForDate(supabase, userId, input.localDate)) >= MAX_PHOTOS_PER_DAY) {
    throw new PhotoOpError("LIMIT_REACHED", `Puedes guardar hasta ${MAX_PHOTOS_PER_DAY} fotos por día.`);
  }
  return { path: buildPhotoPath(userId, input.localDate, input.pose, serverFileToken(), input.ext) };
}

async function objectExists(supabase: Client, path: string): Promise<boolean> {
  const parsed = parsePhotoPath(path);
  if (!parsed) return false;
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).list(parsed.userId, { search: parsed.fileName, limit: 5 });
  if (error) throw new ProgressOpError("DB_ERROR", "No pudimos revisar la foto subida.");
  return (data ?? []).some((o) => o.name === parsed.fileName);
}

export type SavedPhoto = { id: string; localDate: string; pose: PhotoPose };

/**
 * Paso 2 (tras subir): valida que la ruta sea del usuario y coincida con fecha y pose, que el
 * archivo exista y el permiso siga vigente; guarda la fila. Si no se puede guardar, borra el archivo.
 */
export async function savePhoto(
  supabase: Client,
  userId: string,
  input: { path: string; localDate: string; pose: PhotoPose; note: string | null },
  today: string,
): Promise<SavedPhoto> {
  assertLoggableDate(input.localDate, today);
  if (!isOwnPhotoPath(input.path, userId, input.localDate, input.pose)) {
    throw new PhotoOpError("INVALID_PATH", "La foto no corresponde a tu cuenta o a los datos elegidos.");
  }
  const removeUploaded = () => supabase.storage.from(PHOTO_BUCKET).remove([input.path]).then(() => undefined, () => undefined);
  try {
    await assertConsent(supabase, userId);
  } catch (error) {
    await removeUploaded();
    throw error;
  }
  if (!(await objectExists(supabase, input.path))) {
    throw new PhotoOpError("NOT_UPLOADED", "La foto no terminó de subirse. Inténtalo de nuevo.");
  }
  const { data: dup, error: dupError } = await supabase
    .from("progress_photos")
    .select("id, local_date, pose")
    .eq("user_id", userId)
    .eq("storage_path", input.path)
    .maybeSingle();
  if (dupError) throw new ProgressOpError("DB_ERROR", "No pudimos guardar la foto.");
  if (dup) return { id: dup.id, localDate: dup.local_date, pose: dup.pose };

  const { data, error } = await supabase
    .from("progress_photos")
    .insert({ user_id: userId, local_date: input.localDate, pose: input.pose, storage_path: input.path, note: input.note || null })
    .select("id, local_date, pose")
    .single();
  if (error || !data) {
    await removeUploaded();
    throw new ProgressOpError("DB_ERROR", "No pudimos guardar la foto.");
  }
  return { id: data.id, localDate: data.local_date, pose: data.pose };
}

export type ProgressPhoto = {
  id: string;
  localDate: string;
  pose: PhotoPose;
  note: string | null;
  createdAt: string;
  /** URL firmada (1 h). null si no se pudo firmar (p. ej. el archivo ya no existe). */
  url: string | null;
};

/** Fotos propias, más recientes primero, con URL firmada de 1 h generada aquí (servidor). */
export async function listPhotos(supabase: Client, userId: string, options: { limit?: number } = {}): Promise<ProgressPhoto[]> {
  const { data, error } = await supabase
    .from("progress_photos")
    .select("id, local_date, pose, note, created_at, storage_path")
    .eq("user_id", userId)
    .order("local_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 120);
  if (error) throw new ProgressOpError("DB_ERROR", "No pudimos cargar tus fotos.");
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const { data: signed, error: signError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      PHOTO_SIGNED_URL_SECONDS,
    );
  if (signError) throw new ProgressOpError("DB_ERROR", "No pudimos preparar tus fotos.");
  const byPath = new Map((signed ?? []).map((s) => [s.path, s.error ? null : s.signedUrl]));
  return rows.map((r) => ({
    id: r.id,
    localDate: r.local_date,
    pose: r.pose,
    note: r.note,
    createdAt: r.created_at,
    url: byPath.get(r.storage_path) ?? null,
  }));
}

/** Borra el archivo y la fila. Si el archivo ya no estaba, igual borra la fila. */
export async function deletePhoto(supabase: Client, userId: string, id: string): Promise<void> {
  const { data: row, error } = await supabase
    .from("progress_photos")
    .select("id, storage_path")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new ProgressOpError("DB_ERROR", "No pudimos borrar la foto.");
  if (!row) throw new ProgressOpError("NOT_FOUND", "Esa foto ya no existe.");
  if (isOwnPhotoPath(row.storage_path, userId)) {
    const { error: removeError } = await supabase.storage.from(PHOTO_BUCKET).remove([row.storage_path]);
    if (removeError) throw new ProgressOpError("DB_ERROR", "No pudimos borrar el archivo de la foto. Inténtalo de nuevo.");
  }
  const { error: deleteError } = await supabase.from("progress_photos").delete().eq("user_id", userId).eq("id", id);
  if (deleteError) throw new ProgressOpError("DB_ERROR", "No pudimos borrar la foto.");
}
