"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { reviewRecipeAction } from "../actions/recipes";

/** Moderación de una receta enviada por un usuario: publicar o rechazar con motivo (lo ve el autor). */
export function RecipeReviewForm({ recipeId, canPublish, blockReason }: { recipeId: string; canPublish: boolean; blockReason: string | null }) {
  const router = useRouter();
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<"publish" | "reject" | null>(null);

  async function submit(decision: "publish" | "reject") {
    const trimmed = note.trim();
    if (decision === "reject" && trimmed.length < 10) {
      setError("Explica el motivo (mínimo 10 caracteres): lo verá quien la envió.");
      return;
    }
    setError(null);
    setPending(decision);
    try {
      const result = await reviewRecipeAction({ recipeId, decision, note: trimmed || null });
      if (!result.ok) {
        setError(result.error.fieldErrors?.note?.[0] ?? null);
        toast.error(result.error.message);
        return;
      }
      toast.success(decision === "publish" ? "Receta publicada. Avisamos a su autor." : "Receta rechazada. Avisamos a su autor con el motivo.");
      router.refresh();
    } catch {
      toast.error("No se pudo guardar la revisión. Revisa tu conexión.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="review-note">Mensaje para el autor</Label>
        <Textarea
          id="review-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "review-note-error review-note-hint" : "review-note-hint"}
          placeholder="Obligatorio si la rechazas. Ej.: cambia «pollo casero» por un alimento del catálogo."
        />
        <p id="review-note-hint" className="text-xs text-muted-foreground">
          Se envía en su notificación. Sin datos personales; máximo 500 caracteres.
        </p>
        {error ? (
          <p id="review-note-error" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      {blockReason ? <p className="text-sm text-muted-foreground">{blockReason}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!canPublish || pending !== null} loading={pending === "publish"} onClick={() => void submit("publish")}>
          Publicar
        </Button>
        <Button type="button" variant="outline" disabled={pending !== null} loading={pending === "reject"} onClick={() => void submit("reject")}>
          Rechazar
        </Button>
      </div>
    </div>
  );
}
