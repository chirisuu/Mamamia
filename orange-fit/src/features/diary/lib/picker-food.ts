/**
 * Convierte un alimento (FoodSummary + porciones, como lo devuelven GET /api/foods/search y
 * GET /api/foods/{id}) al formato del selector de porciones. Puro: sirve en cliente y servidor.
 */
import { provenanceLabel, type FoodSummary } from "@/lib/foods/types";
import type { FoodPortion, PickerFood } from "../types";

export type ApiFood = FoodSummary & { portions?: FoodPortion[] };

export function toPickerFood(food: ApiFood, portions: FoodPortion[] = food.portions ?? [], isFavorite = false): PickerFood {
  return {
    id: food.id,
    name: food.name,
    brandName: food.brandName,
    per100g: food.per100g,
    densityGPerMl: food.densityGPerMl,
    portions,
    provenance: provenanceLabel(food),
    isOwn: food.isOwn,
    isFavorite,
  };
}
