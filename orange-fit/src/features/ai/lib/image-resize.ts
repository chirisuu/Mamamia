/**
 * Reducción opcional de la foto en el navegador antes de subirla (ahorra datos móviles y evita el
 * límite de 8 MB). El servidor igual la re-codifica con sharp: esto es solo una optimización y, si
 * el navegador no puede, se sube el archivo original.
 */

const CLIENT_MAX_SIDE = 2048;
const RESIZE_ABOVE_BYTES = 2.5 * 1024 * 1024;

export async function shrinkImageForUpload(file: File): Promise<Blob> {
  if (file.size <= RESIZE_ABOVE_BYTES || typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, CLIENT_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
