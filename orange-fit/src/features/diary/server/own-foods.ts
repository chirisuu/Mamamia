import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/lib/db/database.types";
import { toPer100g } from "../lib/own-food";
import type { OwnFoodData } from "../schemas";
import { DiaryOpError } from "./diary-ops";

/**
 * Alimentos propios del usuario: siempre `is_public = false`, `source = 'user'` y
 * `verification_status = 'unverified'` (el RLS lo exige igual). Los nutrientes se guardan por
 * 100 g; si el usuario los escribió por porción, se convierten aquí.
 */

type Client = SupabaseClient<Database>;

export class OwnFoodError extends DiaryOpError {
  constructor(
    code: DiaryOpError["code"],
    message: string,
    public field?: string,
  ) {
    super(code, message);
    this.name = "OwnFoodError";
  }
}

/** Busca la marca por nombre normalizado (sin tildes ni mayúsculas) o la crea. */
async function resolveBrandId(supabase: Client, brandName: string | null | undefined): Promise<string | null> {
  const name = brandName?.trim();
  if (!name) return null;
  const { data: normalized, error: normError } = await supabase.rpc("normalize_text", { value: name });
  if (normError) throw new OwnFoodError("DB_ERROR", "No se pudo guardar la marca.");
  const find = async () => {
    const { data } = await supabase.from("brands").select("id").eq("name_normalized", normalized ?? "").maybeSingle();
    return data?.id ?? null;
  };
  const existing = await find();
  if (existing) return existing;
  const { data, error } = await supabase.from("brands").insert({ name }).select("id").single();
  if (error) {
    // Otra persona la creó al mismo tiempo.
    const again = await find();
    if (again) return again;
    throw new OwnFoodError("DB_ERROR", "No se pudo guardar la marca.");
  }
  return data.id;
}

function foodValues(data: OwnFoodData) {
  const per100 = toPer100g(data);
  if (!per100.ok) throw new OwnFoodError("VALIDATION", per100.message, per100.field);
  return per100.values;
}

function portionRows(foodId: string, data: OwnFoodData): TablesInsert<"food_portions">[] {
  let defaultTaken = false;
  return data.portions.map((p) => {
    const isDefault = p.isDefault && !defaultTaken;
    if (isDefault) defaultTaken = true;
    return {
      food_id: foodId,
      label: p.label.trim(),
      quantity: p.quantity,
      unit: p.unit.trim(),
      gram_weight: p.gramWeight,
      is_default: isDefault,
    };
  });
}

function mapFoodWriteError(error: { code?: string }): never {
  if (error.code === "23505") {
    throw new OwnFoodError("CONFLICT", "Ya tienes otro alimento con ese código de barras.", "barcode");
  }
  if (error.code === "23514") {
    throw new OwnFoodError("VALIDATION", "Algún valor está fuera de rango. Revisa los nutrientes por 100 g.");
  }
  throw new OwnFoodError("DB_ERROR", "No se pudo guardar el alimento.");
}

export async function createOwnFood(supabase: Client, userId: string, data: OwnFoodData): Promise<{ id: string }> {
  const values = foodValues(data);
  const brandId = await resolveBrandId(supabase, data.brandName);
  const { data: food, error } = await supabase
    .from("foods")
    .insert({
      name: data.name.trim(),
      brand_id: brandId,
      food_type: brandId ? "branded" : "generic",
      barcode: data.barcode?.trim() || null,
      ...values,
      source: "user",
      verification_status: "unverified",
      is_public: false,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !food) mapFoodWriteError(error ?? {});
  const portions = portionRows(food.id, data);
  if (portions.length) {
    const { error: pError } = await supabase.from("food_portions").insert(portions);
    if (pError) {
      await supabase.from("foods").delete().eq("id", food.id).eq("created_by", userId);
      throw new OwnFoodError("DB_ERROR", "No se pudieron guardar las porciones.");
    }
  }
  return { id: food.id };
}

async function assertOwnFood(supabase: Client, userId: string, foodId: string) {
  const { data, error } = await supabase
    .from("foods")
    .select("id")
    .eq("id", foodId)
    .eq("created_by", userId)
    .eq("is_public", false)
    .maybeSingle();
  if (error) throw new OwnFoodError("DB_ERROR", "No se pudo leer el alimento.");
  if (!data) throw new OwnFoodError("NOT_FOUND", "Ese alimento no existe o no es tuyo.");
}

/**
 * Actualiza el alimento y reemplaza sus porciones. Los registros ya hechos en el diario no
 * cambian: guardan una copia de los nutrientes del momento.
 */
export async function updateOwnFood(supabase: Client, userId: string, foodId: string, data: OwnFoodData): Promise<{ id: string }> {
  await assertOwnFood(supabase, userId, foodId);
  const values = foodValues(data);
  const brandId = await resolveBrandId(supabase, data.brandName);
  const { error } = await supabase
    .from("foods")
    .update({
      name: data.name.trim(),
      brand_id: brandId,
      food_type: brandId ? "branded" : "generic",
      barcode: data.barcode?.trim() || null,
      ...values,
    })
    .eq("id", foodId)
    .eq("created_by", userId);
  if (error) mapFoodWriteError(error);

  const { error: delError } = await supabase.from("food_portions").delete().eq("food_id", foodId);
  if (delError) throw new OwnFoodError("DB_ERROR", "No se pudieron actualizar las porciones.");
  const portions = portionRows(foodId, data);
  if (portions.length) {
    const { error: pError } = await supabase.from("food_portions").insert(portions);
    if (pError) throw new OwnFoodError("DB_ERROR", "No se pudieron guardar las porciones.");
  }
  return { id: foodId };
}

export async function deleteOwnFood(supabase: Client, userId: string, foodId: string): Promise<void> {
  await assertOwnFood(supabase, userId, foodId);
  const { data, error } = await supabase
    .from("foods")
    .delete()
    .eq("id", foodId)
    .eq("created_by", userId)
    .eq("is_public", false)
    .select("id");
  if (error) {
    if (error.code === "23503") {
      throw new OwnFoodError("CONFLICT", "Este alimento se usa en una receta. Quítalo de la receta antes de eliminarlo.");
    }
    throw new OwnFoodError("DB_ERROR", "No se pudo eliminar el alimento.");
  }
  if (!data?.length) throw new OwnFoodError("NOT_FOUND", "Ese alimento ya no existe.");
}
