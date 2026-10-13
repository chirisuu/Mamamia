import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { ALLERGENS, DECLARED_DIET_TAGS, DIFFICULTIES, RECIPE_MEAL_TYPES } from "./lib/labels";

const optionalMinutes = z
  .number({ error: "Escribe un número de minutos." })
  .int("Usa minutos enteros.")
  .min(0, "No puede ser negativo.")
  .max(1440, "Máximo 1440 minutos (24 h).")
  .nullish();

export const recipeIngredientSchema = z.object({
  foodId: z.uuid("Elige un alimento de la lista."),
  grams: z.number({ error: "Indica los gramos." }).positive("Los gramos deben ser mayores que 0.").max(5000, "Máximo 5 kg por ingrediente."),
  displayQuantity: z.number().positive().max(10000).nullish(),
  displayUnit: z.string().trim().max(40, "Máximo 40 caracteres.").nullish(),
  note: z.string().trim().max(300, "Máximo 300 caracteres.").nullish(),
});
export type RecipeIngredientInput = z.input<typeof recipeIngredientSchema>;

/** Receta propia. `intent`: guardar como borrador o enviar a revisión (publicar es del staff). */
export const recipeFormSchema = z.object({
  title: z.string().trim().min(3, "Escribe un título (mínimo 3 caracteres).").max(160, "Máximo 160 caracteres."),
  description: z.string().trim().max(4000, "Máximo 4000 caracteres.").nullish(),
  servings: z.number({ error: "Indica las porciones." }).min(1, "Mínimo 1 porción.").max(50, "Máximo 50 porciones."),
  prepMinutes: optionalMinutes,
  cookMinutes: optionalMinutes,
  difficulty: z.enum(DIFFICULTIES).nullish(),
  steps: z
    .array(z.string().trim().min(1, "El paso está vacío.").max(1000, "Máximo 1000 caracteres por paso."))
    .max(30, "Máximo 30 pasos."),
  tags: z.array(z.string().trim().min(1).max(40)).max(15, "Máximo 15 etiquetas."),
  dietTags: z.array(z.enum(DECLARED_DIET_TAGS)).max(3),
  allergens: z.array(z.enum(ALLERGENS)).max(ALLERGENS.length),
  mealTypes: z.array(z.enum(RECIPE_MEAL_TYPES)).min(1, "Elige al menos una comida."),
  ingredients: z.array(recipeIngredientSchema).min(1, "Agrega al menos un ingrediente.").max(40, "Máximo 40 ingredientes."),
  intent: z.enum(["draft", "review"]),
});
export type RecipeFormInput = z.input<typeof recipeFormSchema>;
export type RecipeFormData = z.output<typeof recipeFormSchema>;

export const saveRecipeSchema = recipeFormSchema.extend({ recipeId: z.uuid().nullish() });
export type SaveRecipeInput = z.input<typeof saveRecipeSchema>;

export const recipeIdSchema = z.object({ recipeId: z.uuid() });

export const favoriteRecipeSchema = z.object({ recipeId: z.uuid(), favorite: z.boolean() });
export type FavoriteRecipeInput = z.input<typeof favoriteRecipeSchema>;

export const LOG_MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

/** Registrar una receta en el diario (los nutrientes los calcula el servidor). */
export const logRecipeSchema = z.object({
  recipeId: z.uuid(),
  localDate: z.string().refine(isIsoDate, "Fecha inválida."),
  mealType: z.enum(LOG_MEAL_TYPES),
  servings: z.number({ error: "Indica las porciones." }).min(0.25, "Mínimo 0.25 porciones.").max(20, "Máximo 20 porciones."),
});
export type LogRecipeInput = z.input<typeof logRecipeSchema>;
