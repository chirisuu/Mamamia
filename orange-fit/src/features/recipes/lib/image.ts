import { publicEnv } from "@/lib/env";

export const RECIPE_IMAGES_BUCKET = "recipe-images";

/**
 * URL pública de la imagen de una receta (bucket público `recipe-images`, p. ej.
 * `official/{slug}.webp`). null si no hay imagen o Supabase no está configurado: la UI muestra
 * el placeholder de marca, nunca una foto inventada.
 */
export function recipeImageUrl(
  imagePath: string | null | undefined,
  version?: string | null,
  baseUrl: string | undefined = publicEnv.NEXT_PUBLIC_SUPABASE_URL,
): string | null {
  if (!imagePath || !baseUrl) return null;
  const clean = imagePath.replace(/^\/+/, "");
  if (!clean || clean.includes("..")) return null;
  const path = clean.split("/").map(encodeURIComponent).join("/");
  const url = `${baseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${RECIPE_IMAGES_BUCKET}/${path}`;
  return version ? `${url}?v=${encodeURIComponent(version)}` : url;
}
