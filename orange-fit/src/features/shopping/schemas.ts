import { z } from "zod";
import { SHOPPING_CATEGORIES } from "@/lib/nutrition";

export const SHOPPING_CATEGORY_CODES = SHOPPING_CATEGORIES.map((c) => c.code) as [string, ...string[]];
export const SHOPPING_UNITS = ["g", "kg", "ml", "L", "unidad"] as const;

export const generateListSchema = z.object({ planId: z.uuid("Elige un plan.") });

export const listIdSchema = z.object({ listId: z.uuid() });
export const itemIdSchema = z.object({ itemId: z.uuid() });

export const toggleItemSchema = z.object({ itemId: z.uuid(), checked: z.boolean() });

const money = z.number({ error: "Escribe un monto." }).min(0, "No puede ser negativo.").max(100000, "Monto demasiado alto.");

/** Editar cantidad y precio de un ítem. Un precio escrito por la persona queda como `price_source = 'user'`. */
export const updateItemSchema = z.object({
  itemId: z.uuid(),
  quantity: z.number().positive("La cantidad debe ser mayor que 0.").max(100000).nullable(),
  unit: z.enum(SHOPPING_UNITS).nullable(),
  estimatedPrice: money.nullable(),
  /** true si la persona cambió el precio (si no, se conserva el origen anterior). */
  priceEdited: z.boolean(),
});
export type UpdateItemInput = z.input<typeof updateItemSchema>;

export const addManualItemSchema = z.object({
  listId: z.uuid(),
  name: z.string().trim().min(1, "Escribe qué vas a comprar.").max(200, "Máximo 200 caracteres."),
  category: z.enum(SHOPPING_CATEGORY_CODES),
  quantity: z.number().positive("La cantidad debe ser mayor que 0.").max(100000).nullable(),
  unit: z.enum(SHOPPING_UNITS).nullable(),
  estimatedPrice: money.nullable(),
});
export type AddManualItemInput = z.input<typeof addManualItemSchema>;

export const updateListSchema = z.object({
  listId: z.uuid(),
  name: z.string().trim().min(1, "Ponle un nombre.").max(120, "Máximo 120 caracteres."),
  budget: money.nullable(),
});
export type UpdateListInput = z.input<typeof updateListSchema>;
