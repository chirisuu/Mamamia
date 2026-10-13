/**
 * Rutas de las fotos de progreso en el bucket privado `progress-photos` (puro).
 * Formato: {user_id}/{AAAA-MM-DD}-{pose}-{aleatorio}.webp (o .jpg si el navegador no codifica WebP).
 * La política de Storage exige que la primera carpeta sea el user_id del dueño.
 */
import { isIsoDate } from "@/lib/dates";

export const PHOTO_POSES = ["front", "side", "back", "other"] as const;
export type PhotoPose = (typeof PHOTO_POSES)[number];
export const PHOTO_POSE_LABELS: Record<PhotoPose, string> = {
  front: "Frente",
  side: "Perfil",
  back: "Espalda",
  other: "Otra",
};

export const PHOTO_BUCKET = "progress-photos";
export const PHOTO_SIGNED_URL_SECONDS = 60 * 60;
export const PHOTO_MAX_DIMENSION = 1600;
export type PhotoExtension = "webp" | "jpg";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PATH = new RegExp(`^(${UUID})/(\\d{4}-\\d{2}-\\d{2})-(front|side|back|other)-([a-z0-9]{8,32})\\.(webp|jpg)$`);

export function buildPhotoPath(userId: string, localDate: string, pose: PhotoPose, random: string, ext: PhotoExtension): string {
  return `${userId}/${localDate}-${pose}-${random}.${ext}`;
}

export type ParsedPhotoPath = { userId: string; localDate: string; pose: PhotoPose; ext: PhotoExtension; fileName: string };

export function parsePhotoPath(path: string): ParsedPhotoPath | null {
  const m = PATH.exec(path);
  if (!m) return null;
  const [, userId, localDate, pose, , ext] = m;
  if (!isIsoDate(localDate!)) return null;
  return { userId: userId!, localDate: localDate!, pose: pose as PhotoPose, ext: ext as PhotoExtension, fileName: path.slice(userId!.length + 1) };
}

/** ¿La ruta es de este usuario, con el formato esperado y coherente con la fecha y la pose? */
export function isOwnPhotoPath(path: string, userId: string, localDate?: string, pose?: PhotoPose): boolean {
  const p = parsePhotoPath(path);
  if (!p || p.userId !== userId.toLowerCase()) return false;
  if (localDate && p.localDate !== localDate) return false;
  if (pose && p.pose !== pose) return false;
  return true;
}

/** Medidas finales para que el lado mayor no pase de `max` (sin agrandar). */
export function fitWithin(width: number, height: number, max: number = PHOTO_MAX_DIMENSION): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) throw new Error("Dimensiones inválidas.");
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
