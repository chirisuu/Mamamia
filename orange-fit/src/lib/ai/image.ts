import "server-only";
import sharp from "sharp";

/**
 * Preparación de fotos de comida antes de enviarlas a la IA: se valida el tipo real (no solo el
 * declarado), se corrige la orientación EXIF, se reduce a ≤ 1568 px por lado (lo que el modelo
 * aprovecha) y se re-codifica como JPEG sin metadatos (se descartan GPS y datos del equipo).
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 1568;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number];

export class ImageInputError extends Error {
  constructor(
    readonly code: "IMAGE_TOO_LARGE" | "IMAGE_TYPE" | "IMAGE_INVALID" | "IMAGE_EMPTY",
    message: string,
  ) {
    super(message);
    this.name = "ImageInputError";
  }
}

export function isAcceptedImageType(type: string): type is AcceptedImageType {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type);
}

/** Valida tamaño y tipo declarado (el contenido se verifica al decodificar). */
export function assertImageUpload(file: { size: number; type: string }): void {
  if (file.size === 0) throw new ImageInputError("IMAGE_EMPTY", "La imagen está vacía.");
  if (file.size > MAX_UPLOAD_BYTES) throw new ImageInputError("IMAGE_TOO_LARGE", "La imagen pesa más de 8 MB. Usa una foto más liviana.");
  if (!isAcceptedImageType(file.type)) throw new ImageInputError("IMAGE_TYPE", "Usa una foto JPG, PNG o WebP.");
}

export type PreparedImage = { buffer: Buffer; mediaType: "image/jpeg"; width: number; height: number; bytes: number };

export async function prepareFoodImage(input: Buffer): Promise<PreparedImage> {
  let format: string | undefined;
  try {
    format = (await sharp(input, { failOn: "error" }).metadata()).format;
  } catch {
    throw new ImageInputError("IMAGE_INVALID", "No pudimos leer la imagen. Prueba con otra foto.");
  }
  if (!format || !["jpeg", "png", "webp"].includes(format)) {
    throw new ImageInputError("IMAGE_TYPE", "Usa una foto JPG, PNG o WebP.");
  }
  try {
    const { data, info } = await sharp(input, { failOn: "error" })
      .rotate()
      .resize({ width: MAX_IMAGE_SIDE, height: MAX_IMAGE_SIDE, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return { buffer: data, mediaType: "image/jpeg", width: info.width, height: info.height, bytes: data.length };
  } catch {
    throw new ImageInputError("IMAGE_INVALID", "No pudimos procesar la imagen. Prueba con otra foto.");
  }
}
