import { z } from "zod";
import { isIsoDate } from "@/lib/dates";

export const isoDateSchema = z.string().refine(isIsoDate, "Elige una fecha válida.");

/** Método del % de grasa. Siempre se muestra como estimación no clínica. */
export const BODY_FAT_METHODS = ["bioimpedance", "skinfold", "tape", "visual", "other"] as const;
export type BodyFatMethod = (typeof BODY_FAT_METHODS)[number];
export const BODY_FAT_METHOD_LABELS: Record<BodyFatMethod, string> = {
  bioimpedance: "Balanza de bioimpedancia",
  skinfold: "Plicómetro (pliegues)",
  tape: "Cinta métrica (fórmula)",
  visual: "Estimación visual",
  other: "Otro método",
};

const decimal = (label: string, min: number, max: number, decimals: number) =>
  z
    .number({ error: `Indica ${label}.` })
    .refine(Number.isFinite, `Indica ${label}.`)
    .min(min, `Debe ser al menos ${min}.`)
    .max(max, `Debe ser como máximo ${max}.`)
    .transform((v) => Math.round(v * 10 ** decimals) / 10 ** decimals);

export const weightLogSchema = z
  .object({
    localDate: isoDateSchema,
    weightKg: decimal("tu peso", 20, 400, 2),
    bodyFatPct: decimal("el % de grasa", 2, 75, 1).nullable(),
    bodyFatMethod: z.enum(BODY_FAT_METHODS).nullable(),
    note: z.string().trim().max(500, "Máximo 500 caracteres.").nullable(),
  })
  .refine((v) => v.bodyFatPct == null || v.bodyFatMethod != null, {
    message: "Indica cómo se estimó el % de grasa.",
    path: ["bodyFatMethod"],
  });
export type WeightLogInput = z.input<typeof weightLogSchema>;

export const MEASUREMENT_FIELDS = [
  { key: "waistCm", column: "waist_cm", label: "Cintura", min: 10, max: 300 },
  { key: "hipCm", column: "hip_cm", label: "Cadera", min: 10, max: 300 },
  { key: "chestCm", column: "chest_cm", label: "Pecho", min: 10, max: 300 },
  { key: "armCm", column: "arm_cm", label: "Brazo", min: 5, max: 150 },
  { key: "thighCm", column: "thigh_cm", label: "Muslo", min: 5, max: 200 },
  { key: "calfCm", column: "calf_cm", label: "Pantorrilla", min: 5, max: 150 },
  { key: "neckCm", column: "neck_cm", label: "Cuello", min: 5, max: 100 },
] as const;
export type MeasurementKey = (typeof MEASUREMENT_FIELDS)[number]["key"];
export type MeasurementColumn = (typeof MEASUREMENT_FIELDS)[number]["column"];

const cm = (min: number, max: number) => decimal("la medida", min, max, 1).nullable();

export const measurementSchema = z
  .object({
    localDate: isoDateSchema,
    waistCm: cm(10, 300),
    hipCm: cm(10, 300),
    chestCm: cm(10, 300),
    armCm: cm(5, 150),
    thighCm: cm(5, 200),
    calfCm: cm(5, 150),
    neckCm: cm(5, 100),
    note: z.string().trim().max(500, "Máximo 500 caracteres.").nullable(),
  })
  .refine((v) => MEASUREMENT_FIELDS.some((f) => v[f.key] != null), {
    message: "Ingresa al menos una medida.",
    path: ["waistCm"],
  });
export type MeasurementInput = z.input<typeof measurementSchema>;

export const recordIdSchema = z.uuid("Registro inválido.");

/** "72,5" o "72.5" → 72.5; vacío → null; texto inválido → NaN (lo marca la validación). */
export function parseDecimalInput(raw: string): number | null {
  const v = raw.trim().replace(",", ".");
  if (v === "") return null;
  return /^\d+(\.\d+)?$/.test(v) ? Number(v) : Number.NaN;
}
