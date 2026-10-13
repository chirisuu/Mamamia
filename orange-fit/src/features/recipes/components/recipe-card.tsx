import Link from "next/link";
import { Clock, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDuration, formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RecipeCard as RecipeCardData } from "../lib/adapters";
import { difficultyLabel } from "../lib/labels";
import { RecipeImage } from "./recipe-image";

export const RECIPE_STATUS_LABELS: Record<RecipeCardData["status"], string> = {
  draft: "Borrador",
  pending_review: "En revisión",
  published: "Publicada",
  rejected: "No publicada",
};

/** Tarjeta del catálogo: kcal y proteína por porción, tiempo y dificultad. */
export function RecipeCard({ recipe, favorite = false, className }: { recipe: RecipeCardData; favorite?: boolean; className?: string }) {
  const ps = recipe.perServing;
  const difficulty = difficultyLabel(recipe.difficulty);
  return (
    <Link
      href={`/app/recetas/${recipe.slug}`}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <div className="relative">
        <RecipeImage url={recipe.imageUrl} title={recipe.title} className="aspect-[16/10] w-full" sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw" />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {recipe.isOwn ? <Badge variant="secondary">{recipe.status === "published" ? "Tuya" : RECIPE_STATUS_LABELS[recipe.status]}</Badge> : null}
        </div>
        {favorite ? (
          <span className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-card/90 shadow-sm">
            <Star className="size-4 fill-primary stroke-primary-strong" aria-hidden="true" />
            <span className="sr-only">Favorita</span>
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug tracking-tight">{recipe.title}</h3>
        {ps ? (
          <p className="text-sm text-muted-foreground" data-numeric>
            <span className="font-semibold text-foreground tabular-nums">{formatNumber(ps.kcal)} kcal</span>
            {" · "}
            <span className="tabular-nums">{formatNumber(ps.proteinG)} g proteína</span>
            <span className="sr-only"> por porción</span>
            <span aria-hidden="true"> / porción</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Sin ingredientes: no se puede calcular.</p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {recipe.totalMinutes != null ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden="true" />
              {formatDuration(recipe.totalMinutes)}
            </span>
          ) : null}
          {difficulty ? <span>{difficulty}</span> : null}
          {recipe.costPerServing != null && recipe.costCurrency ? (
            <span>
              {formatMoney(recipe.costPerServing, recipe.costCurrency)} / porción <span className="sr-only">(referencial)</span>
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
