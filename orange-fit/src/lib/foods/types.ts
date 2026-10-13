import type { Database } from "@/lib/db/database.types";
import type { NutrientsPer100g } from "@/lib/nutrition";

export type FoodRow = Database["public"]["Tables"]["foods"]["Row"];

/** Lo que la UI necesita de un alimento: nombre, macros por 100 g y su procedencia. */
export type FoodSummary = {
  id: string;
  name: string;
  brandName: string | null;
  foodType: string;
  barcode: string | null;
  per100g: NutrientsPer100g;
  source: FoodRow["source"];
  sourceRef: string | null;
  verificationStatus: FoodRow["verification_status"];
  isOwn: boolean;
  densityGPerMl: number | null;
};

export function toPer100g(row: Pick<FoodRow, "energy_kcal" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g" | "sugar_g" | "saturated_fat_g" | "sodium_mg">): NutrientsPer100g {
  return {
    energyKcal: Number(row.energy_kcal),
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
    fiberG: row.fiber_g == null ? null : Number(row.fiber_g),
    sugarG: row.sugar_g == null ? null : Number(row.sugar_g),
    saturatedFatG: row.saturated_fat_g == null ? null : Number(row.saturated_fat_g),
    sodiumMg: row.sodium_mg == null ? null : Number(row.sodium_mg),
  };
}

export function toFoodSummary(row: FoodRow, userId: string | null, brandName: string | null = null): FoodSummary {
  return {
    id: row.id,
    name: row.name,
    brandName,
    foodType: row.food_type,
    barcode: row.barcode,
    per100g: toPer100g(row),
    source: row.source,
    sourceRef: row.source_ref,
    verificationStatus: row.verification_status,
    isOwn: Boolean(userId && row.created_by === userId),
    densityGPerMl: row.density_g_per_ml == null ? null : Number(row.density_g_per_ml),
  };
}

/** Texto corto de procedencia para mostrar junto a los valores. */
export function provenanceLabel(f: Pick<FoodSummary, "source" | "verificationStatus">): string {
  const origin: Record<FoodSummary["source"], string> = {
    usda: "USDA FoodData Central",
    open_food_facts: "Open Food Facts",
    curated: "Base curada",
    user: "Creado por ti",
    admin: "Equipo editorial",
  };
  const status: Record<FoodSummary["verificationStatus"], string> = {
    unverified: "pendiente de verificación",
    curated: "revisado por el equipo",
    verified: "verificado",
    rejected: "rechazado",
  };
  return `${origin[f.source]} · ${status[f.verificationStatus]}`;
}
