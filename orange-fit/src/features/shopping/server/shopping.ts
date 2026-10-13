import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/lib/db/database.types";
import { roundDecimals, type RecipeForShopping } from "@/lib/nutrition";
import { parsePlanParams } from "@/features/planner/lib/plan";
import { buildPlanShoppingList, storedUnit, type FoodInfo, type PriceRow } from "../lib/build";
import {
  addManualItemSchema,
  toggleItemSchema,
  updateItemSchema,
  updateListSchema,
  type AddManualItemInput,
  type UpdateItemInput,
  type UpdateListInput,
} from "../schemas";

type Client = SupabaseClient<Database>;

export class ShoppingOpError extends Error {
  constructor(
    public code: "NOT_FOUND" | "VALIDATION" | "DB_ERROR" | "EMPTY",
    message: string,
  ) {
    super(message);
  }
}

const CHUNK = 150;
async function inChunks<T>(ids: string[], fetch: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) out.push(...(await fetch(ids.slice(i, i + CHUNK))));
  return out;
}

/**
 * Genera y guarda la lista de compras de un plan propio: consolida ingredientes, categoriza, pasa a
 * unidades de compra y estima con precios REFERENCIALES (los ítems sin precio quedan sin precio).
 */
export async function generateListFromPlan(
  supabase: Client,
  userId: string,
  planId: string,
): Promise<{ id: string; itemsCount: number; unpriced: number; missingRecipes: number }> {
  const [{ data: plan }, { data: profile }] = await Promise.all([
    supabase.from("meal_plans").select("id, name, days, params").eq("id", planId).eq("user_id", userId).maybeSingle(),
    supabase.from("profiles").select("currency_code").eq("id", userId).maybeSingle(),
  ]);
  if (!plan) throw new ShoppingOpError("NOT_FOUND", "No encontramos ese plan.");
  const { data: items, error: itemsError } = await supabase
    .from("meal_plan_items")
    .select("recipe_id, food_id, servings, grams")
    .eq("plan_id", plan.id)
    .eq("user_id", userId);
  if (itemsError) throw new ShoppingOpError("DB_ERROR", "No se pudieron leer las comidas del plan.");
  if (!items?.length) throw new ShoppingOpError("EMPTY", "El plan no tiene comidas: agrega alguna y vuelve a intentarlo.");

  const currency = profile?.currency_code ?? "PEN";
  const recipeIds = [...new Set(items.flatMap((i) => (i.recipe_id ? [i.recipe_id] : [])))];
  const [recipeRows, ingredientRows] = await Promise.all([
    inChunks(recipeIds, async (chunk) => (await supabase.from("recipes").select("id, servings").in("id", chunk)).data ?? []),
    inChunks(recipeIds, async (chunk) => (await supabase.from("recipe_ingredients").select("recipe_id, food_id, grams").in("recipe_id", chunk)).data ?? []),
  ]);
  const recipes = new Map<string, RecipeForShopping>();
  for (const r of recipeRows) {
    recipes.set(r.id, {
      servings: Number(r.servings),
      ingredients: ingredientRows.filter((i) => i.recipe_id === r.id).map((i) => ({ foodId: i.food_id, grams: Number(i.grams) })),
    });
  }

  const foodIds = [...new Set([...ingredientRows.map((i) => i.food_id), ...items.flatMap((i) => (i.food_id ? [i.food_id] : []))])];
  const [foodRows, portionRows, priceRows] = await Promise.all([
    inChunks(foodIds, async (chunk) => (await supabase.from("foods").select("id, name, density_g_per_ml").in("id", chunk)).data ?? []),
    inChunks(foodIds, async (chunk) => (await supabase.from("food_portions").select("food_id, label, quantity, unit, gram_weight").in("food_id", chunk)).data ?? []),
    inChunks(foodIds, async (chunk) =>
      (
        await supabase
          .from("reference_prices")
          .select("food_id, item_name, price, per_quantity, per_unit, currency_code, observed_on, source")
          .in("food_id", chunk)
      ).data ?? [],
    ),
  ]);
  const foods: FoodInfo[] = foodRows.map((f) => ({
    id: f.id,
    name: f.name,
    densityGPerMl: f.density_g_per_ml == null ? null : Number(f.density_g_per_ml),
    portions: portionRows
      .filter((p) => p.food_id === f.id)
      .map((p) => ({ label: p.label, quantity: Number(p.quantity), unit: p.unit, gramWeight: Number(p.gram_weight) })),
  }));
  const prices: PriceRow[] = priceRows.flatMap((p) =>
    p.food_id
      ? [
          {
            foodId: p.food_id,
            itemName: p.item_name,
            price: Number(p.price),
            perQuantity: Number(p.per_quantity),
            perUnit: p.per_unit,
            currencyCode: p.currency_code,
            observedOn: p.observed_on,
            source: p.source,
          },
        ]
      : [],
  );

  // Presupuesto semanal del plan (si está en la misma moneda), proporcional a sus días.
  const params = parsePlanParams(plan.params);
  const budget = params.weeklyBudget != null && params.currency === currency ? roundDecimals((params.weeklyBudget * plan.days) / 7, 2) : null;

  const list = buildPlanShoppingList({
    items: items.map((i) => ({ recipeId: i.recipe_id, foodId: i.food_id, servings: i.servings == null ? null : Number(i.servings), grams: i.grams == null ? null : Number(i.grams) })),
    recipes,
    foods,
    prices,
    currency,
    budget,
  });
  const flat = list.categories.flatMap((c) => c.items);
  if (flat.length === 0) throw new ShoppingOpError("EMPTY", "No encontramos ingredientes para este plan (sus recetas ya no están disponibles).");

  const { data: created, error } = await supabase
    .from("shopping_lists")
    .insert({ user_id: userId, meal_plan_id: plan.id, name: `Compras · ${plan.name}`.slice(0, 120), currency_code: currency, budget })
    .select("id")
    .single();
  if (error || !created) throw new ShoppingOpError("DB_ERROR", "No se pudo crear la lista.");

  const rows: TablesInsert<"shopping_list_items">[] = flat.map((it, position) => ({
    list_id: created.id,
    user_id: userId,
    food_id: it.foodId,
    name: it.name,
    category: it.category,
    quantity: it.quantity,
    unit: storedUnit(it.unit),
    estimated_price: it.estimatedPrice,
    price_source: it.estimatedPrice != null ? "reference" : null,
    position,
  }));
  const { error: itemsInsertError } = await supabase.from("shopping_list_items").insert(rows);
  if (itemsInsertError) {
    await supabase.from("shopping_lists").delete().eq("id", created.id).eq("user_id", userId);
    throw new ShoppingOpError("DB_ERROR", "No se pudieron guardar los ítems de la lista.");
  }
  return { id: created.id, itemsCount: rows.length, unpriced: list.unpriced.length, missingRecipes: list.missingRecipes.length };
}

async function ownedItem(supabase: Client, userId: string, itemId: string) {
  const { data } = await supabase.from("shopping_list_items").select("id, list_id, estimated_price, price_source").eq("id", itemId).eq("user_id", userId).maybeSingle();
  if (!data) throw new ShoppingOpError("NOT_FOUND", "Ese ítem ya no está en la lista.");
  return data;
}

export async function toggleItem(supabase: Client, userId: string, raw: { itemId: string; checked: boolean }) {
  const input = toggleItemSchema.parse(raw);
  const item = await ownedItem(supabase, userId, input.itemId);
  const { error } = await supabase.from("shopping_list_items").update({ checked: input.checked }).eq("id", item.id).eq("user_id", userId);
  if (error) throw new ShoppingOpError("DB_ERROR", "No se pudo actualizar el ítem.");
  return { listId: item.list_id };
}

export async function updateItem(supabase: Client, userId: string, raw: UpdateItemInput) {
  const input = updateItemSchema.parse(raw);
  const item = await ownedItem(supabase, userId, input.itemId);
  const priceSource = input.priceEdited ? (input.estimatedPrice == null ? null : "user") : item.price_source;
  const { error } = await supabase
    .from("shopping_list_items")
    .update({
      quantity: input.quantity,
      unit: input.unit,
      estimated_price: input.priceEdited ? input.estimatedPrice : item.estimated_price,
      price_source: priceSource,
    })
    .eq("id", item.id)
    .eq("user_id", userId);
  if (error) throw new ShoppingOpError("DB_ERROR", "No se pudo guardar el cambio.");
  return { listId: item.list_id };
}

export async function addManualItem(supabase: Client, userId: string, raw: AddManualItemInput) {
  const input = addManualItemSchema.parse(raw);
  const { data: list } = await supabase.from("shopping_lists").select("id").eq("id", input.listId).eq("user_id", userId).maybeSingle();
  if (!list) throw new ShoppingOpError("NOT_FOUND", "No encontramos esa lista.");
  const { data: last } = await supabase.from("shopping_list_items").select("position").eq("list_id", list.id).order("position", { ascending: false }).limit(1);
  const { data, error } = await supabase
    .from("shopping_list_items")
    .insert({
      list_id: list.id,
      user_id: userId,
      food_id: null,
      name: input.name,
      category: input.category,
      quantity: input.quantity,
      unit: input.unit,
      estimated_price: input.estimatedPrice,
      price_source: input.estimatedPrice == null ? null : "user",
      position: (last?.[0]?.position ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error || !data) throw new ShoppingOpError("DB_ERROR", "No se pudo agregar el ítem.");
  return { id: data.id, listId: list.id };
}

export async function deleteItem(supabase: Client, userId: string, itemId: string) {
  const item = await ownedItem(supabase, userId, itemId);
  const { error } = await supabase.from("shopping_list_items").delete().eq("id", item.id).eq("user_id", userId);
  if (error) throw new ShoppingOpError("DB_ERROR", "No se pudo quitar el ítem.");
  return { listId: item.list_id };
}

export async function updateList(supabase: Client, userId: string, raw: UpdateListInput) {
  const input = updateListSchema.parse(raw);
  const { data, error } = await supabase
    .from("shopping_lists")
    .update({ name: input.name, budget: input.budget })
    .eq("id", input.listId)
    .eq("user_id", userId)
    .select("id");
  if (error) throw new ShoppingOpError("DB_ERROR", "No se pudo guardar la lista.");
  if (!data?.length) throw new ShoppingOpError("NOT_FOUND", "No encontramos esa lista.");
}

export async function deleteList(supabase: Client, userId: string, listId: string) {
  const { data, error } = await supabase.from("shopping_lists").delete().eq("id", listId).eq("user_id", userId).select("id");
  if (error) throw new ShoppingOpError("DB_ERROR", "No se pudo eliminar la lista.");
  if (!data?.length) throw new ShoppingOpError("NOT_FOUND", "No encontramos esa lista.");
}
