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

/* -------------------------------------------------------------------------- */
/* Operaciones del diario (editar, mover, copiar, plantillas, favoritos).       */
/* -------------------------------------------------------------------------- */

const customNameSchema = z.string().trim().min(1, "Escribe un nombre.").max(60, "Máximo 60 caracteres.");

/** Destino de una comida: tipo + nombre (solo para "custom"). */
export const mealTargetSchema = z
  .object({
    mealType: mealTypeSchema,
    customName: customNameSchema.nullish(),
  })
  .refine((v) => v.mealType !== "custom" || Boolean(v.customName), {
    message: "Las comidas personalizadas necesitan un nombre.",
    path: ["customName"],
  });

/** Registrar un alimento desde la búsqueda (o el selector de porciones). */
export const logFoodSchema = z.object({
  localDate: localDateSchema,
  mealType: mealTypeSchema,
  customName: customNameSchema.nullish(),
  foodId: z.uuid(),
  grams: z.number().positive("La cantidad debe ser mayor que 0.").max(5000, "Máximo 5 kg por registro."),
  quantity: z.number().positive().max(10000).optional(),
  unit: z.string().trim().min(1).max(30).optional(),
  source: z.enum(["search", "barcode", "manual", "plan"]).default("search"),
});
export type LogFoodInput = z.input<typeof logFoodSchema>;

/** Registro manual rápido (valores escritos por el usuario: se guardan como estimación). */
export const logManualSchema = z.object({
  localDate: localDateSchema,
  mealType: mealTypeSchema,
  customName: customNameSchema.nullish(),
  name: z.string().trim().min(1, "Escribe qué comiste.").max(120),
  energyKcal: z.number().min(0).max(10000),
  proteinG: z.number().min(0).max(1000).default(0),
  carbsG: z.number().min(0).max(2000).default(0),
  fatG: z.number().min(0).max(1000).default(0),
});
export type LogManualInput = z.input<typeof logManualSchema>;

export const itemIdSchema = z.object({ itemId: z.uuid() });

/**
 * Nueva cantidad de un ítem. Alimentos: gramos (y opcionalmente cantidad + unidad visibles).
 * Recetas: porciones. Ítems manuales: gramos o cantidad (se escalan sus propios valores).
 */
export const updateItemQuantitySchema = z
  .object({
    itemId: z.uuid(),
    grams: z.number().positive().max(5000).optional(),
    servings: z.number().positive().max(20).optional(),
    quantity: z.number().positive().max(10000).optional(),
    unit: z.string().trim().min(1).max(30).optional(),
  })
  .refine((v) => v.grams != null || v.servings != null || v.quantity != null, {
    message: "Indica la nueva cantidad.",
    path: ["grams"],
  });
export type UpdateItemQuantityInput = z.input<typeof updateItemQuantitySchema>;

export const moveItemSchema = z
  .object({
    itemId: z.uuid(),
    mealType: mealTypeSchema,
    customName: customNameSchema.nullish(),
  })
  .refine((v) => v.mealType !== "custom" || Boolean(v.customName), {
    message: "Elige la comida de destino.",
    path: ["customName"],
  });
export type MoveItemInput = z.input<typeof moveItemSchema>;

export const copyMealSchema = z.object({
  mealLogId: z.uuid(),
  targetDate: localDateSchema,
});
export type CopyMealInput = z.input<typeof copyMealSchema>;

export const mealLogIdSchema = z.object({ mealLogId: z.uuid() });

export const createCustomMealSchema = z.object({
  localDate: localDateSchema,
  name: customNameSchema,
});
export type CreateCustomMealInput = z.input<typeof createCustomMealSchema>;

export const saveTemplateSchema = z.object({
  mealLogId: z.uuid(),
  name: z.string().trim().min(1, "Ponle un nombre a la plantilla.").max(80, "Máximo 80 caracteres."),
});
export type SaveTemplateInput = z.input<typeof saveTemplateSchema>;

export const applyTemplateSchema = z.object({
  templateId: z.uuid(),
  localDate: localDateSchema,
  mealType: mealTypeSchema,
  customName: customNameSchema.nullish(),
});
export type ApplyTemplateInput = z.input<typeof applyTemplateSchema>;

export const templateIdSchema = z.object({ templateId: z.uuid() });

export const favoriteFoodSchema = z.object({ foodId: z.uuid(), favorite: z.boolean() });
export type FavoriteFoodInput = z.input<typeof favoriteFoodSchema>;

/* -------------------------------------------------------------------------- */
/* Alimentos propios (/app/alimentos).                                          */
/* -------------------------------------------------------------------------- */

export const ownFoodPortionSchema = z.object({
  label: z.string().trim().min(1, "Describe la porción.").max(60),
  quantity: z.number().positive().max(1000),
  unit: z.string().trim().min(1, "Indica la unidad.").max(30),
  gramWeight: z.number().positive("El peso debe ser mayor que 0.").max(5000),
  isDefault: z.boolean().default(false),
});

const nutrientValue = z.number().min(0, "No puede ser negativo.").max(10000);

/**
 * Alimento propio. Los valores se escriben por 100 g o por una porción de `basisGrams` g;
 * el servidor los convierte a 100 g (unidad canónica). Nunca es público.
 */
export const ownFoodSchema = z
  .object({
    name: z.string().trim().min(1, "Escribe el nombre.").max(200),
    brandName: z.string().trim().max(120).nullish(),
    barcode: z
      .string()
      .trim()
      .regex(/^[0-9]{6,14}$/, "El código debe tener entre 6 y 14 dígitos.")
      .nullish(),
    basis: z.enum(["per100g", "perPortion"]),
    basisGrams: z.number().positive().max(5000).nullish(),
    energyKcal: nutrientValue,
    proteinG: nutrientValue,
    carbsG: nutrientValue,
    fatG: nutrientValue,
    fiberG: nutrientValue.nullish(),
    sugarG: nutrientValue.nullish(),
    saturatedFatG: nutrientValue.nullish(),
    sodiumMg: z.number().min(0).max(100000).nullish(),
    portions: z.array(ownFoodPortionSchema).max(10).default([]),
  })
  .refine((v) => v.basis === "per100g" || (v.basisGrams != null && v.basisGrams > 0), {
    message: "Indica cuántos gramos pesa la porción.",
    path: ["basisGrams"],
  });
export type OwnFoodInput = z.input<typeof ownFoodSchema>;
export type OwnFoodData = z.output<typeof ownFoodSchema>;

export const ownFoodIdSchema = z.object({ foodId: z.uuid() });
