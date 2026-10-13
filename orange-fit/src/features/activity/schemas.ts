import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { DURATION_LIMITS_MIN } from "@/lib/nutrition";

/** Tope para calorías copiadas a mano de un reloj o app (por sesión). */
export const MANUAL_KCAL_MAX = 3000;

const base = {
  localDate: z.string().refine(isIsoDate, "Elige una fecha válida."),
  durationMin: z
    .number({ error: "Indica cuántos minutos." })
    .int("Usa minutos enteros.")
    .min(DURATION_LIMITS_MIN.min, `Mínimo ${DURATION_LIMITS_MIN.min} minuto.`)
    .max(DURATION_LIMITS_MIN.max, `Máximo ${DURATION_LIMITS_MIN.max} minutos.`),
  note: z.string().trim().max(500, "Máximo 500 caracteres.").nullable(),
};

export const logExerciseSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("catalog"),
    code: z.string().trim().min(1, "Elige una actividad.").max(10),
    ...base,
  }),
  z.object({
    mode: z.literal("manual"),
    name: z.string().trim().min(2, "Escribe el nombre de la actividad.").max(120, "Máximo 120 caracteres."),
    intensity: z.enum(["light", "moderate", "vigorous"], { error: "Elige la intensidad." }),
    energyKcal: z
      .number({ error: "Indica las calorías." })
      .min(0, "No puede ser negativo.")
      .max(MANUAL_KCAL_MAX, `Máximo ${MANUAL_KCAL_MAX} kcal por sesión.`),
    ...base,
  }),
]);
export type LogExerciseInput = z.input<typeof logExerciseSchema>;

export const exerciseIdSchema = z.uuid("Registro inválido.");
export const countExerciseSchema = z.boolean();
