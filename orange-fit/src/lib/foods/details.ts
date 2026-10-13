import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { FoodDetail, FoodMicronutrientDto, FoodPortionDto, FoodWithPortions } from "./api-types";
import { toFoodSummary, type FoodRow, type FoodSummary } from "./types";

type Client = SupabaseClient<Database>;
type FoodWithBrand = FoodRow & { brands: { name: string } | null };

/** Porciones de varios alimentos (la por defecto primero, luego de menor a mayor peso). RLS aplica. */
export async function getPortionsByFoodIds(supabase: Client, foodIds: string[]): Promise<Map<string, FoodPortionDto[]>> {
  const out = new Map<string, FoodPortionDto[]>();
  const ids = [...new Set(foodIds)];
  if (!ids.length) return out;
  const { data, error } = await supabase
    .from("food_portions")
    .select("id, food_id, label, quantity, unit, gram_weight, is_default")
    .in("food_id", ids)
    .order("is_default", { ascending: false })
    .order("gram_weight", { ascending: true });
  if (error) throw new Error(`food_portions: ${error.code ?? "error"}`);
  for (const row of data ?? []) {
    const list = out.get(row.food_id) ?? [];
    list.push({
      id: row.id,
      label: row.label,
      quantity: Number(row.quantity),
      unit: row.unit,
      gramWeight: Number(row.gram_weight),
      isDefault: row.is_default,
    });
    out.set(row.food_id, list);
  }
  return out;
}

/** Agrega las porciones a una lista de alimentos ya resumidos. */
export async function withPortions(supabase: Client, foods: FoodSummary[]): Promise<FoodWithPortions[]> {
  const portions = await getPortionsByFoodIds(
    supabase,
    foods.map((f) => f.id),
  );
  return foods.map((f) => ({ ...f, portions: portions.get(f.id) ?? [] }));
}

/** Micronutrientes por 100 g de un alimento, en el orden de `nutrient_definitions`. */
export async function getMicronutrients(supabase: Client, foodId: string): Promise<FoodMicronutrientDto[]> {
  const { data, error } = await supabase
    .from("food_nutrients")
    .select("nutrient_id, amount_per_100g, nutrient_definitions(code, name_es, unit)")
    .eq("food_id", foodId)
    .order("nutrient_id", { ascending: true });
  if (error) throw new Error(`food_nutrients: ${error.code ?? "error"}`);
  const out: FoodMicronutrientDto[] = [];
  for (const row of data ?? []) {
    const def = row.nutrient_definitions as { code: string; name_es: string; unit: string } | null;
    if (!def) continue;
    out.push({ code: def.code, name: def.name_es, unit: def.unit, amountPer100g: Number(row.amount_per_100g) });
  }
  return out;
}

function toDetail(row: FoodWithBrand, userId: string | null, portions: FoodPortionDto[], micronutrients: FoodMicronutrientDto[]): FoodDetail {
  const { brands, ...food } = row;
  return {
    ...toFoodSummary(food, userId, brands?.name ?? null),
    portions,
    micronutrients,
    description: food.description,
    sourceUrl: food.source_url,
    license: food.license,
  };
}

/** Detalle de un alimento visible para el usuario (públicos + propios según RLS); null si no existe. */
export async function getFoodDetail(supabase: Client, foodId: string, userId: string | null): Promise<FoodDetail | null> {
  const { data, error } = await supabase.from("foods").select("*, brands(name)").eq("id", foodId).maybeSingle();
  if (error) throw new Error(`foods: ${error.code ?? "error"}`);
  if (!data) return null;
  const [portions, micronutrients] = await Promise.all([getPortionsByFoodIds(supabase, [foodId]), getMicronutrients(supabase, foodId)]);
  return toDetail(data as FoodWithBrand, userId, portions.get(foodId) ?? [], micronutrients);
}

export type BarcodeMatch =
  | { status: "found"; food: FoodDetail; matchedCode: string }
  | { status: "rejected"; matchedCode: string }
  | { status: "none" };

/**
 * Busca un alimento por cualquiera de las variantes de su código (EAN-13/UPC-A…). Prefiere el
 * público y luego el propio; ignora los rechazados (si solo hay rechazados lo informa).
 */
export async function findFoodByBarcodes(supabase: Client, codes: string[], userId: string | null): Promise<BarcodeMatch> {
  const valid = [...new Set(codes.filter((c) => /^\d{6,14}$/.test(c)))];
  if (!valid.length) return { status: "none" };
  const { data, error } = await supabase.from("foods").select("*, brands(name)").in("barcode", valid).limit(20);
  if (error) throw new Error(`foods: ${error.code ?? "error"}`);
  const rows = (data ?? []) as FoodWithBrand[];
  if (!rows.length) return { status: "none" };
  const rank = (r: FoodWithBrand) => (r.is_public ? 0 : 1) * 100 + valid.indexOf(r.barcode ?? "");
  const usable = rows.filter((r) => r.verification_status !== "rejected").sort((a, b) => rank(a) - rank(b));
  const best = usable[0];
  if (!best) return { status: "rejected", matchedCode: rows[0].barcode ?? valid[0] };
  const [portions, micronutrients] = await Promise.all([getPortionsByFoodIds(supabase, [best.id]), getMicronutrients(supabase, best.id)]);
  return { status: "found", food: toDetail(best, userId, portions.get(best.id) ?? [], micronutrients), matchedCode: best.barcode ?? valid[0] };
}
