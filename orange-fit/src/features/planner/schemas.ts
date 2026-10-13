import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { DIET_PATTERNS } from "@/lib/nutrition";
import { MAX_ITEMS_PER_SLOT, MAX_PLAN_DAYS } from "./lib/plan";

const isoDate = z.string().refine(isIsoDate, "Fecha inválida.");
const slotMealType = z.enum(["breakfast", "lunch", "dinner", "snack"]);

export const planItemInputSchema = z
  .object({
    dayIndex: z.number().int().min(0).max(MAX_PLAN_DAYS - 1),
    slotIndex: z.number().int().min(0).max(4),
    mealType: slotMealType,
    recipeId: z.uuid().nullish(),
    foodId: z.uuid().nullish(),
    servings: z.number().min(0.25).max(10).nullish(),
    grams: z.number().positive().max(5000).nullish(),
  })
  .refine((v) => (v.recipeId ? !v.foodId && v.servings != null : Boolean(v.foodId) && v.grams != null), {
    message: "Cada comida del plan es una receta (con porciones) o un alimento (con gramos).",
  });
export type PlanItemInput = z.input<typeof planItemInputSchema>;

export const generationSummarySchema = z.object({
  recipesProvided: z.number().int().min(0),
  recipesEligible: z.number().int().min(0),
  excluded: z.object({
    invalid: z.number().int().min(0),
    allergens: z.number().int().min(0),
    diet: z.number().int().min(0),
    prepTime: z.number().int().min(0),
  }),
  repeatsRelaxed: z.boolean(),
  warnings: z.array(z.string().max(500)).max(20),
});

export const planParamsSchema = z.object({
  version: z.literal(1),
  seed: z.string().max(80).nullable(),
  mealsPerDay: z.number().int().min(3).max(5),
  targetKcal: z.number().min(500).max(10000).nullable(),
  proteinG: z.number().min(0).max(1000).nullable(),
  targetSource: z.string().max(40).nullable(),
  floorApplied: z.boolean(),
  avoidAllergens: z.array(z.string().max(40)).max(20),
  dietPattern: z.enum(DIET_PATTERNS).nullable(),
  weeklyBudget: z.number().min(0).max(1_000_000).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  maxPrepMinutes: z.number().int().min(1).max(1440).nullable(),
  regenerations: z.number().int().min(0).max(100000),
  generation: generationSummarySchema.nullable(),
});

export const savePlanSchema = z
  .object({
    planId: z.uuid().nullish(),
    name: z.string().trim().min(1, "Ponle un nombre al plan.").max(120, "Máximo 120 caracteres."),
    startDate: isoDate,
    days: z.number().int().min(1).max(MAX_PLAN_DAYS),
    generator: z.enum(["engine", "manual"]),
    params: planParamsSchema,
    items: z.array(planItemInputSchema).max(MAX_PLAN_DAYS * 5 * MAX_ITEMS_PER_SLOT),
  })
  .refine((v) => v.items.every((it) => it.dayIndex < v.days), { message: "Hay comidas fuera de los días del plan.", path: ["items"] });
export type SavePlanInput = z.input<typeof savePlanSchema>;
export type SavePlanData = z.output<typeof savePlanSchema>;

export const planIdSchema = z.object({ planId: z.uuid() });

export const planStatusSchema = z.object({ planId: z.uuid(), status: z.enum(["draft", "active", "archived"]) });
export type PlanStatusInput = z.input<typeof planStatusSchema>;

export const sharePlanSchema = z.object({
  planId: z.uuid(),
  // Consentimiento explícito: sin esta marca no se genera el enlace.
  consent: z.literal(true, { error: "Confirma que entiendes quién podrá ver el plan." }),
});

export const addRecipeToPlanSchema = z.object({
  planId: z.uuid(),
  recipeId: z.uuid(),
  dayIndex: z.number().int().min(0).max(MAX_PLAN_DAYS - 1),
  slotIndex: z.number().int().min(0).max(4),
  servings: z.number().min(0.25).max(10),
});
export type AddRecipeToPlanInput = z.input<typeof addRecipeToPlanSchema>;

export const logPlanItemSchema = z.object({
  itemId: z.uuid(),
  localDate: isoDate,
  mealType: slotMealType,
});
export type LogPlanItemInput = z.input<typeof logPlanItemSchema>;
