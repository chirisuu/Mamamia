/**
 * Formas de respuesta de GET /api/foods/* (contratos 1 y 2). Solo tipos: se pueden importar
 * desde componentes de cliente.
 */
import type { BarcodeFormat } from "./barcode";
import type { FoodSummary } from "./types";

/** Porción casera de `food_portions`. */
export type FoodPortionDto = {
  id: string;
  label: string;
  quantity: number;
  unit: string;
  gramWeight: number;
  isDefault: boolean;
};

/** Micronutriente por 100 g (`food_nutrients` + `nutrient_definitions`). */
export type FoodMicronutrientDto = {
  code: string;
  name: string;
  unit: string;
  amountPer100g: number;
};

/** Contrato 1: elemento de `foods` en GET /api/foods/search. */
export type FoodWithPortions = FoodSummary & { portions: FoodPortionDto[] };

/**
 * Contrato 2: `food` de GET /api/foods/{id}. Además de lo pactado incluye la nota de datos, la URL
 * de la fuente y la licencia (la atribución de Open Food Facts debe mostrarse).
 */
export type FoodDetail = FoodWithPortions & {
  micronutrients: FoodMicronutrientDto[];
  description: string | null;
  sourceUrl: string | null;
  license: string | null;
};

export type FoodSearchResponse = { foods: FoodWithPortions[] };
export type FoodDetailResponse = { food: FoodDetail };

/** GET /api/foods/barcode/{code} → 200. */
export type BarcodeLookupResponse = {
  food: FoodDetail;
  /** De dónde salió: ya estaba en la base o se acaba de importar de Open Food Facts. */
  origin: "database" | "open_food_facts";
  barcode: { code: string; format: BarcodeFormat };
};

/** Cuerpo de error de los route handlers (`docs/CONVENTIONS.md`). */
export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    /** Solo en 422 de código de barras: datos para precargar el alimento propio. */
    product?: { name: string | null; brandName: string | null };
  };
};
