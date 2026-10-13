import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { toFoodSummary, type FoodSummary } from "./types";

type Client = SupabaseClient<Database>;

/** Búsqueda por similitud (sin tildes, tolera errores de tipeo). Públicos + propios, según RLS. */
export async function searchFoods(supabase: Client, query: string, limit = 20): Promise<FoodSummary[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase.rpc("search_foods", { query: q, max_results: Math.min(Math.max(limit, 1), 50) });
  if (error) throw new Error(`search_foods: ${error.code ?? "error"}`);
  const rows = data ?? [];
  const brandIds = [...new Set(rows.map((r) => r.brand_id).filter((v): v is string => Boolean(v)))];
  const brands = new Map<string, string>();
  if (brandIds.length) {
    const { data: b } = await supabase.from("brands").select("id, name").in("id", brandIds);
    for (const row of b ?? []) brands.set(row.id, row.name);
  }
  return rows.map((r) => toFoodSummary(r, auth.user?.id ?? null, r.brand_id ? brands.get(r.brand_id) ?? null : null));
}

export async function getFoodsByIds(supabase: Client, ids: string[]): Promise<Map<string, FoodSummary>> {
  const unique = [...new Set(ids)];
  const out = new Map<string, FoodSummary>();
  if (!unique.length) return out;
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("foods").select("*, brands(name)").in("id", unique);
  if (error) throw new Error(`foods: ${error.code ?? "error"}`);
  for (const row of data ?? []) {
    const { brands, ...food } = row as typeof row & { brands: { name: string } | null };
    out.set(food.id, toFoodSummary(food, auth.user?.id ?? null, brands?.name ?? null));
  }
  return out;
}
