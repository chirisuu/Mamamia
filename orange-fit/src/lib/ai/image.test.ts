/** Preparación de fotos con sharp real (imágenes generadas en memoria). */
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { assertImageUpload, ImageInputError, MAX_IMAGE_SIDE, prepareFoodImage } from "./image";

async function png(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 230, g: 120, b: 30 } } }).png().toBuffer();
}

describe("fotos para la IA", () => {
  it("reduce a ≤ 1568 px por lado y re-codifica como JPEG sin metadatos", async () => {
    const input = await sharp(await png(3000, 2000)).withMetadata({ exif: { IFD0: { Copyright: "secreto" } } }).jpeg().toBuffer();
    const out = await prepareFoodImage(input);
    expect(out.mediaType).toBe("image/jpeg");
    expect(Math.max(out.width, out.height)).toBe(MAX_IMAGE_SIDE);
    const meta = await sharp(out.buffer).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.exif).toBeUndefined();
  });

  it("no agranda las fotos pequeñas", async () => {
    const out = await prepareFoodImage(await png(400, 300));
    expect([out.width, out.height]).toEqual([400, 300]);
  });

  it("rechaza lo que no es una imagen aunque diga image/jpeg", async () => {
    await expect(prepareFoodImage(Buffer.from("no soy una foto"))).rejects.toBeInstanceOf(ImageInputError);
  });

  it("valida tamaño (≤ 8 MB) y tipo declarado", () => {
    expect(() => assertImageUpload({ size: 0, type: "image/jpeg" })).toThrow(/vacía/);
    expect(() => assertImageUpload({ size: 9 * 1024 * 1024, type: "image/jpeg" })).toThrow(/8 MB/);
    expect(() => assertImageUpload({ size: 1000, type: "image/gif" })).toThrow(/JPG, PNG o WebP/);
    expect(() => assertImageUpload({ size: 1000, type: "image/webp" })).not.toThrow();
  });
});
