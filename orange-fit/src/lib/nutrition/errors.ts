/**
 * Error de entrada del motor nutricional. El mensaje está en español y se puede mostrar
 * al usuario; `code` y `field` sirven para mapearlo a un formulario.
 */
export type NutritionErrorCode =
  | "invalid_number"
  | "out_of_range"
  | "invalid_value"
  | "invalid_date"
  | "unknown_unit"
  | "missing_density"
  | "missing_portion";

export class NutritionInputError extends Error {
  readonly code: NutritionErrorCode;
  readonly field: string;

  constructor(code: NutritionErrorCode, field: string, message: string) {
    super(message);
    this.name = "NutritionInputError";
    this.code = code;
    this.field = field;
  }
}

export const isNutritionInputError = (e: unknown): e is NutritionInputError => e instanceof NutritionInputError;
