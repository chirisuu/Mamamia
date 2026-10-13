import Image from "next/image";
import { ChefHat } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Imagen de la receta (bucket público `recipe-images`). Sin imagen se muestra un placeholder de
 * marca (degradado + icono): nunca una foto genérica que no sea del plato.
 * `unoptimized`: la URL de Storage local es http y no pasa por el optimizador.
 */
export function RecipeImage({
  url,
  title,
  className,
  sizes = "(min-width: 1024px) 33vw, 100vw",
  priority = false,
}: {
  url: string | null;
  title: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {url ? (
        <Image src={url} alt={`Foto de ${title}`} fill sizes={sizes} unoptimized priority={priority} className="object-cover" />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-primary/35 via-accent to-secondary"
        >
          <div className="flex size-14 items-center justify-center rounded-2xl bg-card/80 text-primary-strong shadow-sm">
            <ChefHat className="size-7" />
          </div>
        </div>
      )}
    </div>
  );
}
