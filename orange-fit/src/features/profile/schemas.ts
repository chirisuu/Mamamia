import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { SEXES } from "@/lib/nutrition";
import { emailSchema } from "@/features/auth/schemas";
import { manualTargetsSchema } from "./manual-targets";

export const profileFormSchema = z.object({
  displayName: z.string().trim().min(1, "Escribe tu nombre.").max(80, "Usa como máximo 80 caracteres."),
  birthDate: z.string().refine(isIsoDate, "Elige una fecha válida.").nullable(),
  sex: z.enum(SEXES).nullable(),
  heightCm: z.number().min(100, "Mínimo 100 cm.").max(250, "Máximo 250 cm.").nullable(),
  timezone: z.string().trim().min(1, "Elige tu zona horaria.").max(64),
  countryCode: z.string().regex(/^[A-Z]{2}$/, "Elige tu país."),
  currencyCode: z.string().regex(/^[A-Z]{3}$/, "Elige tu moneda."),
  countExerciseCalories: z.boolean(),
});
export type ProfileFormValues = z.input<typeof profileFormSchema>;

export const OPTIONAL_CONSENT_TYPES = ["ai_processing", "progress_photos", "marketing"] as const;
export const consentToggleSchema = z.object({
  type: z.enum(OPTIONAL_CONSENT_TYPES),
  granted: z.boolean(),
});

export const PROFESSIONAL_SCOPES = ["read_logs", "read_logs_write_targets"] as const;
export type ProfessionalScope = (typeof PROFESSIONAL_SCOPES)[number];
export const SCOPE_LABELS: Record<ProfessionalScope, { label: string; description: string }> = {
  read_logs: {
    label: "Solo ver",
    description: "Ve tu perfil, tu objetivo, tus metas, tus comidas y tu peso.",
  },
  read_logs_write_targets: {
    label: "Ver y ajustar metas",
    description: "Además, puede fijar tus metas de calorías y macros (verás quién las fijó).",
  },
};

export const grantAccessSchema = z.object({
  email: emailSchema,
  scope: z.enum(PROFESSIONAL_SCOPES),
});
export type GrantAccessValues = z.input<typeof grantAccessSchema>;

export const accessIdSchema = z.object({ id: z.uuid() });

export const manualTargetsActionSchema = manualTargetsSchema.extend({
  acknowledgeWarnings: z.boolean(),
});
export type ManualTargetsActionValues = z.input<typeof manualTargetsActionSchema>;

export const proposeTargetSchema = manualTargetsSchema.extend({
  patientId: z.uuid(),
  effectiveFrom: z.string().refine(isIsoDate, "Elige una fecha válida."),
  acknowledgeWarnings: z.boolean(),
});
export type ProposeTargetValues = z.input<typeof proposeTargetSchema>;
