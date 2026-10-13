import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app/app-header";
import { RecipeForm, type KnownFood } from "@/features/recipes/components/recipe-form";
import type { RecipeEditorValues } from "@/features/recipes/lib/editor";
import { getOwnRecipeForEdit } from "@/features/recipes/queries";
import { getRecipesPageContext } from "@/features/recipes/server/page-context";

export const metadata: Metadata = { title: "Editar receta" };

export default async function EditRecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getRecipesPageContext(`/app/recetas/${slug}/editar`);
  const data = await getOwnRecipeForEdit(ctx.supabase, ctx.user.id, slug);
  // Recetas ajenas u oficiales no se editan aquí: 404 para no revelar nada.
  if (!data) notFound();

  const v = data.values;
  const initialValues: RecipeEditorValues = {
    title: v.title,
    description: v.description ?? "",
    servings: v.servings,
    prepMinutes: v.prepMinutes,
    cookMinutes: v.cookMinutes,
    difficulty: v.difficulty ?? "",
    mealTypes: v.mealTypes,
    dietTags: v.dietTags,
    allergens: v.allergens,
    tagsText: v.tags.join(", "),
    steps: v.steps.length ? v.steps.map((text) => ({ text })) : [{ text: "" }],
    ingredients: data.ingredients.map((i) => ({
      foodId: i.foodId,
      name: i.name,
      quantity: i.displayQuantity != null && i.displayUnit ? i.displayQuantity : i.grams,
      unit: i.displayQuantity != null && i.displayUnit ? "display" : "g",
      grams: i.grams,
      displayQuantity: i.displayQuantity,
      displayUnit: i.displayUnit,
      gramsPerDisplayUnit: i.displayQuantity != null && i.displayQuantity > 0 ? i.grams / i.displayQuantity : null,
      note: i.note ?? "",
    })),
  };
  const initialFoods: Record<string, KnownFood> = Object.fromEntries(
    data.ingredients.map((i) => [i.foodId, { name: i.name, per100g: i.per100g, portions: [] }]),
  );

  return (
    <>
      <AppHeader title="Editar receta" subtitle={v.title} backHref={`/app/recetas/${data.slug}`} backLabel="Volver a la receta" />
      <div className="pt-2">
        <RecipeForm recipeId={data.id} initialValues={initialValues} initialFoods={initialFoods} wasPublished={data.status === "published"} />
      </div>
    </>
  );
}
