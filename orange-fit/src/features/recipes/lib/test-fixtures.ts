/** Filas de prueba para los tests de recetas (no es código de producción). */
import type { RecipeCardRow, RecipeNutritionRow } from "./adapters";
import { toRecipeCard, type RecipeCard } from "./adapters";

export function recipeRow(over: Partial<RecipeCardRow> = {}): RecipeCardRow {
  return {
    id: "r1",
    slug: "avena-con-platano",
    title: "Avena con plátano",
    description: "Rica y rápida",
    servings: 2,
    prep_minutes: 5,
    cook_minutes: 10,
    difficulty: "easy",
    image_path: null,
    tags: ["desayuno"],
    diet_tags: ["vegetarian"],
    allergens: ["gluten"],
    meal_types: ["breakfast"],
    estimated_cost: 5,
    cost_currency: "PEN",
    status: "published",
    is_public: true,
    owner_id: null,
    updated_at: "2026-10-13T00:00:00Z",
    ...over,
  };
}

export function nutritionRow(over: Partial<RecipeNutritionRow> = {}): RecipeNutritionRow {
  return {
    recipe_id: "r1",
    servings: 2,
    ingredients_count: 3,
    total_grams: 600,
    total_energy_kcal: 800,
    total_protein_g: 30,
    total_carbs_g: 120,
    total_fat_g: 20,
    total_fiber_g: 12,
    per_serving_energy_kcal: 400,
    per_serving_protein_g: 15,
    per_serving_carbs_g: 60,
    per_serving_fat_g: 10,
    per_serving_fiber_g: 6,
    per_serving_grams: 300,
    fiber_incomplete: false,
    ...over,
  };
}

export function card(over: Partial<RecipeCardRow> = {}, n: Partial<RecipeNutritionRow> = {}, userId: string | null = null): RecipeCard {
  const id = over.id ?? "r1";
  return toRecipeCard(recipeRow({ slug: id, ...over }), nutritionRow({ recipe_id: id, ...n }), userId);
}
