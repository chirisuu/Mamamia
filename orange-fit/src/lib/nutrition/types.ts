/**
 * Tipos compartidos del motor nutricional. Reflejan los enums de `docs/DATA_MODEL.md`
 * sin importar los tipos generados de la base: el motor es puro y no depende de Supabase.
 */

export const SEXES = ["male", "female"] as const;
export type Sex = (typeof SEXES)[number];

export const ACTIVITY_LEVEL_CODES = ["sedentary", "light", "moderate", "active", "very_active"] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVEL_CODES)[number];

export const GOALS = ["lose_fat", "gain_muscle", "maintain", "recomposition", "improve_habits"] as const;
export type Goal = (typeof GOALS)[number];

export const NUTRITION_EXPERIENCES = ["beginner", "intermediate", "advanced"] as const;
export type NutritionExperience = (typeof NUTRITION_EXPERIENCES)[number];

export const HEALTH_FLAGS = [
  "pregnant",
  "lactating",
  "eating_disorder_history",
  "diabetes_medication",
  "kidney_disease",
  "other_condition",
] as const;
export type HealthFlag = (typeof HEALTH_FLAGS)[number];

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "custom"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const DIET_PATTERNS = [
  "omnivore",
  "vegetarian",
  "vegan",
  "pescatarian",
  "keto",
  "low_carb",
  "high_protein",
  "mediterranean",
] as const;
export type DietPattern = (typeof DIET_PATTERNS)[number];

/** Fecha local del usuario en formato `YYYY-MM-DD` (ver `src/lib/dates.ts`). */
export type IsoDate = string;

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Desayuno",
  lunch: "Almuerzo",
  dinner: "Cena",
  snack: "Snack",
  custom: "Otra comida",
};

export const GOAL_LABELS: Record<Goal, string> = {
  lose_fat: "Perder grasa",
  gain_muscle: "Ganar músculo",
  maintain: "Mantener mi peso",
  recomposition: "Recomposición corporal",
  improve_habits: "Mejorar mis hábitos",
};

const includes = <T extends string>(list: readonly T[], value: string): value is T =>
  (list as readonly string[]).includes(value);

export const isSex = (v: string): v is Sex => includes(SEXES, v);
export const isActivityLevel = (v: string): v is ActivityLevel => includes(ACTIVITY_LEVEL_CODES, v);
export const isGoal = (v: string): v is Goal => includes(GOALS, v);
export const isHealthFlag = (v: string): v is HealthFlag => includes(HEALTH_FLAGS, v);
export const isMealType = (v: string): v is MealType => includes(MEAL_TYPES, v);
export const isDietPattern = (v: string): v is DietPattern => includes(DIET_PATTERNS, v);

/** Filtra banderas de salud desconocidas (p. ej. texto que viene de la base). */
export function parseHealthFlags(values: readonly string[] | null | undefined): HealthFlag[] {
  if (!values) return [];
  return [...new Set(values.filter(isHealthFlag))];
}
