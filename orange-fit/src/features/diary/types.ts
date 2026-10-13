import type { Database } from "@/lib/db/database.types";
import type { NutrientsPer100g } from "@/lib/nutrition";

export type MealType = Database["public"]["Enums"]["meal_type"];
export type LogSource = Database["public"]["Enums"]["log_source"];

/** Porción casera de un alimento (food_portions), en el mismo formato que GET /api/foods/*. */
export type FoodPortion = {
  id: string;
  label: string;
  quantity: number;
  unit: string;
  gramWeight: number;
  isDefault: boolean;
};

/** Lo que el selector de porciones necesita de un alimento. */
export type PickerFood = {
  id: string;
  name: string;
  brandName: string | null;
  per100g: NutrientsPer100g;
  densityGPerMl: number | null;
  portions: FoodPortion[];
  provenance: string;
  isOwn: boolean;
  isFavorite?: boolean;
};

export type ItemKind = "food" | "recipe" | "manual";

export type DiaryItem = {
  id: string;
  mealLogId: string;
  kind: ItemKind;
  foodId: string | null;
  recipeId: string | null;
  recipeSlug: string | null;
  name: string;
  brandName: string | null;
  quantity: number;
  unit: string;
  grams: number | null;
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  source: LogSource;
  provenance: string;
  isEstimate: boolean;
  isAi: boolean;
  /** Datos del alimento vigente (para editar la cantidad con sus porciones); null si ya no existe. */
  food: PickerFood | null;
};

export type DiaryMeal = {
  /** null = sección estándar sin registros todavía. */
  id: string | null;
  mealType: MealType;
  customName: string | null;
  label: string;
  items: DiaryItem[];
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/** Destino elegible para mover o registrar (las 4 estándar + personalizadas del día). */
export type MealOption = { mealType: MealType; customName: string | null; label: string };

export type TemplateSummary = {
  id: string;
  name: string;
  mealType: MealType;
  itemsCount: number;
};
