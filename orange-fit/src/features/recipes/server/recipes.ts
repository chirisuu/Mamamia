import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/lib/db/database.types";
import { getFoodsByIds } from "@/lib/foods/search";
import { addItemsToMeal } from "@/features/diary/server/log-items";
import { totalMinutes } from "../lib/adapters";
import { computedDietTags, liveRecipeNutrition } from "../lib/nutrition";
import { recipeSlug } from "../lib/slug";
import { favoriteRecipeSchema, logRecipeSchema, saveRecipeSchema, type FavoriteRecipeInput, type LogRecipeInput, type SaveRecipeInput } from "../schemas";

type Client = SupabaseClient<Database>;

export class RecipeOpError extends Error {
  constructor(
    public code: "NOT_FOUND" | "FORBIDDEN" | "VALIDATION" | "DB_ERROR" | "CONFLICT",
    message: string,
  ) {
    super(message);
  }
}

/**
 * Crea o actualiza una receta propia con sus ingredientes. Los alimentos deben ser visibles
 * para la persona (RLS); la nutrición la calcula la vista desde los ingredientes.
 * - `draft`: solo la ve su dueño.
 * - `review`: `pending_review` + `is_public` (pide publicarla); publicar es del staff.
 * Editar una receta publicada la devuelve a revisión (regla de la base).
 */
export async function saveRecipe(supabase: Client, userId: string, raw: SaveRecipeInput): Promise<{ id: string; slug: string; status: string }> {
  const parsed = saveRecipeSchema.safeParse(raw);
  if (!parsed.success) throw new RecipeOpError("VALIDATION", "Revisa los datos de la receta.");
  const input = parsed.data;

  const foods = await getFoodsByIds(
    supabase,
    input.ingredients.map((i) => i.foodId),
  );
  if (input.ingredients.some((i) => !foods.has(i.foodId))) {
    throw new RecipeOpError("NOT_FOUND", "Uno de los ingredientes ya no está disponible. Quítalo y vuelve a buscarlo.");
  }

  const live = liveRecipeNutrition(
    input.ingredients.map((i) => ({ grams: i.grams, per100g: foods.get(i.foodId)!.per100g })),
    input.servings,
  );
  if (!live.perServing || live.perServing.kcal <= 0) {
    throw new RecipeOpError("VALIDATION", "La receta necesita ingredientes con calorías para calcular su nutrición.");
  }
  const minutes = totalMinutes(input.prepMinutes ?? null, input.cookMinutes ?? null);
  const dietTags = [...new Set([...input.dietTags, ...computedDietTags(live.perServing, minutes)])];
  // Una receta vegana también es vegetariana.
  if (dietTags.includes("vegan") && !dietTags.includes("vegetarian")) dietTags.push("vegetarian");

  const status = input.intent === "review" ? "pending_review" : "draft";
  const fields = {
    title: input.title,
    description: input.description || null,
    servings: input.servings,
    prep_minutes: input.prepMinutes ?? null,
    cook_minutes: input.cookMinutes ?? null,
    difficulty: input.difficulty ?? null,
    steps: input.steps,
    tags: [...new Set(input.tags.map((t) => t.toLowerCase()))],
    diet_tags: dietTags,
    allergens: [...new Set(input.allergens)],
    meal_types: input.mealTypes,
    status,
    is_public: input.intent === "review",
    // Sin costo calculado para recetas propias: no se inventa (ver docs/modules/recetas.md).
    estimated_cost: null,
    cost_currency: null,
  } satisfies Partial<TablesInsert<"recipes">>;

  let recipeId: string;
  let slug: string;
  let previousIngredientIds: string[] = [];

  if (input.recipeId) {
    const { data: existing } = await supabase.from("recipes").select("id, slug, owner_id").eq("id", input.recipeId).maybeSingle();
    if (!existing || existing.owner_id !== userId) throw new RecipeOpError("NOT_FOUND", "No encontramos esa receta entre las tuyas.");
    const { error } = await supabase.from("recipes").update(fields).eq("id", existing.id).eq("owner_id", userId);
    if (error) throw new RecipeOpError("DB_ERROR", "No se pudo guardar la receta.");
    recipeId = existing.id;
    slug = existing.slug;
    const { data: old } = await supabase.from("recipe_ingredients").select("id").eq("recipe_id", recipeId);
    previousIngredientIds = (old ?? []).map((r) => r.id);
  } else {
    let created: { id: string; slug: string } | null = null;
    // Reintenta si el slug aleatorio chocara (muy improbable).
    for (let attempt = 0; attempt < 3 && !created; attempt++) {
      const { data, error } = await supabase
        .from("recipes")
        .insert({ ...fields, owner_id: userId, slug: recipeSlug(input.title), country_code: null })
        .select("id, slug")
        .single();
      if (!error) created = data;
      else if (error.code !== "23505") throw new RecipeOpError("DB_ERROR", "No se pudo crear la receta.");
    }
    if (!created) throw new RecipeOpError("CONFLICT", "No se pudo crear la receta. Inténtalo de nuevo.");
    recipeId = created.id;
    slug = created.slug;
  }

  // Primero se insertan los ingredientes nuevos y luego se borran los anteriores: si algo falla,
  // la receta no se queda vacía.
  const rows: TablesInsert<"recipe_ingredients">[] = input.ingredients.map((i, position) => ({
    recipe_id: recipeId,
    food_id: i.foodId,
    grams: i.grams,
    display_quantity: i.displayQuantity ?? null,
    display_unit: i.displayUnit || null,
    note: i.note || null,
    position,
  }));
  const { error: insError } = await supabase.from("recipe_ingredients").insert(rows);
  if (insError) {
    if (!input.recipeId) await supabase.from("recipes").delete().eq("id", recipeId).eq("owner_id", userId);
    throw new RecipeOpError("DB_ERROR", "No se pudieron guardar los ingredientes.");
  }
  if (previousIngredientIds.length) {
    const { error: delError } = await supabase.from("recipe_ingredients").delete().in("id", previousIngredientIds);
    if (delError) throw new RecipeOpError("DB_ERROR", "Se guardaron los cambios, pero no se pudieron quitar los ingredientes anteriores. Vuelve a guardar.");
  }
  return { id: recipeId, slug, status };
}

export async function deleteRecipe(supabase: Client, userId: string, recipeId: string): Promise<void> {
  const { data, error } = await supabase.from("recipes").delete().eq("id", recipeId).eq("owner_id", userId).select("id");
  if (error) throw new RecipeOpError("DB_ERROR", "No se pudo eliminar la receta.");
  if (!data?.length) throw new RecipeOpError("NOT_FOUND", "No encontramos esa receta entre las tuyas.");
}

export async function setFavoriteRecipe(supabase: Client, userId: string, raw: FavoriteRecipeInput): Promise<boolean> {
  const { recipeId, favorite } = favoriteRecipeSchema.parse(raw);
  if (favorite) {
    const { data: visible } = await supabase.from("recipes").select("id").eq("id", recipeId).maybeSingle();
    if (!visible) throw new RecipeOpError("NOT_FOUND", "La receta no está disponible.");
    const { error } = await supabase.from("user_favorites").insert({ user_id: userId, recipe_id: recipeId });
    // Ya era favorita (otra pestaña): no es un error.
    if (error && error.code !== "23505") throw new RecipeOpError("DB_ERROR", "No se pudo guardar el favorito.");
    return true;
  }
  const { error } = await supabase.from("user_favorites").delete().eq("user_id", userId).eq("recipe_id", recipeId);
  if (error) throw new RecipeOpError("DB_ERROR", "No se pudo quitar el favorito.");
  return false;
}

/** Registra porciones de una receta en el diario (nutrientes calculados en el servidor). */
export async function logRecipe(supabase: Client, userId: string, raw: LogRecipeInput) {
  const input = logRecipeSchema.parse(raw);
  return addItemsToMeal(supabase, userId, {
    localDate: input.localDate,
    mealType: input.mealType,
    items: [{ kind: "recipe", recipeId: input.recipeId, servings: input.servings, source: "recipe" }],
  });
}
