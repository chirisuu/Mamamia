import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { ACTIVITY_LEVEL_CODES, DIET_PATTERNS, GOALS, HEALTH_FLAGS, NUTRITION_EXPERIENCES, SEXES } from "@/lib/nutrition";

/**
 * Respuestas del onboarding. Se validan igual en el navegador (paso a paso y al cargar el
 * borrador de localStorage) y en el servidor (completeOnboarding). Los rangos son los mismos
 * checks de la base y del motor nutricional.
 */
export const ONBOARDING_STORAGE_KEY = "orangefit:onboarding:v1";
export const ONBOARDING_DRAFT_VERSION = 1;

const tagSchema = z.string().trim().min(1).max(60);
const tagList = z
  .array(tagSchema)
  .max(20, "Agrega como máximo 20.")
  .transform((list) => [...new Set(list.map((v) => v.trim()))]);

export const answerFieldSchemas = {
  displayName: z.string().trim().min(1, "Escribe tu nombre.").max(80, "Usa como máximo 80 caracteres."),
  birthDate: z.string().refine(isIsoDate, "Elige una fecha válida."),
  sex: z.enum(SEXES, "Elige una opción."),
  heightCm: z.number("Indica tu estatura.").min(100, "La estatura mínima es 100 cm.").max(250, "La estatura máxima es 250 cm."),
  weightKg: z.number("Indica tu peso.").min(20, "El peso mínimo es 20 kg.").max(400, "El peso máximo es 400 kg."),
  targetWeightKg: z.number().min(20, "El peso mínimo es 20 kg.").max(400, "El peso máximo es 400 kg.").nullable(),
  activityLevel: z.enum(ACTIVITY_LEVEL_CODES, "Elige tu nivel de actividad."),
  trainingDaysPerWeek: z.number().int().min(0).max(14, "Como máximo 14 sesiones por semana."),
  goal: z.enum(GOALS, "Elige tu objetivo."),
  weeklyRateKg: z.number().min(0).max(2).nullable(),
  dietPattern: z.enum(DIET_PATTERNS, "Elige una opción."),
  allergies: tagList,
  intolerances: tagList,
  restrictions: tagList,
  dislikedFoods: tagList,
  countryCode: z.string().regex(/^[A-Z]{2}$/, "Elige tu país."),
  currencyCode: z.string().regex(/^[A-Z]{3}$/, "Elige tu moneda."),
  weeklyBudget: z.number().min(0).max(100_000, "El presupuesto máximo es 100,000.").nullable(),
  mealsPerDay: z.number().int().min(2, "Mínimo 2 comidas.").max(6, "Máximo 6 comidas."),
  experience: z.enum(NUTRITION_EXPERIENCES, "Elige una opción."),
  healthFlags: z.array(z.enum(HEALTH_FLAGS)).max(HEALTH_FLAGS.length).transform((l) => [...new Set(l)]),
} as const;

export const answersSchema = z.object(answerFieldSchemas);

export type OnboardingAnswers = z.output<typeof answersSchema>;
export type AnswerKey = keyof OnboardingAnswers;
export type DraftAnswers = Partial<OnboardingAnswers>;

export const consentsSchema = z.object({
  termsPrivacy: z.boolean().refine((v) => v, "Debes aceptar los términos y la política de privacidad."),
  healthData: z.boolean().refine((v) => v, "Sin este permiso no podemos guardar tus datos de salud ni tu plan."),
  aiProcessing: z.boolean(),
  marketing: z.boolean(),
});
export type OnboardingConsents = z.output<typeof consentsSchema>;

export const EMPTY_CONSENTS = { termsPrivacy: false, healthData: false, aiProcessing: false, marketing: false } as const;

export const submissionSchema = z.object({
  answers: answersSchema,
  consents: consentsSchema,
  /** Zona del navegador; el servidor la valida y, si no sirve, usa America/Lima. */
  timezone: z.string().trim().max(64).optional(),
});
export type OnboardingSubmission = z.input<typeof submissionSchema>;

/**
 * Borrador guardado en localStorage. `stage = awaiting_account` significa que la persona terminó
 * sin sesión y fue a crear su cuenta: al volver con sesión, /onboarding lo guarda solo.
 */
export type OnboardingDraft = {
  version: typeof ONBOARDING_DRAFT_VERSION;
  answers: DraftAnswers;
  consents: { termsPrivacy: boolean; healthData: boolean; aiProcessing: boolean; marketing: boolean };
  stepId: string | null;
  stage: "in_progress" | "awaiting_account";
  updatedAt: string;
};

/** Valida campo por campo: lo que no sirve se descarta sin perder el resto del borrador. */
export function sanitizeDraftAnswers(raw: unknown): DraftAnswers {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(answerFieldSchemas)) {
    const value = (raw as Record<string, unknown>)[key];
    if (value === undefined) continue;
    const parsed = (schema as z.ZodType).safeParse(value);
    if (parsed.success) out[key] = parsed.data;
  }
  return out as DraftAnswers;
}

export function parseDraft(raw: string | null): OnboardingDraft | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.version !== ONBOARDING_DRAFT_VERSION) return null;
  const c = (d.consents ?? {}) as Record<string, unknown>;
  return {
    version: ONBOARDING_DRAFT_VERSION,
    answers: sanitizeDraftAnswers(d.answers),
    consents: {
      termsPrivacy: c.termsPrivacy === true,
      healthData: c.healthData === true,
      aiProcessing: c.aiProcessing === true,
      marketing: c.marketing === true,
    },
    stepId: typeof d.stepId === "string" ? d.stepId : null,
    stage: d.stage === "awaiting_account" ? "awaiting_account" : "in_progress",
    updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : new Date(0).toISOString(),
  };
}

export function isCompleteAnswers(answers: DraftAnswers): answers is OnboardingAnswers {
  return answersSchema.safeParse(answers).success;
}
