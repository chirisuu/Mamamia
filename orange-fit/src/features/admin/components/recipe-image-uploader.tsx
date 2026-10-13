"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImageUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { RecipeImage } from "@/features/recipes/components/recipe-image";
import { removeRecipeImageAction, uploadRecipeImageAction } from "../actions/recipes";
import { RECIPE_IMAGE_HEIGHT, RECIPE_IMAGE_MAX_BYTES, RECIPE_IMAGE_WIDTH } from "../schemas";
import { ConfirmActionButton } from "./action-buttons";

const SOURCE_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Recorta al centro a 4:3 y reduce a 1200×900 en el navegador (WebP si el navegador lo soporta,
 * si no JPEG). Baja la calidad hasta entrar en el límite de subida; el servidor la vuelve a
 * normalizar a WebP con sharp y le quita los metadatos.
 */
async function prepareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const target = RECIPE_IMAGE_WIDTH / RECIPE_IMAGE_HEIGHT;
    let sw = bitmap.width;
    let sh = bitmap.height;
    if (sw / sh > target) sw = Math.round(sh * target);
    else sh = Math.round(sw / target);
    const sx = Math.round((bitmap.width - sw) / 2);
    const sy = Math.round((bitmap.height - sh) / 2);
    const canvas = document.createElement("canvas");
    canvas.width = RECIPE_IMAGE_WIDTH;
    canvas.height = RECIPE_IMAGE_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, RECIPE_IMAGE_WIDTH, RECIPE_IMAGE_HEIGHT);
    for (const quality of [0.82, 0.7, 0.55, 0.4]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (blob && blob.size <= RECIPE_IMAGE_MAX_BYTES) return blob;
    }
    throw new Error("too_big");
  } finally {
    bitmap.close();
  }
}

export function RecipeImageUploader({ recipeId, title, slug, imageUrl }: { recipeId: string; title: string; slug: string; imageUrl: string | null }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Elige un archivo de imagen (JPG, PNG o WebP).");
      return;
    }
    if (file.size > SOURCE_MAX_BYTES) {
      toast.error("La imagen pesa más de 25 MB. Usa una más liviana.");
      return;
    }
    setBusy(true);
    try {
      let blob: Blob;
      try {
        blob = await prepareImage(file);
      } catch {
        toast.error("No pudimos procesar la imagen en el navegador. Prueba con otro archivo.");
        return;
      }
      const data = new FormData();
      data.set("recipeId", recipeId);
      data.set("file", blob, `${slug}.webp`);
      const result = await uploadRecipeImageAction(data);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Imagen guardada.");
      router.refresh();
    } catch {
      toast.error("No se pudo subir la imagen. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-3">
      <RecipeImage url={imageUrl} title={title} className="aspect-[4/3] w-full max-w-md rounded-2xl" sizes="28rem" />
      <p className="text-xs text-muted-foreground">
        Se guarda como <code className="font-mono">official/{slug}.webp</code> (1200 × 900, WebP). Las fotos generadas con IA son referenciales.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          id={`image-${recipeId}`}
          onChange={(e) => void onFile(e.target.files?.[0])}
          tabIndex={-1}
        />
        <Button type="button" variant="outline" loading={busy} onClick={() => inputRef.current?.click()}>
          <ImageUp aria-hidden="true" />
          {imageUrl ? "Cambiar imagen" : "Subir imagen"}
        </Button>
        {imageUrl ? (
          <ConfirmActionButton
            variant="ghost"
            action={removeRecipeImageAction.bind(null, { id: recipeId })}
            successMessage="Imagen quitada."
            title="¿Quitar la imagen?"
            description={<p>La receta mostrará el fondo de marca hasta que subas otra.</p>}
            confirmLabel="Sí, quitar"
            destructive
            disabled={busy}
          >
            Quitar imagen
          </ConfirmActionButton>
        ) : null}
      </div>
    </div>
  );
}
