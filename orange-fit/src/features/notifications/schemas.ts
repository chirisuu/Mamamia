import { z } from "zod";
import { fastingPrefsSchema, loggingPrefsSchema, waterPrefsSchema, weighInPrefsSchema } from "@/lib/notifications/prefs";

export const notificationIdSchema = z.uuid("Notificación inválida.");

/** Cambio de una sección de preferencias (se guarda junto con el resto, ya validado). */
export const prefsPatchSchema = z.discriminatedUnion("section", [
  z.object({ section: z.literal("water"), value: waterPrefsSchema }),
  z.object({ section: z.literal("logging"), value: loggingPrefsSchema }),
  z.object({ section: z.literal("weighIn"), value: weighInPrefsSchema }),
  z.object({ section: z.literal("fasting"), value: fastingPrefsSchema }),
]);
export type PrefsPatch = z.infer<typeof prefsPatchSchema>;
