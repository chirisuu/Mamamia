"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { idSchema, officialRecipeSchema, RECIPE_IMAGE_MAX_BYTES, recipeReviewSchema, type OfficialRecipeInput, type RecipeReviewInput } from "../schemas";
import { runAdminAction, type Revalidate } from "../server/action";
import { removeRecipeImage, reviewRecipe, saveOfficialRecipe, uploadRecipeImage } from "../server/recipes";

const REVALIDATE: Revalidate[] = ["/admin/recetas", { path: "/admin/recetas", type: "layout" }, { path: "/app/recetas", type: "layout" }];

export async function reviewRecipeAction(input: RecipeReviewInput): Promise<ActionResult<{ status: string }>> {
  return runAdminAction("editor", recipeReviewSchema, input, ({ supabase, user, data }) => reviewRecipe(supabase, user.id, data), REVALIDATE);
}

export async function saveOfficialRecipeAction(input: OfficialRecipeInput): Promise<ActionResult<{ id: string; slug: string }>> {
  return runAdminAction("editor", officialRecipeSchema, input, ({ supabase, user, data }) => saveOfficialRecipe(supabase, user.id, data), REVALIDATE);
}

const imageUploadSchema = z.object({
  recipeId: z.uuid("Receta inválida."),
  file: z
    .custom<Blob>((v) => typeof Blob !== "undefined" && v instanceof Blob, "Elige una imagen.")
    .refine((f) => f.size > 0, "La imagen está vacía.")
    .refine((f) => f.size <= RECIPE_IMAGE_MAX_BYTES, "La imagen convertida pesa demasiado (máx. 900 KB).")
    .refine((f) => !f.type || f.type.startsWith("image/"), "El archivo no es una imagen."),
});

/** Recibe la imagen ya reducida en el navegador; el servidor la normaliza a WebP 1200×900 con sharp. */
export async function uploadRecipeImageAction(formData: FormData): Promise<ActionResult<{ imagePath: string; bytes: number }>> {
  const input = { recipeId: formData.get("recipeId"), file: formData.get("file") };
  return runAdminAction(
    "editor",
    imageUploadSchema,
    input,
    async ({ supabase, data }) => uploadRecipeImage(supabase, data.recipeId, Buffer.from(await data.file.arrayBuffer())),
    REVALIDATE,
  );
}

export async function removeRecipeImageAction(input: { id: string }): Promise<ActionResult<null>> {
  return runAdminAction(
    "editor",
    idSchema,
    input,
    async ({ supabase, data }) => {
      await removeRecipeImage(supabase, data.id);
      return null;
    },
    REVALIDATE,
  );
}
