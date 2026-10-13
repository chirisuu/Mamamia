import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/lib/db/database.types";
import { offDescription, type OffMappedFood } from "./open-food-facts";
import { ensureBrand } from "./usda-core";

type Admin = SupabaseClient<Database>;

export class OffSaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OffSaveError";
  }
}

/** Porciones que vienen de la etiqueta: la porción declarada y el envase (si están en gramos). */
export function offPortions(food: OffMappedFood): Array<Omit<TablesInsert<"food_portions">, "food_id">> {
  const rows: Array<Omit<TablesInsert<"food_portions">, "food_id">> = [];
  const fmt = (g: number) => String(Number(g.toFixed(1)));
  if (food.servingGrams) {
    rows.push({ label: `1 porción (${fmt(food.servingGrams)} g)`, quantity: 1, unit: "porción", gram_weight: food.servingGrams, is_default: true });
  }
  if (food.packageGrams && food.packageGrams !== food.servingGrams) {
    rows.push({ label: `1 envase (${fmt(food.packageGrams)} g)`, quantity: 1, unit: "envase", gram_weight: food.packageGrams, is_default: false });
  }
  return rows;
}

/**
 * Guarda un producto de Open Food Facts como alimento PÚBLICO sin verificar (cliente admin: los
 * usuarios no pueden crear públicos). Si otra solicitud lo guardó al mismo tiempo, devuelve ese.
 */
export async function saveOffFood(admin: Admin, food: OffMappedFood): Promise<{ id: string; created: boolean }> {
  const existing = async () => {
    const { data } = await admin.from("foods").select("id").eq("barcode", food.barcode).eq("is_public", true).limit(1);
    return data?.[0]?.id ?? null;
  };
  const already = await existing();
  if (already) return { id: already, created: false };

  let brandId: string | null = null;
  if (food.brandName) {
    try {
      brandId = await ensureBrand(admin, food.brandName);
    } catch {
      // Sin marca no se pierde el producto: se guarda igual y el staff puede completarla.
      brandId = null;
    }
  }

  const row: TablesInsert<"foods"> = {
    name: food.name,
    brand_id: brandId,
    description: offDescription(food),
    food_type: "branded",
    barcode: food.barcode,
    energy_kcal: food.per100g.energyKcal,
    protein_g: food.per100g.proteinG,
    carbs_g: food.per100g.carbsG,
    fat_g: food.per100g.fatG,
    fiber_g: food.per100g.fiberG,
    sugar_g: food.per100g.sugarG,
    saturated_fat_g: food.per100g.saturatedFatG,
    sodium_mg: food.per100g.sodiumMg,
    source: "open_food_facts",
    source_ref: food.sourceRef,
    source_url: food.sourceUrl,
    license: food.license,
    verification_status: "unverified",
    is_public: true,
    created_by: null,
  };
  const { data, error } = await admin.from("foods").insert(row).select("id").single();
  if (error || !data) {
    if (error?.code === "23505") {
      const raced = await existing();
      if (raced) return { id: raced, created: false };
    }
    throw new OffSaveError(`foods insert: ${error?.code ?? "error"}`);
  }

  const portions = offPortions(food);
  if (portions.length) {
    const { error: pError } = await admin.from("food_portions").insert(portions.map((p) => ({ ...p, food_id: data.id })));
    // Las porciones son una ayuda: si fallan, el alimento (por 100 g) sigue siendo válido.
    if (pError) console.error("off_portions_failed", { foodId: data.id, code: pError.code });
  }
  return { id: data.id, created: true };
}
