/**
 * Esquemas y tipos compartidos cliente/servidor del registro con IA (foto, texto, voz).
 * Las respuestas de las rutas /api/ai/* usan estos tipos; se pueden importar desde el cliente.
 */
import { z } from "zod";
import { localDateSchema, mealTypeSchema } from "@/features/diary/schemas";
import type { FoodWithPortions } from "@/lib/foods/api-types";
import type { PhotoCandidate, TextCandidate } from "@/lib/ai/normalize";

export const AI_LOG_SOURCES = ["photo_ai", "text_ai", "voice_ai"] as const;
export type AiLogSource = (typeof AI_LOG_SOURCES)[number];

export type AiKind = "photo" | "text" | "voice" | "chat";
export type AiFeature = "ai_photo" | "ai_text" | "ai_voice" | "assistant";

/** Cada fuente de registro consume el cupo de su tipo. */
export const SOURCE_KIND: Record<AiLogSource, Exclude<AiKind, "chat">> = {
  photo_ai: "photo",
  text_ai: "text",
  voice_ai: "voice",
};

export const KIND_FEATURE: Record<AiKind, AiFeature> = {
  photo: "ai_photo",
  text: "ai_text",
  voice: "ai_voice",
  chat: "assistant",
};

export const MAX_TEXT_CHARS = 1000;

export const textRequestSchema = z.object({
  text: z
    .string()
    .trim()
    .min(3, "Escribe qué comiste (por ejemplo: «150 g de pollo y una taza de arroz»).")
    .max(MAX_TEXT_CHARS, `Máximo ${MAX_TEXT_CHARS} caracteres.`),
  /** "voice": el texto viene de un dictado (cuenta en el cupo de voz). */
  mode: z.enum(["text", "voice"]).default("text"),
});
export type TextRequestInput = z.input<typeof textRequestSchema>;

const customNameSchema = z.string().trim().min(1, "Escribe un nombre.").max(60, "Máximo 60 caracteres.");

export const confirmAiItemSchema = z.object({
  foodId: z.uuid("Elige un alimento de la base."),
  grams: z.number().positive("La cantidad debe ser mayor que 0.").max(5000, "Máximo 5 kg por alimento."),
  quantity: z.number().positive().max(10000).optional(),
  unit: z.string().trim().min(1).max(40).optional(),
  confidence: z.number().min(0).max(1).nullish(),
  /** "added": lo agregó la persona desde la búsqueda (no es una estimación de la IA). */
  origin: z.enum(["ai", "added"]).default("ai"),
});

/** Confirmación explícita de la persona: solo entonces se registra en el diario. */
export const confirmAiItemsSchema = z
  .object({
    requestId: z.uuid(),
    source: z.enum(AI_LOG_SOURCES),
    localDate: localDateSchema,
    mealType: mealTypeSchema,
    customName: customNameSchema.nullish(),
    items: z.array(confirmAiItemSchema).min(1, "Elige al menos un alimento para registrar.").max(30, "Máximo 30 alimentos a la vez."),
  })
  .refine((v) => v.mealType !== "custom" || Boolean(v.customName), {
    message: "Las comidas personalizadas necesitan un nombre.",
    path: ["customName"],
  });
export type ConfirmAiItemsInput = z.input<typeof confirmAiItemsSchema>;

/* -------------------------------------------------------------------------- */
/* Respuestas de /api/ai/*                                                     */
/* -------------------------------------------------------------------------- */

export type AiQuotaDto = { used: number; limit: number };

export type PhotoCandidateDto = PhotoCandidate & {
  key: string;
  /** Hasta 3 alimentos de la base; vacío = sin dato verificado. */
  matches: FoodWithPortions[];
};

export type PhotoAnalysisResponse = {
  requestId: string;
  isFoodImage: boolean;
  uncertaintyNote: string | null;
  candidates: PhotoCandidateDto[];
  /** null si no pidió guardarla; false si pidió y no se pudo. */
  photoSaved: boolean | null;
  quota: AiQuotaDto;
};

export type TextCandidateDto = TextCandidate & {
  key: string;
  matches: FoodWithPortions[];
};

export type TextAnalysisResponse = {
  requestId: string;
  mode: "text" | "voice";
  candidates: TextCandidateDto[];
  quota: AiQuotaDto;
};

export type TranscribeResponse = { requestId: string; text: string; quota: AiQuotaDto };

export type AiKindStatus = {
  /** El plan incluye la función. */
  included: boolean;
  used: number;
  limit: number;
};

export type AiStatusResponse = {
  configured: boolean;
  transcriptionConfigured: boolean;
  consent: boolean;
  plan: "free" | "premium";
  kinds: Record<AiKind, AiKindStatus>;
  /** Primer día del mes en curso (zona del perfil), desde el que se cuenta el cupo. */
  periodStart: string;
};

export type AiApiErrorBody = {
  error: { code: string; message: string; quota?: AiQuotaDto };
};
