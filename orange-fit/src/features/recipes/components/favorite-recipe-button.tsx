"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { setFavoriteRecipeAction } from "../actions";

/** Marca o desmarca una receta como favorita (optimista; si falla, vuelve atrás y lo dice). */
export function FavoriteRecipeButton({ recipeId, title, initial, className }: { recipeId: string; title: string; initial: boolean; className?: string }) {
  const [favorite, setFavorite] = React.useState(initial);
  const [lastInitial, setLastInitial] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setFavorite(initial);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn("rounded-full", className)}
      aria-pressed={favorite}
      aria-label={favorite ? `Quitar ${title} de favoritas` : `Guardar ${title} en favoritas`}
      disabled={pending}
      onClick={() => {
        const next = !favorite;
        setFavorite(next);
        startTransition(async () => {
          const res = await setFavoriteRecipeAction({ recipeId, favorite: next });
          if (!res.ok) {
            setFavorite(!next);
            toast.error(res.error.message);
            return;
          }
          toast.success(next ? "Guardada en favoritas" : "Quitada de favoritas");
        });
      }}
    >
      <Star className={cn("size-5", favorite ? "fill-primary stroke-primary-strong" : "text-muted-foreground")} aria-hidden="true" />
    </Button>
  );
}
