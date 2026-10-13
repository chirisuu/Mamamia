import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Clock, Pencil, Users } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getActiveGoal } from "@/lib/data/targets";
import { hasFeature } from "@/lib/billing/entitlements";
import { formatDuration, formatMoney, formatNumber } from "@/lib/format";
import { normalizeKey } from "@/lib/nutrition";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listEditablePlans } from "@/features/planner/queries";
import { DeleteRecipeButton } from "@/features/recipes/components/delete-recipe-button";
import { FavoriteRecipeButton } from "@/features/recipes/components/favorite-recipe-button";
import { RECIPE_STATUS_LABELS } from "@/features/recipes/components/recipe-card";
import { RecipeDetailView } from "@/features/recipes/components/recipe-detail-view";
import { RecipeImage } from "@/features/recipes/components/recipe-image";
import { allergenLabel, dietTagLabel, difficultyLabel, mealTypeLabel } from "@/features/recipes/lib/labels";
import { getRecipeDetail } from "@/features/recipes/queries";
import { getRecipesPageContext } from "@/features/recipes/server/page-context";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("recipes").select("title").eq("slug", slug).maybeSingle();
    return { title: data?.title ?? "Receta" };
  } catch {
    return { title: "Receta" };
  }
}

export default async function RecipePage({ params }: Props) {
  const { slug } = await params;
  const ctx = await getRecipesPageContext(`/app/recetas/${slug}`);
  const [detail, goal, canPlan] = await Promise.all([
    getRecipeDetail(ctx.supabase, ctx.user.id, slug),
    getActiveGoal(ctx.supabase, ctx.user.id),
    hasFeature("meal_plans"),
  ]);
  if (!detail) notFound();
  const plans = canPlan ? await listEditablePlans(ctx.supabase, ctx.user.id) : [];
  const { card, steps, ingredients } = detail;

  const goalAllergens = new Set([...(goal?.allergies ?? []), ...(goal?.intolerances ?? [])].map((a) => normalizeKey(a).replace(/\s+/g, "_")));
  const conflicting = card.allergens.filter((a) => goalAllergens.has(normalizeKey(a).replace(/\s+/g, "_")));
  const difficulty = difficultyLabel(card.difficulty);
  const privateFoods = card.isOwn ? ingredients.filter((i) => !i.isPublicFood) : [];

  return (
    <>
      <AppHeader
        title={card.title}
        backHref="/app/recetas"
        backLabel="Volver a recetas"
        actions={
          <>
            <FavoriteRecipeButton recipeId={card.id} title={card.title} initial={detail.isFavorite} />
            {card.isOwn ? (
              <Button asChild variant="ghost" size="icon-sm" className="rounded-full">
                <Link href={`/app/recetas/${card.slug}/editar`} aria-label="Editar receta">
                  <Pencil aria-hidden="true" />
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      <article className="flex flex-col gap-6 pb-8 pt-2">
        <RecipeImage url={card.imageUrl} title={card.title} priority className="aspect-[16/9] w-full rounded-2xl lg:aspect-[21/9]" sizes="(min-width: 1024px) 60vw, 100vw" />

        <div className="flex flex-col gap-3">
          {card.isOwn && card.status !== "published" ? (
            <Alert variant="info">
              <AlertTitle>{RECIPE_STATUS_LABELS[card.status]}</AlertTitle>
              <AlertDescription>
                <p>
                  {card.status === "draft"
                    ? "Solo tú la ves. Cuando quieras, envíala a revisión desde Editar para que el equipo la publique."
                    : card.status === "pending_review"
                      ? "El equipo la revisará antes de publicarla. Mientras tanto solo tú la ves."
                      : "El equipo no la publicó. Puedes seguir usándola tú y editarla."}
                </p>
                {privateFoods.length ? (
                  <p>Usa alimentos que creaste tú ({privateFoods.map((i) => i.name).join(", ")}): para publicarla, cámbialos por alimentos del catálogo.</p>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
          {card.description ? <p className="text-base text-muted-foreground">{card.description}</p> : null}
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {card.totalMinutes != null ? (
              <li className="inline-flex items-center gap-1.5">
                <Clock className="size-4" aria-hidden="true" />
                {formatDuration(card.totalMinutes)}
                {card.prepMinutes != null && card.cookMinutes != null ? ` (${card.prepMinutes} de preparación + ${card.cookMinutes} de cocción)` : ""}
              </li>
            ) : null}
            <li className="inline-flex items-center gap-1.5">
              <Users className="size-4" aria-hidden="true" />
              Rinde {formatNumber(card.servings, Number.isInteger(card.servings) ? 0 : 1)} {card.servings === 1 ? "porción" : "porciones"}
            </li>
            {difficulty ? <li>Dificultad: {difficulty}</li> : null}
            {card.costPerServing != null && card.costCurrency ? (
              <li>{formatMoney(card.costPerServing, card.costCurrency)} por porción (precio referencial, no en tiempo real)</li>
            ) : null}
          </ul>
          <div className="flex flex-wrap gap-1.5">
            {card.mealTypes.map((m) => (
              <Badge key={m} variant="outline">
                {mealTypeLabel(m)}
              </Badge>
            ))}
            {card.dietTags.map((t) => (
              <Badge key={t} variant="soft">
                {dietTagLabel(t)}
              </Badge>
            ))}
          </div>
          {card.allergens.length ? (
            <Alert variant={conflicting.length ? "warning" : "default"}>
              <AlertTriangle aria-hidden="true" />
              <AlertTitle>
                {conflicting.length ? `Contiene ${conflicting.map(allergenLabel).join(", ").toLowerCase()}, que marcaste en tu objetivo` : "Alérgenos"}
              </AlertTitle>
              <AlertDescription>
                <p>Contiene: {card.allergens.map(allergenLabel).join(", ")}. Revisa siempre las etiquetas de lo que compras.</p>
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-sm text-muted-foreground">Sin alérgenos registrados. Igual revisa las etiquetas de lo que compras.</p>
          )}
        </div>

        <RecipeDetailView
          recipe={{ id: card.id, title: card.title, servings: card.servings, mealTypes: card.mealTypes }}
          perServing={card.perServing}
          ingredients={ingredients.map((i) => ({
            id: i.id,
            name: i.name,
            grams: i.grams,
            displayQuantity: i.displayQuantity,
            displayUnit: i.displayUnit,
            note: i.note,
          }))}
          today={ctx.today}
          maxDate={ctx.tomorrow}
          defaultMeal={ctx.defaultMeal}
          plans={plans}
          canPlan={canPlan}
        />

        <section aria-labelledby="pasos" className="flex flex-col gap-3">
          <h2 id="pasos" className="text-lg font-semibold tracking-tight">
            Preparación
          </h2>
          {steps.length ? (
            <ol className="flex flex-col gap-3">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground" aria-hidden="true">
                    {i + 1}
                  </span>
                  <p className="pt-1 leading-relaxed">
                    <span className="sr-only">Paso {i + 1}: </span>
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Esta receta aún no tiene pasos.</p>
          )}
        </section>

        <p className="text-xs text-muted-foreground">
          {card.isOfficial ? "Receta oficial. " : ""}
          {detail.reviewed ? "Revisada por el equipo." : card.isOfficial ? "Pendiente de revisión por un profesional de la nutrición." : ""} Esta información es
          orientativa y no reemplaza la indicación de un profesional de la salud.
        </p>

        {card.isOwn ? (
          <div className="flex flex-wrap gap-3 border-t border-border pt-4">
            <Button asChild variant="outline">
              <Link href={`/app/recetas/${card.slug}/editar`}>
                <Pencil aria-hidden="true" />
                Editar
              </Link>
            </Button>
            <DeleteRecipeButton recipeId={card.id} title={card.title} />
          </div>
        ) : null}
      </article>
    </>
  );
}
