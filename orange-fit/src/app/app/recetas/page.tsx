import type { Metadata } from "next";
import Link from "next/link";
import { ChefHat, Plus, SearchX } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { PremiumGate } from "@/components/app/premium-gate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getActiveGoal } from "@/lib/data/targets";
import { RecipeCard } from "@/features/recipes/components/recipe-card";
import { RecipeFilters } from "@/features/recipes/components/recipe-filters";
import { TodaySuggestions } from "@/features/recipes/components/today-suggestions";
import type { RecipeCard as RecipeCardData } from "@/features/recipes/lib/adapters";
import { activeFilterCount, filterRecipes, parseRecipeFilters } from "@/features/recipes/lib/filters";
import { getFavoriteRecipeIds, listCatalogRecipes } from "@/features/recipes/queries";
import { getRecipesPageContext } from "@/features/recipes/server/page-context";

export const metadata: Metadata = { title: "Recetas" };

export default async function RecipesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getRecipesPageContext("/app/recetas");
  let cards: RecipeCardData[] | null = null;
  let favorites = new Set<string>();
  let goalAllergens: string[] = [];
  try {
    const [c, f, goal] = await Promise.all([
      listCatalogRecipes(ctx.supabase, ctx.user.id),
      getFavoriteRecipeIds(ctx.supabase, ctx.user.id),
      getActiveGoal(ctx.supabase, ctx.user.id),
    ]);
    cards = c;
    favorites = f;
    goalAllergens = [...(goal?.allergies ?? []), ...(goal?.intolerances ?? [])];
  } catch {
    cards = null;
  }

  const header = (
    <AppHeader
      title="Recetas"
      subtitle="Nutrición calculada desde sus ingredientes"
      actions={
        <Button asChild size="sm">
          <Link href="/app/recetas/nueva">
            <Plus aria-hidden="true" />
            Nueva
          </Link>
        </Button>
      }
    />
  );

  if (!cards) {
    return (
      <>
        {header}
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>No pudimos cargar las recetas</AlertTitle>
          <AlertDescription>
            <p>Revisa tu conexión y vuelve a intentarlo.</p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link href="/app/recetas">Reintentar</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </>
    );
  }

  const filters = parseRecipeFilters(await searchParams, goalAllergens);
  const results = filterRecipes(cards, filters, favorites);
  const browsing = !filters.q && activeFilterCount(filters) === (filters.allergensFromGoal && filters.excludeAllergens.length ? 1 : 0);

  return (
    <>
      {header}
      <div className="flex flex-col gap-6 pb-6 pt-2">
        {browsing ? (
          <section aria-labelledby="meta-hoy" className="flex flex-col gap-3">
            <h2 id="meta-hoy" className="text-lg font-semibold tracking-tight">
              Para tu meta de hoy
            </h2>
            <PremiumGate feature="smart_recipes">
              <TodaySuggestions supabase={ctx.supabase} userId={ctx.user.id} today={ctx.today} cards={cards} mealType={ctx.defaultMeal} />
            </PremiumGate>
          </section>
        ) : null}

        <section aria-labelledby="catalogo" className="flex flex-col gap-4">
          <h2 id="catalogo" className="sr-only">
            Catálogo de recetas
          </h2>
          <RecipeFilters filters={filters} currency={ctx.currency} resultCount={results.length} />
          {cards.length === 0 ? (
            <EmptyState
              icon={ChefHat}
              title="Todavía no hay recetas"
              description="Crea la primera con tus ingredientes; calculamos su nutrición por ti."
              action={
                <Button asChild>
                  <Link href="/app/recetas/nueva">Crear receta</Link>
                </Button>
              }
            />
          ) : results.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No hay recetas con estos filtros"
              description="Prueba con otra búsqueda o quita algún filtro."
              action={
                <Button asChild variant="outline">
                  <Link href="/app/recetas?sin=">Ver todas</Link>
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((r) => (
                <li key={r.id}>
                  <RecipeCard recipe={r} favorite={favorites.has(r.id)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
