import { z } from "zod";
import { FASTING_HOURS_LIMITS } from "@/lib/nutrition";
import { PROTOCOL_CODES, STARTED_AGO_OPTIONS } from "./lib/fasting-view";

export const startFastingSchema = z
  .object({
    protocol: z.enum(PROTOCOL_CODES, { error: "Elige un protocolo." }),
    customHours: z
      .number()
      .min(FASTING_HOURS_LIMITS.min, `Mínimo ${FASTING_HOURS_LIMITS.min} horas.`)
      .max(FASTING_HOURS_LIMITS.max, `Máximo ${FASTING_HOURS_LIMITS.max} horas.`)
      .nullable(),
    startedMinutesAgo: z
      .number()
      .int()
      .refine((v) => (STARTED_AGO_OPTIONS as readonly number[]).includes(v), "Elige cuándo empezaste."),
    note: z.string().trim().max(500, "Máximo 500 caracteres.").nullable(),
  })
  .refine((v) => v.protocol !== "custom" || v.customHours != null, {
    message: "Indica cuántas horas quieres ayunar.",
    path: ["customHours"],
  });
export type StartFastingInput = z.input<typeof startFastingSchema>;

export const fastingSessionIdSchema = z.uuid("Ayuno inválido.");
