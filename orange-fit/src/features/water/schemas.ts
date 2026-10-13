import { z } from "zod";

export const addWaterSchema = z.object({
  amountMl: z
    .number({ error: "Indica cuántos ml tomaste." })
    .int("Usa un número entero de ml.")
    .min(1, "Indica cuántos ml tomaste.")
    .max(5000, "Máximo 5000 ml por registro."),
});
export type AddWaterInput = z.infer<typeof addWaterSchema>;

export const waterLogIdSchema = z.uuid("Registro inválido.");
