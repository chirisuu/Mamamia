"use client";

import * as React from "react";
import Link from "next/link";
import { ChefHat, Pencil, Plus, Star, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MealType, PickerFood } from "../types";
import { FavoriteButton } from "./favorite-button";
import { PortionPicker } from "./portion-picker";

type OwnFood = PickerFood & { barcode: string | null };
type FavoriteRecipe = { id: string; title: string; slug: string };

/** Mis alimentos y favoritos: tocar uno abre el selector de porciones para registrarlo. */
export function FoodsLibrary({
  ownFoods,
  favorites,
  favoriteRecipes,
  today,
  maxDate,
  defaultMeal,
  initialTab,
}: {
  ownFoods: OwnFood[];
  favorites: PickerFood[];
  favoriteRecipes: FavoriteRecipe[];
  today: string;
  maxDate: string;
  defaultMeal: MealType;
  initialTab: "mine" | "favorites";
}) {
  const [selected, setSelected] = React.useState<PickerFood | null>(null);
  const [open, setOpen] = React.useState(false);
  const choose = (food: PickerFood) => {
    setSelected(food);
    setOpen(true);
  };

  return (
    <>
      <Tabs defaultValue={initialTab}>
        <TabsList className="w-full">
          <TabsTrigger value="mine">
            <UtensilsCrossed aria-hidden="true" />
            Mis alimentos
          </TabsTrigger>
          <TabsTrigger value="favorites">
            <Star aria-hidden="true" />
            Favoritos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="grid gap-3">
          {ownFoods.length ? (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {ownFoods.map((food) => (
                <FoodRow key={food.id} food={food} onChoose={choose} editHref={`/app/alimentos/${food.id}`} />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={UtensilsCrossed}
              title="Aún no creas alimentos"
              description="Crea los que no encuentres en la base, con los datos de su etiqueta. Solo tú los ves."
              action={
                <Button asChild>
                  <Link href="/app/alimentos/nuevo">
                    <Plus aria-hidden="true" />
                    Crear alimento
                  </Link>
                </Button>
              }
            />
          )}
        </TabsContent>

        <TabsContent value="favorites" className="grid gap-4">
          {favorites.length ? (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {favorites.map((food) => (
                <FoodRow key={food.id} food={food} onChoose={choose} />
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Star}
              title="Sin alimentos favoritos"
              description="Marca con la estrella los que más comes, desde el buscador o tu diario."
              action={
                <Button asChild variant="outline">
                  <Link href="/app/agregar/buscar">Ir al buscador</Link>
                </Button>
              }
            />
          )}
          {favoriteRecipes.length ? (
            <section aria-labelledby="fav-recipes" className="grid gap-2">
              <h2 id="fav-recipes" className="text-sm font-semibold text-muted-foreground">
                Recetas favoritas
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {favoriteRecipes.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/app/recetas/${r.slug}`}
                      className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <ChefHat className="size-5 text-primary-strong" aria-hidden="true" />
                      <span className="font-medium">{r.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </TabsContent>
      </Tabs>

      <PortionPicker
        food={selected}
        open={open}
        onOpenChange={setOpen}
        localDate={today}
        maxDate={maxDate}
        defaultMeal={defaultMeal}
        source="search"
      />
    </>
  );
}

function FoodRow({ food, onChoose, editHref }: { food: PickerFood; onChoose: (f: PickerFood) => void; editHref?: string }) {
  return (
    <li className="flex items-center gap-1 pr-2">
      <button
        type="button"
        onClick={() => onChoose(food)}
        className={cn(
          "flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50",
          "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        )}
      >
        <span className="sr-only">Registrar: </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{food.name}</span>
          <span className="block truncate text-sm text-muted-foreground" data-numeric="">
            {food.brandName ? `${food.brandName} · ` : ""}
            {formatNumber(food.per100g.energyKcal)} kcal · P {formatNumber(food.per100g.proteinG, 1)} · C{" "}
            {formatNumber(food.per100g.carbsG, 1)} · G {formatNumber(food.per100g.fatG, 1)} por 100 g
          </span>
          {food.portions.length ? (
            <span className="block truncate text-xs text-muted-foreground">
              {food.portions.length === 1 ? food.portions[0]!.label : `${food.portions.length} porciones`}
            </span>
          ) : null}
        </span>
      </button>
      <FavoriteButton foodId={food.id} foodName={food.name} initial={Boolean(food.isFavorite)} />
      {editHref ? (
        <Button asChild variant="ghost" size="icon-sm" className="rounded-full">
          <Link href={editHref} aria-label={`Editar ${food.name}`}>
            <Pencil aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
    </li>
  );
}
