/**
 * Esquemas Zod de lo que DEVUELVE el modelo (salida estructurada). Los nombres van en snake_case
 * porque son el contrato con el modelo; el resto de la app usa camelCase tras normalizar.
 *
 * El modelo solo propone QUÉ alimento y CUÁNTO: estos esquemas no tienen ningún campo de
 * calorías ni nutrientes a propósito (los nutrientes salen siempre de la tabla `foods`).
 *
 * Los límites (min/max/longitudes) se envían al modelo como descripción y se validan al recibir;
 * los topes son holgados para no descartar una respuesta útil por un detalle, y la normalización
 * (`normalize.ts`) recorta lo que haga falta.
 */
import { z } from "zod";

export const MAX_PHOTO_ITEMS = 15;
export const MAX_TEXT_ITEMS = 20;

export const gramsRangeSchema = z
  .object({
    min: z.number().min(0).max(5000).describe("Gramos mínimos plausibles de la porción visible."),
    best: z.number().min(0).max(5000).describe("Mejor estimación en gramos."),
    max: z.number().min(0).max(5000).describe("Gramos máximos plausibles."),
  })
  .describe("Rango de gramos estimado para lo que se ve en la foto.");

export const photoItemSchema = z.object({
  name_es: z
    .string()
    .min(1)
    .max(120)
    .describe('Nombre genérico en español de Perú, útil para buscar en una base de alimentos (p. ej. "arroz blanco cocido").'),
  preparation: z
    .string()
    .max(120)
    .describe('Cómo parece estar preparado: "frito", "a la plancha", "sancochado", "crudo", "guisado", "al horno" o "no se distingue".'),
  estimated_grams: gramsRangeSchema,
  confidence: z.number().min(0).max(1).describe("Seguridad de la identificación del alimento, de 0 a 1 (no de los gramos)."),
  visible_evidence: z
    .string()
    .max(500)
    .describe("Qué se ve en la foto que respalda la identificación y el tamaño (color, textura, recipiente, referencias)."),
});

export const photoAnalysisSchema = z.object({
  is_food_image: z.boolean().describe("false si la foto no muestra comida ni bebida."),
  items: z.array(photoItemSchema).max(30).describe("Alimentos y bebidas visibles, uno por ítem. Vacío si no hay comida."),
  uncertainty_note: z
    .string()
    .max(800)
    .describe("Una o dos frases sobre lo que no se puede saber por la foto (aceite, salsas, azúcar, lo que está tapado)."),
});

export type PhotoItemOutput = z.infer<typeof photoItemSchema>;
export type PhotoAnalysisOutput = z.infer<typeof photoAnalysisSchema>;

/*
 * Los campos opcionales del contrato (grams_if_stated?, needs_clarification?,
 * clarification_question?) se expresan como `nullable` y obligatorios: la salida estructurada es
 * más fiable así, y al normalizar null equivale a "no indicado".
 */
export const textItemSchema = z.object({
  food_query: z
    .string()
    .min(1)
    .max(120)
    .describe("Nombre genérico del alimento en español, sin cantidades, para buscarlo en una base de alimentos."),
  quantity: z.number().min(0).max(10000).describe("Cantidad numérica dicha por la persona (\"media\" = 0.5). Si no la dijo, 1."),
  unit: z
    .string()
    .min(1)
    .max(60)
    .describe('Unidad como la dijo, en singular: "g", "kg", "ml", "taza", "cucharada", "unidad", "unidad pequeña", "rebanada", "vaso", "plato"…'),
  grams_if_stated: z
    .number()
    .min(0)
    .max(10000)
    .nullable()
    .describe("Gramos SOLO si la persona dijo un peso explícito (kg convertidos a g). Si no, null. Nunca estimes."),
  needs_clarification: z.boolean().nullable().describe("true si falta un dato importante para registrar bien (cantidad, tipo, preparación)."),
  clarification_question: z.string().max(300).nullable().describe("Pregunta corta y amable para aclarar. null si no hace falta."),
});

export const textParseSchema = z.object({
  items: z.array(textItemSchema).max(40).describe("Alimentos mencionados, en el orden en que aparecen. Vacío si no menciona comida."),
});

export type TextItemOutput = z.infer<typeof textItemSchema>;
export type TextParseOutput = z.infer<typeof textParseSchema>;
