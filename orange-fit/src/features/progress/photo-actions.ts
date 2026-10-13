"use server";

import { revalidatePath } from "next/cache";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { getProfile, requireUser } from "@/lib/auth/session";
import { DEFAULT_TIMEZONE, todayInTz } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { photoIdSchema, preparePhotoSchema, savePhotoSchema, type PreparePhotoInput, type SavePhotoInput } from "./photo-schemas";
import { deletePhoto, grantPhotoConsent, PhotoOpError, preparePhotoUpload, savePhoto, type SavedPhoto } from "./server/photos";
import { ProgressOpError } from "./server/progress";

const PHOTOS_PATH = "/app/progreso/fotos";

function toFail(error: unknown): ActionResult<never> {
  if (error instanceof PhotoOpError || error instanceof ProgressOpError) return fail(error.code, error.message);
  console.error("[progress-photos] action failed");
  return fail("UNKNOWN", "Algo salió mal. Inténtalo de nuevo.");
}

async function userToday(): Promise<string> {
  const profile = await getProfile();
  return todayInTz(profile?.timezone || DEFAULT_TIMEZONE);
}

/** Consentimiento expreso para guardar fotos de progreso (se puede retirar en Privacidad). */
export async function grantPhotoConsentAction(): Promise<ActionResult<null>> {
  const user = await requireUser(PHOTOS_PATH);
  try {
    const supabase = await createSupabaseServerClient();
    await grantPhotoConsent(supabase, user.id);
  } catch (error) {
    return toFail(error);
  }
  revalidatePath(PHOTOS_PATH);
  revalidatePath("/app/perfil/privacidad");
  return ok(null);
}

/** Devuelve la ruta donde subir la foto (con permiso vigente y dentro del tope diario). */
export async function preparePhotoUploadAction(input: PreparePhotoInput): Promise<ActionResult<{ path: string }>> {
  const user = await requireUser(PHOTOS_PATH);
  const parsed = preparePhotoSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    return ok(await preparePhotoUpload(supabase, user.id, parsed.data, await userToday()));
  } catch (error) {
    return toFail(error);
  }
}

/** Guarda la fila de una foto ya subida a su carpeta privada. */
export async function savePhotoAction(input: SavePhotoInput): Promise<ActionResult<SavedPhoto>> {
  const user = await requireUser(PHOTOS_PATH);
  const parsed = savePhotoSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    const saved = await savePhoto(supabase, user.id, { ...parsed.data, note: parsed.data.note || null }, await userToday());
    revalidatePath(PHOTOS_PATH);
    return ok(saved);
  } catch (error) {
    return toFail(error);
  }
}

/** Borra el archivo del bucket y su fila. */
export async function deletePhotoAction(id: string): Promise<ActionResult<null>> {
  const user = await requireUser(PHOTOS_PATH);
  const parsed = photoIdSchema.safeParse(id);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    await deletePhoto(supabase, user.id, parsed.data);
  } catch (error) {
    return toFail(error);
  }
  revalidatePath(PHOTOS_PATH);
  return ok(null);
}
