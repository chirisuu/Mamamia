import { z } from "zod";
import { PHOTO_POSES } from "./lib/photo-path";
import { isoDateSchema } from "./schemas";

export const photoPoseSchema = z.enum(PHOTO_POSES, { error: "Elige la pose de la foto." });

export const preparePhotoSchema = z.object({
  localDate: isoDateSchema,
  pose: photoPoseSchema,
  ext: z.enum(["webp", "jpg"]),
});
export type PreparePhotoInput = z.infer<typeof preparePhotoSchema>;

export const savePhotoSchema = z.object({
  path: z.string().min(1).max(200),
  localDate: isoDateSchema,
  pose: photoPoseSchema,
  note: z.string().trim().max(500, "Máximo 500 caracteres.").nullable(),
});
export type SavePhotoInput = z.input<typeof savePhotoSchema>;

export const photoIdSchema = z.uuid("Foto inválida.");
