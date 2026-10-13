import type { Metadata } from "next";
import { AppHeader } from "@/components/app/app-header";
import { RecipeForm } from "@/features/recipes/components/recipe-form";
import { emptyEditorValues } from "@/features/recipes/lib/editor";
import { getRecipesPageContext } from "@/features/recipes/server/page-context";

export const metadata: Metadata = { title: "Nueva receta" };

export default async function NewRecipePage() {
  await getRecipesPageContext("/app/recetas/nueva");
  return (
    <>
      <AppHeader title="Nueva receta" subtitle="Calculamos su nutrición desde los ingredientes" backHref="/app/recetas" backLabel="Volver a recetas" />
      <div className="pt-2">
        <RecipeForm initialValues={emptyEditorValues()} initialFoods={{}} />
      </div>
    </>
  );
}
