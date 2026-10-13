/**
 * Compresión en el navegador: la foto se redibuja en un canvas (máx. 1600 px por lado) y se
 * codifica en WebP. Al redibujar se pierden los metadatos EXIF (incluida la ubicación GPS), algo
 * deseable para fotos del cuerpo. Si el navegador no codifica WebP (algunos Safari), se usa JPEG.
 */
import { fitWithin, PHOTO_MAX_DIMENSION, type PhotoExtension } from "./photo-path";

export type CompressedImage = { blob: Blob; ext: PhotoExtension; contentType: string; width: number; height: number };

export class ImageCompressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageCompressError";
  }
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Sigue con <img> (p. ej. HEIC en Safari).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageCompressError("No pudimos leer esa imagen. Prueba con una foto JPG o PNG.");
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressImage(file: Blob, maxDimension: number = PHOTO_MAX_DIMENSION): Promise<CompressedImage> {
  if (!file.type.startsWith("image/") && file.type !== "") throw new ImageCompressError("El archivo no es una imagen.");
  const decoded = await decode(file);
  try {
    const size = fitWithin(decoded.width, decoded.height, maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageCompressError("Tu navegador no permite procesar la imagen.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(decoded.source, 0, 0, size.width, size.height);
    const webp = await toBlob(canvas, "image/webp", 0.82);
    if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp", contentType: "image/webp", ...size };
    const jpeg = await toBlob(canvas, "image/jpeg", 0.85);
    if (jpeg) return { blob: jpeg, ext: "jpg", contentType: "image/jpeg", ...size };
    throw new ImageCompressError("No pudimos comprimir la imagen.");
  } finally {
    decoded.close();
  }
}

/** 16 caracteres aleatorios [a-z0-9] para el nombre del archivo. */
export function randomFileToken(length = 16): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
