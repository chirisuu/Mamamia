import { z } from "zod";
import { isIsoDate } from "@/lib/dates";

/** GET /api/foods/search?q=…&limit=… */
export const foodSearchQuerySchema = z.object({
  q: z
    .string({ error: "Escribe qué alimento buscas." })
    .trim()
    .min(1, "Escribe qué alimento buscas.")
    .max(80, "La búsqueda es muy larga (máximo 80 caracteres)."),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const foodIdSchema = z.uuid();

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "custom"] as const;

/** Registro desde el escáner: qué alimento, cuánto y dónde. Los nutrientes los calcula el servidor. */
export const logBarcodeFoodSchema = z
  .object({
    localDate: z.string().refine(isIsoDate, "Fecha inválida."),
    mealType: z.enum(MEAL_TYPES),
    customName: z.string().trim().min(1).max(60).nullish(),
    foodId: z.uuid(),
    grams: z.number().positive("La cantidad debe ser mayor que 0.").max(5000, "Máximo 5 kg por registro."),
    quantity: z.number().positive().max(10000).optional(),
    unit: z.string().trim().min(1).max(30).optional(),
  })
  .refine((v) => v.mealType !== "custom" || Boolean(v.customName), {
    message: "Las comidas personalizadas necesitan un nombre.",
    path: ["customName"],
  });
export type LogBarcodeFoodInput = z.input<typeof logBarcodeFoodSchema>;
