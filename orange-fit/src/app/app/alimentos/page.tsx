import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FoodsLibrary } from "@/features/diary/components/foods-library";
import { defaultMealForHour } from "@/features/diary/lib/meal-time";
import {
  getFavoriteFoods,
  getFavoriteRecipes,
  getOwnFoods,
  type FavoriteRecipe,
  type OwnFoodListItem,
} from "@/features/diary/queries";
import { getDiaryPageContext } from "@/features/diary/server/page-context";
import type { PickerFood } from "@/features/diary/types";

export const metadata: Metadata = { title: "Mis alimentos" };

export default async function FoodsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getDiaryPageContext("/app/alimentos");
  const { tab } = await searchParams;
  let data: { own: OwnFoodListItem[]; favorites: PickerFood[]; recipes: FavoriteRecipe[] } | null = null;
  try {
    const [own, favorites, recipes] = await Promise.all([
      getOwnFoods(ctx.supabase, ctx.user.id),
      getFavoriteFoods(ctx.supabase, ctx.user.id),
      getFavoriteRecipes(ctx.supabase, ctx.user.id),
    ]);
    data = { own, favorites, recipes };
  } catch {
    data = null;
  }

  return (
    <>
      <AppHeader
        title="Mis alimentos"
        subtitle="Tus alimentos y favoritos"
        backHref="/app/agregar"
        actions={
          <Button asChild size="sm">
            <Link href="/app/alimentos/nuevo">
              <Plus aria-hidden="true" />
              Crear
            </Link>
          </Button>
        }
      />
      <div className="pt-2">
        {data ? (
          <FoodsLibrary
            ownFoods={data.own}
            favorites={data.favorites}
            favoriteRecipes={data.recipes}
            today={ctx.today}
            maxDate={ctx.tomorrow}
            defaultMeal={defaultMealForHour(ctx.hour)}
            initialTab={tab === "favoritos" ? "favorites" : "mine"}
          />
        ) : (
          <Alert variant="destructive">
            <AlertTitle>No pudimos cargar tus alimentos</AlertTitle>
            <AlertDescription>Revisa tu conexión y recarga la página.</AlertDescription>
          </Alert>
        )}
      </div>
    </>
  );
}
