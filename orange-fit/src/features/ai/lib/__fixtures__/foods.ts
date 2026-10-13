/** Alimentos de prueba con la forma de GET /api/foods/search (solo para tests). */
import type { FoodPortionDto, FoodWithPortions } from "@/lib/foods/api-types";

export function testFood(overrides: Partial<FoodWithPortions> & { id: string; name: string }): FoodWithPortions {
  return {
    brandName: null,
    foodType: "generic",
    barcode: null,
    per100g: { energyKcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, fiberG: 0.4, sugarG: null, saturatedFatG: null, sodiumMg: null },
    source: "curated",
    sourceRef: null,
    verificationStatus: "verified",
    isOwn: false,
    densityGPerMl: null,
    portions: [],
    ...overrides,
  };
}

export function portion(id: string, label: string, quantity: number, unit: string, gramWeight: number, isDefault = false): FoodPortionDto {
  return { id, label, quantity, unit, gramWeight, isDefault };
}
