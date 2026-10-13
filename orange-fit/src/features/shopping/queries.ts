import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { normalizeShoppingCategory, SHOPPING_CATEGORIES, type ShoppingCategory } from "@/lib/nutrition";
import { listTotals } from "./lib/totals";

type Client = SupabaseClient<Database>;

export interface ShoppingListSummary {
  id: string;
  name: string;
  planId: string | null;
  planName: string | null;
  currency: string;
  itemsCount: number;
  checkedCount: number;
  createdAt: string;
}

export async function listShoppingLists(supabase: Client, userId: string): Promise<ShoppingListSummary[]> {
  const { data, error } = await supabase
    .from("shopping_lists")
    .select("id, name, meal_plan_id, currency_code, created_at, meal_plans(name), shopping_list_items(checked)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`shopping_lists: ${error.code ?? "error"}`);
  return (data ?? []).map((l) => {
    const row = l as typeof l & { meal_plans: { name: string } | null; shopping_list_items: Array<{ checked: boolean }> | null };
    const items = row.shopping_list_items ?? [];
    return {
      id: l.id,
      name: l.name,
      planId: l.meal_plan_id,
      planName: row.meal_plans?.name ?? null,
      currency: l.currency_code,
      itemsCount: items.length,
      checkedCount: items.filter((i) => i.checked).length,
      createdAt: l.created_at,
    };
  });
}

export interface ShoppingItemView {
  id: string;
  foodId: string | null;
  name: string;
  category: ShoppingCategory;
  quantity: number | null;
  unit: string | null;
  checked: boolean;
  estimatedPrice: number | null;
  priceSource: "reference" | "user" | null;
  position: number;
}

export interface ShoppingListDetail {
  id: string;
  name: string;
  planId: string | null;
  planName: string | null;
  currency: string;
  budget: number | null;
  createdAt: string;
  categories: Array<{ code: ShoppingCategory; label: string; items: ShoppingItemView[] }>;
  itemsCount: number;
  total: number | null;
  unpricedCount: number;
  overBudget: boolean | null;
}

export async function getShoppingList(supabase: Client, userId: string, listId: string): Promise<ShoppingListDetail | null> {
  const { data: list, error } = await supabase
    .from("shopping_lists")
    .select("id, name, meal_plan_id, currency_code, budget, created_at, meal_plans(name)")
    .eq("id", listId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`shopping_lists: ${error.code ?? "error"}`);
  if (!list) return null;
  const { data: rows, error: itemsError } = await supabase
    .from("shopping_list_items")
    .select("id, food_id, name, category, quantity, unit, checked, estimated_price, price_source, position")
    .eq("list_id", list.id)
    .order("position", { ascending: true });
  if (itemsError) throw new Error(`shopping_list_items: ${itemsError.code ?? "error"}`);
  const items: ShoppingItemView[] = (rows ?? []).map((r) => ({
    id: r.id,
    foodId: r.food_id,
    name: r.name,
    category: normalizeShoppingCategory(r.category),
    quantity: r.quantity == null ? null : Number(r.quantity),
    unit: r.unit,
    checked: r.checked,
    estimatedPrice: r.estimated_price == null ? null : Number(r.estimated_price),
    priceSource: r.price_source === "reference" || r.price_source === "user" ? r.price_source : null,
    position: r.position,
  }));
  const budget = list.budget == null ? null : Number(list.budget);
  const categories = SHOPPING_CATEGORIES.map((c) => ({
    ...c,
    items: items.filter((i) => i.category === c.code).sort((a, b) => a.name.localeCompare(b.name, "es")),
  })).filter((c) => c.items.length > 0);
  return {
    id: list.id,
    name: list.name,
    planId: list.meal_plan_id,
    planName: (list as typeof list & { meal_plans: { name: string } | null }).meal_plans?.name ?? null,
    currency: list.currency_code,
    budget,
    createdAt: list.created_at,
    categories,
    itemsCount: items.length,
    ...listTotals(items, budget),
  };
}
