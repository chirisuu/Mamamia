/**
 * Esquemas Zod del panel admin (compartidos cliente/servidor). Las acciones reciben los valores
 * de ENTRADA del formulario (`z.input`) y vuelven a validarlos en el servidor.
 */
import { z } from "zod";
import { PREMIUM_FEATURES } from "@/lib/billing/features";
import { isIsoDate } from "@/lib/dates";
import { ALLERGENS, DIET_TAGS, DIFFICULTIES, RECIPE_MEAL_TYPES } from "@/features/recipes/lib/labels";
import {
  AI_KINDS,
  BILLING_INTERVALS,
  CONTENT_KINDS,
  CONTENT_STATUSES,
  ERROR_STATUSES,
  FOOD_TYPES,
  GRANTABLE_ROLES,
  PRICE_UNITS,
  STAFF_FOOD_SOURCES,
  VERIFICATION_STATUSES,
} from "./lib/labels";

const id = z.uuid("Identificador inválido.");

/** Texto opcional: "" o espacios → null. Acepta null/undefined (idempotente). */
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .nullish()
    .transform((v) => (v ? v : null));

const intIn = (min: number, max: number, what: string) =>
  z
    .number({ error: `Escribe ${what}.` })
    .int("Usa un número entero.")
    .min(min, `Mínimo ${min}.`)
    .max(max, `Máximo ${max.toLocaleString("es-PE")}.`);

const currency = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Usa el código de 3 letras (PEN, USD).");

const country = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, "Usa el código de 2 letras (PE).");

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/* -------------------------------------------------------------------------- */
/* Configuración (app_settings)                                                 */
/* -------------------------------------------------------------------------- */

export const FEATURE_FLAG_KEY_RE = /^[a-z][a-z0-9_]{1,39}$/;

export const settingsSchema = z.object({
  appName: z.string().trim().min(2, "Mínimo 2 caracteres.").max(60, "Máximo 60 caracteres."),
  supportEmail: z
    .string()
    .trim()
    .max(254, "Máximo 254 caracteres.")
    .refine((v) => v === "" || z.email().safeParse(v).success, "Escribe un correo válido.")
    .nullish()
    .transform((v) => (v ? v.toLowerCase() : null)),
  defaultTrialDays: intIn(0, 90, "los días de prueba"),
  maintenanceBanner: optText(280),
  featureFlags: z
    .array(
      z.object({
        key: z
          .string()
          .trim()
          .regex(FEATURE_FLAG_KEY_RE, "Usa minúsculas, números y _ (2 a 40 caracteres, empieza con letra)."),
        enabled: z.boolean(),
      }),
    )
    .max(60, "Máximo 60 interruptores.")
    .superRefine((flags, ctx) => {
      const seen = new Set<string>();
      flags.forEach((f, index) => {
        if (seen.has(f.key)) ctx.addIssue({ code: "custom", path: [index, "key"], message: "Esta clave está repetida." });
        seen.add(f.key);
      });
    }),
});
export type SettingsInput = z.input<typeof settingsSchema>;
export type SettingsData = z.output<typeof settingsSchema>;

/* -------------------------------------------------------------------------- */
/* Planes y precios                                                             */
/* -------------------------------------------------------------------------- */

const planIdSchema = z.string().regex(/^[a-z0-9_]+$/, "Plan inválido.");
const aiLimit = intIn(0, 100_000, "el límite");

export const planSchema = z.object({
  planId: planIdSchema,
  name: z.string().trim().min(2, "Mínimo 2 caracteres.").max(60, "Máximo 60 caracteres."),
  description: optText(500),
  isActive: z.boolean(),
  sortOrder: intIn(0, 1000, "el orden"),
  premiumFeatures: z.array(z.enum(PREMIUM_FEATURES)).max(PREMIUM_FEATURES.length),
  aiLimits: z.object(Object.fromEntries(AI_KINDS.map((k) => [k, aiLimit])) as Record<(typeof AI_KINDS)[number], typeof aiLimit>),
});
export type PlanInput = z.input<typeof planSchema>;

export const planPriceSchema = z.object({
  priceId: id.nullish(),
  planId: planIdSchema,
  interval: z.enum(BILLING_INTERVALS),
  currencyCode: currency,
  amountCents: intIn(0, 100_000_000, "el monto en céntimos"),
  trialDays: intIn(0, 90, "los días de prueba"),
  stripePriceId: optText(100).refine((v) => v == null || /^price_[A-Za-z0-9]+$/.test(v), "Los precios de Stripe empiezan con price_."),
  mercadopagoPlanId: optText(100).refine((v) => v == null || /^[A-Za-z0-9_-]+$/.test(v), "Solo letras, números, - y _."),
  isActive: z.boolean(),
});
export type PlanPriceInput = z.input<typeof planPriceSchema>;

/* -------------------------------------------------------------------------- */
/* Contenidos                                                                   */
/* -------------------------------------------------------------------------- */

export const CONTENT_BODY_MAX = 50_000;

export const contentPageSchema = z.object({
  id: id.nullish(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Mínimo 2 caracteres.")
    .max(120, "Máximo 120 caracteres.")
    .regex(SLUG_RE, "Usa minúsculas, números y guiones (ej.: terminos-de-uso)."),
  title: z.string().trim().min(1, "Escribe un título.").max(200, "Máximo 200 caracteres."),
  kind: z.enum(CONTENT_KINDS),
  status: z.enum(CONTENT_STATUSES),
  sortOrder: intIn(-1000, 100_000, "el orden"),
  bodyMd: z.string().max(CONTENT_BODY_MAX, `Máximo ${CONTENT_BODY_MAX.toLocaleString("es-PE")} caracteres.`),
});
export type ContentPageInput = z.input<typeof contentPageSchema>;

export const contentStatusSchema = z.object({ id, status: z.enum(CONTENT_STATUSES) });
export const contentMoveSchema = z.object({ id, direction: z.enum(["up", "down"]) });
export const idSchema = z.object({ id });

/* -------------------------------------------------------------------------- */
/* Alimentos                                                                    */
/* -------------------------------------------------------------------------- */

const nutrient = (max: number, what: string) =>
  z
    .number({ error: `Indica ${what}.` })
    .min(0, "No puede ser negativo.")
    .max(max, `Máximo ${max.toLocaleString("es-PE")}.`);
const optNutrient = (max: number) =>
  z
    .number({ error: "Escribe un número o déjalo vacío." })
    .min(0, "No puede ser negativo.")
    .max(max, `Máximo ${max.toLocaleString("es-PE")}.`)
    .nullish()
    .transform((v) => v ?? null);

export const portionSchema = z.object({
  id: id.nullish(),
  label: z.string().trim().min(1, "Escribe la porción (ej.: 1 taza).").max(80, "Máximo 80 caracteres."),
  quantity: z.number({ error: "Indica la cantidad." }).positive("Debe ser mayor que 0.").max(10_000, "Máximo 10,000."),
  unit: z.string().trim().min(1, "Escribe la unidad.").max(30, "Máximo 30 caracteres."),
  gramWeight: z.number({ error: "Indica los gramos." }).positive("Debe ser mayor que 0.").max(10_000, "Máximo 10 kg."),
  isDefault: z.boolean(),
});
export type PortionInput = z.input<typeof portionSchema>;

export const foodSchema = z
  .object({
    id: id.nullish(),
    name: z.string().trim().min(2, "Mínimo 2 caracteres.").max(200, "Máximo 200 caracteres."),
    brandName: optText(120),
    description: optText(2000),
    foodType: z.enum(FOOD_TYPES),
    barcode: z
      .string()
      .nullish()
      .transform((v) => (v ? v.replace(/[\s-]/g, "") : null))
      .refine((v) => v == null || /^[0-9]{6,14}$/.test(v), "El código debe tener de 6 a 14 dígitos."),
    countryCodes: z.array(country).max(20, "Máximo 20 países."),
    energyKcal: nutrient(900, "las kcal por 100 g"),
    proteinG: nutrient(100, "la proteína"),
    carbsG: nutrient(100, "los carbohidratos"),
    fatG: nutrient(100, "la grasa"),
    fiberG: optNutrient(100),
    sugarG: optNutrient(100),
    saturatedFatG: optNutrient(100),
    sodiumMg: optNutrient(100_000),
    densityGPerMl: z
      .number({ error: "Escribe un número o déjalo vacío." })
      .positive("Debe ser mayor que 0.")
      .max(5, "Máximo 5 g/ml.")
      .nullish()
      .transform((v) => v ?? null),
    source: z.enum(STAFF_FOOD_SOURCES),
    sourceRef: z
      .string()
      .trim()
      .min(3, "Indica de dónde salen los valores (tabla, etiqueta, código de la fuente).")
      .max(300, "Máximo 300 caracteres."),
    sourceUrl: optText(500).refine((v) => v == null || /^https?:\/\/\S+$/.test(v), "Debe ser una URL que empiece con https://"),
    license: optText(200),
    verificationStatus: z.enum(VERIFICATION_STATUSES),
    isPublic: z.boolean(),
    portions: z.array(portionSchema).max(20, "Máximo 20 porciones."),
  })
  .superRefine((v, ctx) => {
    if (v.proteinG + v.carbsG + v.fatG > 100.5) {
      ctx.addIssue({ code: "custom", path: ["carbsG"], message: "Proteína + carbohidratos + grasa no pueden pasar de 100 g por cada 100 g." });
    }
    if (v.sugarG != null && v.sugarG > v.carbsG) {
      ctx.addIssue({ code: "custom", path: ["sugarG"], message: "El azúcar no puede ser mayor que los carbohidratos." });
    }
    if (v.saturatedFatG != null && v.saturatedFatG > v.fatG) {
      ctx.addIssue({ code: "custom", path: ["saturatedFatG"], message: "La grasa saturada no puede ser mayor que la grasa total." });
    }
    if (v.portions.filter((p) => p.isDefault).length > 1) {
      ctx.addIssue({ code: "custom", path: ["portions"], message: "Solo una porción puede ser la predeterminada." });
    }
  });
export type FoodInput = z.input<typeof foodSchema>;
export type FoodData = z.output<typeof foodSchema>;

/** Energía esperada por los macros (Atwater 4/4/9). Solo para avisar incoherencias en el formulario. */
export function atwaterKcal(v: { proteinG: number; carbsG: number; fatG: number }): number {
  return 4 * v.proteinG + 4 * v.carbsG + 9 * v.fatG;
}

export const foodVerificationSchema = z.object({ foodId: id, status: z.enum(["curated", "verified", "rejected"]) });
export type FoodVerificationInput = z.input<typeof foodVerificationSchema>;

export const mergeFoodsSchema = z
  .object({ keepId: id, dropId: id })
  .refine((v) => v.keepId !== v.dropId, { message: "Elige dos alimentos distintos.", path: ["dropId"] });

export const usdaImportSchema = z
  .object({
    mode: z.enum(["query", "ids"]),
    query: optText(100),
    fdcIds: z
      .string()
      .max(2000)
      .nullish()
      .transform((v) =>
        (v ?? "")
          .split(/[\s,;]+/)
          .filter(Boolean)
          .map((x) => Number(x)),
      )
      .refine((ids) => ids.every((n) => Number.isInteger(n) && n > 0 && n < 100_000_000), "Los FDC ID son números enteros positivos.")
      .refine((ids) => ids.length <= 50, "Máximo 50 FDC ID por importación."),
    limit: intIn(1, 50, "cuántos importar"),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "query" && (!v.query || v.query.length < 2)) {
      ctx.addIssue({ code: "custom", path: ["query"], message: "Escribe qué buscar (mínimo 2 letras, en inglés: «quinoa»)." });
    }
    if (v.mode === "ids" && v.fdcIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["fdcIds"], message: "Escribe al menos un FDC ID." });
    }
  });
export type UsdaImportInput = z.input<typeof usdaImportSchema>;

export const referencePriceSchema = z.object({
  id: id.nullish(),
  foodId: id.nullish().transform((v) => v ?? null),
  itemName: z.string().trim().min(2, "Mínimo 2 caracteres.").max(200, "Máximo 200 caracteres."),
  countryCode: country,
  currencyCode: currency,
  price: z.number({ error: "Indica el precio." }).min(0, "No puede ser negativo.").max(1_000_000, "Máximo 1,000,000."),
  perQuantity: z.number({ error: "Indica la cantidad." }).positive("Debe ser mayor que 0.").max(100_000, "Máximo 100,000."),
  perUnit: z.enum(PRICE_UNITS),
  source: z.string().trim().min(3, "Indica la fuente (mercado, tienda, fecha).").max(300, "Máximo 300 caracteres."),
  observedOn: z.string().refine(isIsoDate, "Fecha inválida."),
});
export type ReferencePriceInput = z.input<typeof referencePriceSchema>;

/* -------------------------------------------------------------------------- */
/* Recetas                                                                      */
/* -------------------------------------------------------------------------- */

export const recipeReviewSchema = z
  .object({
    recipeId: id,
    decision: z.enum(["publish", "reject"]),
    note: optText(500),
  })
  .superRefine((v, ctx) => {
    if (v.decision === "reject" && (!v.note || v.note.length < 10)) {
      ctx.addIssue({ code: "custom", path: ["note"], message: "Explica el motivo (mínimo 10 caracteres): lo verá quien la envió." });
    }
  });
export type RecipeReviewInput = z.input<typeof recipeReviewSchema>;

const minutes = z
  .number({ error: "Escribe un número de minutos." })
  .int("Usa minutos enteros.")
  .min(0, "No puede ser negativo.")
  .max(1440, "Máximo 1440 minutos.")
  .nullish()
  .transform((v) => v ?? null);

export const officialIngredientSchema = z.object({
  foodId: id,
  grams: z.number({ error: "Indica los gramos." }).positive("Debe ser mayor que 0.").max(5000, "Máximo 5 kg por ingrediente."),
  displayQuantity: z
    .number()
    .positive("Debe ser mayor que 0.")
    .max(10_000)
    .nullish()
    .transform((v) => v ?? null),
  displayUnit: optText(40),
  note: optText(300),
});
export type OfficialIngredientInput = z.input<typeof officialIngredientSchema>;

export const officialRecipeSchema = z.object({
  recipeId: id.nullish(),
  title: z.string().trim().min(3, "Mínimo 3 caracteres.").max(160, "Máximo 160 caracteres."),
  description: optText(4000),
  servings: z.number({ error: "Indica las porciones." }).min(0.5, "Mínimo 0.5 porciones.").max(50, "Máximo 50 porciones."),
  prepMinutes: minutes,
  cookMinutes: minutes,
  difficulty: z
    .enum(DIFFICULTIES)
    .nullish()
    .transform((v) => v ?? null),
  steps: z
    .array(z.string().trim().min(1, "El paso está vacío.").max(1000, "Máximo 1000 caracteres por paso."))
    .min(1, "Agrega al menos un paso.")
    .max(30, "Máximo 30 pasos."),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(40)).max(15, "Máximo 15 etiquetas."),
  dietTags: z.array(z.enum(DIET_TAGS)).max(DIET_TAGS.length),
  allergens: z.array(z.enum(ALLERGENS)).max(ALLERGENS.length),
  mealTypes: z.array(z.enum(RECIPE_MEAL_TYPES)).min(1, "Elige al menos una comida."),
  estimatedCost: z
    .number({ error: "Escribe un monto o déjalo vacío." })
    .min(0, "No puede ser negativo.")
    .max(10_000, "Máximo 10,000.")
    .nullish()
    .transform((v) => v ?? null),
  costCurrency: currency,
  status: z.enum(["draft", "published"]),
  ingredients: z.array(officialIngredientSchema).min(1, "Agrega al menos un ingrediente.").max(40, "Máximo 40 ingredientes."),
});
export type OfficialRecipeInput = z.input<typeof officialRecipeSchema>;
export type OfficialRecipeData = z.output<typeof officialRecipeSchema>;

/** Imagen ya convertida en el cliente: el servidor la vuelve a procesar con sharp. */
export const RECIPE_IMAGE_MAX_BYTES = 900 * 1024;
export const RECIPE_IMAGE_WIDTH = 1200;
export const RECIPE_IMAGE_HEIGHT = 900;

/* -------------------------------------------------------------------------- */
/* Usuarios, errores                                                            */
/* -------------------------------------------------------------------------- */

export const setUserRoleSchema = z.object({
  userId: id,
  role: z.enum(GRANTABLE_ROLES),
  grant: z.boolean(),
});
export type SetUserRoleInput = z.input<typeof setUserRoleSchema>;

export const errorStatusSchema = z.object({ id, status: z.enum(ERROR_STATUSES) });
export type ErrorStatusInput = z.input<typeof errorStatusSchema>;

/* -------------------------------------------------------------------------- */
/* Utilidades de formulario                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Para `register(..., { setValueAs })` en inputs numéricos: vacío → null, coma decimal → punto.
 * Un texto no numérico queda NaN y Zod lo rechaza con el mensaje del campo.
 */
export function numberOrNull(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value).trim().replace(",", ".");
  if (!text) return null;
  return Number(text);
}

/** "PE, us ,cl" → ["PE", "US", "CL"] */
export function parseCodes(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,;]+/)
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
}

/** Monto en soles (u otra moneda) a partir de céntimos, para la vista previa del formulario. */
export function centsToAmount(cents: number): number {
  return Math.round(cents) / 100;
}
