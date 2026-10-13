/**
 * Etiquetas visibles de recetas. Los códigos son los de la base (`recipes.diet_tags`,
 * `recipes.allergens`, `recipes.difficulty`, `meal_type`), iguales a los del onboarding.
 */

export const RECIPE_MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
export type RecipeMealType = (typeof RECIPE_MEAL_TYPES)[number];

export const RECIPE_MEAL_TYPE_LABELS: Record<RecipeMealType, string> = {
  breakfast: "Desayuno",
  lunch: "Almuerzo",
  dinner: "Cena",
  snack: "Snack",
};

/** Etiquetas de dieta que el usuario puede declarar (dependen de los ingredientes). */
export const DECLARED_DIET_TAGS = ["vegetarian", "vegan", "pescatarian"] as const;
/** Etiquetas que se calculan solas desde la nutrición y el tiempo (reglas de docs/DATA_SOURCES.md). */
export const COMPUTED_DIET_TAGS = ["high_protein", "low_carb", "quick"] as const;

export const DIET_TAGS = ["vegetarian", "vegan", "pescatarian", "high_protein", "low_carb", "keto", "budget", "quick", "mediterranean"] as const;
export type DietTag = (typeof DIET_TAGS)[number];

export const DIET_TAG_LABELS: Record<DietTag, string> = {
  vegetarian: "Vegetariana",
  vegan: "Vegana",
  pescatarian: "Pescetariana",
  high_protein: "Alta en proteína",
  low_carb: "Baja en carbohidratos",
  keto: "Keto",
  budget: "Económica",
  quick: "Rápida",
  mediterranean: "Mediterránea",
};

/** Filtros de dieta que se ofrecen en el catálogo (los que existen en las recetas). */
export const DIET_FILTER_OPTIONS: readonly DietTag[] = ["vegetarian", "vegan", "high_protein", "low_carb", "budget", "quick"];

export const ALLERGENS = ["gluten", "lactosa", "huevo", "pescado", "mariscos", "mani", "frutos_secos", "soya", "sesamo"] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  gluten: "Gluten",
  lactosa: "Lactosa",
  huevo: "Huevo",
  pescado: "Pescado",
  mariscos: "Mariscos",
  mani: "Maní",
  frutos_secos: "Frutos secos",
  soya: "Soya",
  sesamo: "Sésamo",
};

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Fácil",
  medium: "Media",
  hard: "Difícil",
};

export function dietTagLabel(code: string): string {
  return (DIET_TAG_LABELS as Record<string, string>)[code] ?? code;
}

export function allergenLabel(code: string): string {
  return (ALLERGEN_LABELS as Record<string, string>)[code] ?? code;
}

export function difficultyLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return (DIFFICULTY_LABELS as Record<string, string>)[code] ?? code;
}

export function mealTypeLabel(code: string): string {
  return (RECIPE_MEAL_TYPE_LABELS as Record<string, string>)[code] ?? "Otra comida";
}

export const isRecipeMealType = (v: string): v is RecipeMealType => (RECIPE_MEAL_TYPES as readonly string[]).includes(v);
export const isAllergen = (v: string): v is Allergen => (ALLERGENS as readonly string[]).includes(v);
export const isDietTag = (v: string): v is DietTag => (DIET_TAGS as readonly string[]).includes(v);
