"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { setFavoriteFoodAction } from "../actions";

/** Marca o desmarca un alimento como favorito (estado optimista; si falla, vuelve atrás). */
export function FavoriteButton({
  foodId,
  foodName,
  initial,
  onChange,
  className,
}: {
  foodId: string;
  foodName: string;
  initial: boolean;
  onChange?: (favorite: boolean) => void;
  className?: string;
}) {
  const [favorite, setFavorite] = React.useState(initial);
  const [lastInitial, setLastInitial] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();
  // Si el servidor trae otro valor (p. ej. tras revalidar), manda el del servidor.
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
      aria-label={favorite ? `Quitar ${foodName} de favoritos` : `Agregar ${foodName} a favoritos`}
      disabled={pending}
      onClick={() => {
        const next = !favorite;
        setFavorite(next);
        startTransition(async () => {
          const res = await setFavoriteFoodAction({ foodId, favorite: next });
          if (!res.ok) {
            setFavorite(!next);
            toast.error(res.error.message);
            return;
          }
          onChange?.(next);
          toast.success(next ? "Agregado a favoritos" : "Quitado de favoritos");
        });
      }}
    >
      <Star className={cn("size-5", favorite ? "fill-primary stroke-primary-strong" : "text-muted-foreground")} aria-hidden="true" />
    </Button>
  );
}
