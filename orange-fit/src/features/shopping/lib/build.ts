/**
 * Adaptadores puros para la lista de compras: filas de la base (plan, recetas, alimentos, porciones,
 * precios referenciales) → motor `shopping.ts` (consolida, categoriza, unidades de compra y costo).
 */
import {
  buildShoppingList,
  ingredientsFromPlan,
  normalizeKey,
  type PlanItemRef,
  type RecipeForShopping,
  type ReferencePrice,
  type ShoppingFood,
  type ShoppingList,
} from "@/lib/nutrition";
import { formatMoney, formatNumber } from "@/lib/format";
import { categorizeFood } from "./categorize";

export interface FoodPortionInfo {
  label: string;
  quantity: number;
  unit: string;
  gramWeight: number;
}

export interface FoodInfo {
  id: string;
  name: string;
  densityGPerMl: number | null;
  portions: FoodPortionInfo[];
}

export interface PriceRow {
  foodId: string;
  itemName: string;
  price: number;
  perQuantity: number;
  perUnit: string;
  currencyCode: string;
  observedOn: string | null;
  source: string | null;
}

/** Palabras de envase que aparecen en `reference_prices.item_name` ("Atún en agua (lata 170 g)"). */
const CONTAINERS = ["lata", "bolsa", "frasco", "bloque", "envase", "botella", "caja", "paquete", "unidad", "atado", "sobre"];

/**
 * Peso de UNA unidad de compra cuando el precio es por unidad:
 * 1) los gramos del nombre del precio ("bolsa 600 g"), que describen exactamente lo que se compra;
 * 2) una porción del alimento con la misma palabra de envase ("1 lata" = 400 g);
 * 3) la porción "unidad" del alimento. Si no hay dato, null (el motor lo marca como sin precio).
 */
export function unitWeightFromPrice(itemName: string, portions: readonly FoodPortionInfo[]): number | null {
  const name = normalizeKey(itemName);
  const container = CONTAINERS.find((c) => new RegExp(`\\b${c}\\b`).test(name));
  const byUnit = (word: string) =>
    portions.find((p) => normalizeKey(p.unit) === word && p.quantity === 1 && p.gramWeight > 0) ??
    portions.find((p) => normalizeKey(p.unit) === word && p.gramWeight > 0);
  const grams = /(\d+(?:[.,]\d+)?)\s*(kg|g)\b/.exec(name);
  if (grams) {
    const n = Number(grams[1]!.replace(",", "."));
    if (n > 0) return grams[2] === "kg" ? n * 1000 : n;
  }
  if (container) {
    const p = byUnit(container);
    if (p) return p.quantity > 0 ? p.gramWeight / p.quantity : p.gramWeight;
  }
  const unit = byUnit("unidad");
  return unit ? unit.gramWeight / (unit.quantity > 0 ? unit.quantity : 1) : null;
}

/** El precio más reciente por alimento en la moneda pedida (o, si no hay, el más reciente en otra). */
export function pickPrices(prices: readonly PriceRow[], currency: string): Map<string, PriceRow> {
  const out = new Map<string, PriceRow>();
  for (const p of prices) {
    const current = out.get(p.foodId);
    const better =
      !current ||
      (p.currencyCode === currency && current.currencyCode !== currency) ||
      (p.currencyCode === current.currencyCode && (p.observedOn ?? "") > (current.observedOn ?? ""));
    if (better) out.set(p.foodId, p);
  }
  return out;
}

/** Cómo se compra cada alimento según su precio: por unidad, por litro (con densidad) o por peso. */
export function toShoppingFood(food: FoodInfo, price: PriceRow | undefined): ShoppingFood {
  const base: ShoppingFood = { foodId: food.id, name: food.name, category: categorizeFood(food.name), densityGPerMl: food.densityGPerMl };
  if (price?.perUnit === "unit") {
    const w = unitWeightFromPrice(price.itemName, food.portions);
    return w ? { ...base, unitWeightG: w, buyAs: "unit" } : { ...base, buyAs: "mass" };
  }
  if (price?.perUnit === "l" && food.densityGPerMl && food.densityGPerMl > 0) return { ...base, buyAs: "volume" };
  return { ...base, buyAs: "mass" };
}

export function toReferencePrice(p: PriceRow): ReferencePrice | null {
  if (p.perUnit !== "kg" && p.perUnit !== "l" && p.perUnit !== "unit") return null;
  return {
    foodId: p.foodId,
    price: p.price,
    perQuantity: p.perQuantity,
    perUnit: p.perUnit,
    currencyCode: p.currencyCode,
    observedOn: p.observedOn,
    source: p.source,
  };
}

export interface PlanShoppingInput {
  items: readonly PlanItemRef[];
  recipes: ReadonlyMap<string, RecipeForShopping>;
  foods: readonly FoodInfo[];
  prices: readonly PriceRow[];
  currency: string;
  budget: number | null;
}

/** Lista de compras de un plan con el motor. */
export function buildPlanShoppingList(input: PlanShoppingInput): ShoppingList & { missingRecipes: string[] } {
  const { lines, missingRecipes } = ingredientsFromPlan(input.items, input.recipes);
  const chosen = pickPrices(input.prices, input.currency);
  const foods = input.foods.map((f) => toShoppingFood(f, chosen.get(f.id)));
  const prices = [...chosen.values()].flatMap((p) => {
    const r = toReferencePrice(p);
    return r ? [r] : [];
  });
  const list = buildShoppingList({ lines, foods, prices, currencyCode: input.currency, budget: input.budget });
  return { ...list, missingRecipes };
}

/** Unidad legible guardada en `shopping_list_items.unit`. */
export function storedUnit(unit: "g" | "kg" | "ml" | "l" | "unit"): string {
  return unit === "unit" ? "unidad" : unit === "l" ? "L" : unit;
}

export function quantityLabel(quantity: number | null, unit: string | null): string {
  if (quantity == null) return unit ?? "";
  if (unit === "unidad") return quantity === 1 ? "1 unidad" : `${formatNumber(quantity, Number.isInteger(quantity) ? 0 : 1)} unidades`;
  const decimals = Number.isInteger(quantity) ? 0 : quantity < 10 ? 1 : 0;
  return `${formatNumber(quantity, decimals)}${unit ? ` ${unit}` : ""}`;
}

export interface ShareableItem {
  name: string;
  category: string;
  quantity: number | null;
  unit: string | null;
  checked: boolean;
  estimatedPrice: number | null;
}

/** Texto para compartir la lista (WhatsApp, notas…). Los precios se aclaran como referenciales. */
export function shoppingListText(opts: {
  name: string;
  currency: string;
  categories: ReadonlyArray<{ label: string; items: readonly ShareableItem[] }>;
  total: number | null;
  partial: boolean;
}): string {
  const lines = [opts.name, ""];
  for (const cat of opts.categories) {
    if (!cat.items.length) continue;
    lines.push(cat.label.toUpperCase());
    for (const it of cat.items) {
      const qty = quantityLabel(it.quantity, it.unit);
      const price = it.estimatedPrice != null ? ` · ${formatMoney(it.estimatedPrice, opts.currency)}` : "";
      lines.push(`${it.checked ? "[x]" : "[ ]"} ${it.name}${qty ? ` — ${qty}` : ""}${price}`);
    }
    lines.push("");
  }
  if (opts.total != null) {
    lines.push(`Total referencial: ${formatMoney(opts.total, opts.currency)}${opts.partial ? " (parcial: hay ítems sin precio)" : ""}`);
    lines.push("Precios referenciales, no en tiempo real.");
  }
  return lines.join("\n").trim();
}
