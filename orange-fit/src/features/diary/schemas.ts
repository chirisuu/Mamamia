import { z } from "zod";
import { isIsoDate } from "@/lib/dates";

export const MEAL_TYPE_VALUES = ["breakfast", "lunch", "dinner", "snack", "custom"] as const;
export const LOG_SOURCE_VALUES = [
  "manual", "search", "barcode", "photo_ai", "voice_ai", "text_ai", "recipe", "plan", "template", "copy",
] as const;

export const localDateSchema = z.string().refine(isIsoDate, "Fecha inválida.");
export const mealTypeSchema = z.enum(MEAL_TYPE_VALUES);
export const logSourceSchema = z.enum(LOG_SOURCE_VALUES);

const aiMeta = {
  aiRequestId: z.uuid().optional(),
  confidence: z.number().min(0).max(1).optional(),
  isEstimate: z.boolean().optional(),
};

/**
 * Ítem a registrar. Para alimentos y recetas el cliente solo manda QUÉ y CUÁNTO;
 * los nutrientes los calcula el servidor desde la base (nunca se confía en el cliente).
 * "manual" es la excepción explícita: valores escritos por el propio usuario.
 */
export const logItemInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("food"),
    foodId: z.uuid(),
    grams: z.number().positive().max(5000),
    quantity: z.number().positive().max(10000).optional(),
    unit: z.string().trim().min(1).max(40).optional(),
    source: logSourceSchema.default("search"),
    ...aiMeta,
  }),
  z.object({
    kind: z.literal("recipe"),
    recipeId: z.uuid(),
    servings: z.number().positive().max(20),
    source: logSourceSchema.default("recipe"),
    ...aiMeta,
  }),
  z.object({
    kind: z.literal("manual"),
    name: z.string().trim().min(1).max(120),
    energyKcal: z.number().min(0).max(10000),
    proteinG: z.number().min(0).max(1000).default(0),
    carbsG: z.number().min(0).max(2000).default(0),
    fatG: z.number().min(0).max(1000).default(0),
    fiberG: z.number().min(0).max(500).optional(),
    grams: z.number().positive().max(5000).optional(),
    source: z.literal("manual").default("manual"),
  }),
]);
export type LogItemInput = z.input<typeof logItemInputSchema>;

export const addToMealSchema = z.object({
  localDate: localDateSchema,
  mealType: mealTypeSchema,
  customName: z.string().trim().min(1).max(60).nullish(),
  items: z.array(logItemInputSchema).min(1).max(30),
});
export type AddToMealInput = z.input<typeof addToMealSchema>;
