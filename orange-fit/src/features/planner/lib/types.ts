/**
 * Modelo del plan en edición (cliente) y su forma guardada en `meal_plans.params`.
 * Las posiciones de `meal_plan_items` codifican el hueco: `position = slotIndex × 10 + orden`.
 */
import type { PlannerRecipe } from "@/lib/nutrition";

export type SlotMealType = "breakfast" | "lunch" | "dinner" | "snack";
export type PlanStatus = "draft" | "active" | "archived";
export type PlanGenerator = "engine" | "manual";

export interface PlanSlot {
  index: number;
  mealType: SlotMealType;
  label: string;
  share: number;
}

/** Receta disponible para planificar (entrada del motor + datos para mostrarla). */
export interface PlanRecipeOption extends PlannerRecipe {
  title: string;
  slug: string;
  imageUrl: string | null;
}

export interface DraftItem {
  /** Clave estable en el cliente (el id de la BD cambia al guardar). */
  key: string;
  /** id en `meal_plan_items` si está guardado y no se modificó. */
  id: string | null;
  dayIndex: number;
  slotIndex: number;
  kind: "recipe" | "food";
  recipeId: string | null;
  foodId: string | null;
  name: string;
  slug: string | null;
  servings: number | null;
  grams: number | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** Costo referencial (solo recetas con costo en la moneda del plan). */
  cost: number | null;
}

export interface GenerationSummary {
  recipesProvided: number;
  recipesEligible: number;
  excluded: { invalid: number; allergens: number; diet: number; prepTime: number };
  repeatsRelaxed: boolean;
  warnings: string[];
}

/** Lo que se guarda en `meal_plans.params` (jsonb). */
export interface PlanParams {
  version: 1;
  seed: string | null;
  mealsPerDay: number;
  targetKcal: number | null;
  proteinG: number | null;
  targetSource: string | null;
  floorApplied: boolean;
  avoidAllergens: string[];
  dietPattern: string | null;
  weeklyBudget: number | null;
  currency: string | null;
  maxPrepMinutes: number | null;
  regenerations: number;
  generation: GenerationSummary | null;
}

export interface PlanDraft {
  id: string | null;
  name: string;
  startDate: string;
  days: number;
  generator: PlanGenerator;
  status: PlanStatus;
  params: PlanParams;
  items: DraftItem[];
}

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  draft: "Borrador",
  active: "Activo",
  archived: "Archivado",
};
