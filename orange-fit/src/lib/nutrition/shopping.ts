/**
 * Lista de compras: consolida los ingredientes de un plan (gramos por alimento), los agrupa por
 * categoría, los pasa a unidades de compra legibles y estima el costo con precios REFERENCIALES
 * (`reference_prices`), marcando qué ítems no tienen precio.
 */
import { NutritionInputError } from "./errors";
import { assertNonNegative, ceilTo, fmt, normalizeKey, roundDecimals } from "./math";

export type ShoppingCategory =
  | "protein"
  | "dairy"
  | "grains_tubers"
  | "legumes"
  | "fruits"
  | "vegetables"
  | "fats"
  | "other";

/** En el orden en que se muestran. */
export const SHOPPING_CATEGORIES: readonly { code: ShoppingCategory; label: string }[] = [
  { code: "protein", label: "Proteínas" },
  { code: "dairy", label: "Lácteos" },
  { code: "grains_tubers", label: "Cereales y tubérculos" },
  { code: "legumes", label: "Menestras" },
  { code: "fruits", label: "Frutas" },
  { code: "vegetables", label: "Verduras" },
  { code: "fats", label: "Grasas" },
  { code: "other", label: "Otros" },
];

const CATEGORY_ALIASES: Record<string, ShoppingCategory> = {
  protein: "protein", proteins: "protein", proteina: "protein", proteinas: "protein", carnes: "protein",
  carne: "protein", meat: "protein", pescado: "protein", pescados: "protein", huevos: "protein", aves: "protein",
  dairy: "dairy", lacteo: "dairy", lacteos: "dairy", leche: "dairy",
  grains_tubers: "grains_tubers", grains: "grains_tubers", cereales: "grains_tubers", tuberculos: "grains_tubers",
  "cereales y tuberculos": "grains_tubers", cereals: "grains_tubers", tubers: "grains_tubers",
  legumes: "legumes", menestras: "legumes", legumbres: "legumes",
  fruits: "fruits", fruit: "fruits", frutas: "fruits", fruta: "fruits",
  vegetables: "vegetables", vegetable: "vegetables", verduras: "vegetables", verdura: "vegetables", hortalizas: "vegetables",
  fats: "fats", fat: "fats", grasas: "fats", aceites: "fats", oils: "fats", "frutos secos": "fats",
  other: "other", otros: "other",
};

export function normalizeShoppingCategory(raw: string | null | undefined): ShoppingCategory {
  if (!raw) return "other";
  return CATEGORY_ALIASES[normalizeKey(raw).replace(/_/g, " ")] ?? CATEGORY_ALIASES[normalizeKey(raw)] ?? "other";
}

export interface IngredientLine {
  foodId: string;
  grams: number;
}

export interface PlanItemRef {
  recipeId?: string | null;
  foodId?: string | null;
  servings?: number | null;
  grams?: number | null;
}

export interface RecipeForShopping {
  servings: number;
  ingredients: readonly IngredientLine[];
}

/**
 * Pasa los ítems de un plan a líneas de ingredientes: receta × (porciones del plan / porciones de la receta),
 * o alimento suelto en gramos.
 */
export function ingredientsFromPlan(
  items: readonly PlanItemRef[],
  recipes: ReadonlyMap<string, RecipeForShopping> | Readonly<Record<string, RecipeForShopping>>,
): { lines: IngredientLine[]; missingRecipes: string[] } {
  const get = (id: string): RecipeForShopping | undefined => {
    if (recipes instanceof Map) return recipes.get(id);
    const record = recipes as Readonly<Record<string, RecipeForShopping>>;
    return Object.hasOwn(record, id) ? record[id] : undefined;
  };
  const lines: IngredientLine[] = [];
  const missing = new Set<string>();
  items.forEach((item, i) => {
    if (item.recipeId) {
      const recipe = get(item.recipeId);
      if (!recipe) {
        missing.add(item.recipeId);
        return;
      }
      if (!(recipe.servings > 0)) {
        throw new NutritionInputError("out_of_range", `recipes.${item.recipeId}.servings`, "Las porciones de la receta deben ser mayores que 0.");
      }
      const servings = assertNonNegative(item.servings ?? 1, `items.${i}.servings`, "Las porciones");
      const factor = servings / recipe.servings;
      for (const ing of recipe.ingredients) {
        lines.push({ foodId: ing.foodId, grams: assertNonNegative(ing.grams, `items.${i}.grams`, "Los gramos") * factor });
      }
    } else if (item.foodId) {
      lines.push({ foodId: item.foodId, grams: assertNonNegative(item.grams ?? 0, `items.${i}.grams`, "Los gramos") });
    }
  });
  return { lines, missingRecipes: [...missing] };
}

/** Suma gramos por alimento, en el orden de primera aparición. */
export function consolidateIngredients(lines: readonly IngredientLine[]): IngredientLine[] {
  const totals = new Map<string, number>();
  lines.forEach((line, i) => {
    const grams = assertNonNegative(line.grams, `lines.${i}.grams`, "Los gramos");
    totals.set(line.foodId, (totals.get(line.foodId) ?? 0) + grams);
  });
  return [...totals.entries()].map(([foodId, grams]) => ({ foodId, grams }));
}

export interface ShoppingFood {
  foodId: string;
  name: string;
  category?: string | null;
  /** Peso de una unidad (1 huevo ≈ 50 g). Si existe, se compra por unidades. */
  unitWeightG?: number | null;
  densityGPerMl?: number | null;
  /** Cómo se compra; por defecto: unidades si hay peso por unidad, si no, por peso. */
  buyAs?: "mass" | "volume" | "unit" | null;
}

export type PurchaseUnit = "g" | "kg" | "ml" | "l" | "unit";

export interface PurchaseQuantity {
  quantity: number;
  unit: PurchaseUnit;
  label: string;
}

/**
 * Cantidad de compra legible, redondeada hacia arriba (para no quedarse corto):
 * < 1000 g → decenas de g; ≥ 1 kg → décimas de kg. Igual con ml/L. Unidades enteras.
 */
export function purchaseQuantity(grams: number, food: Pick<ShoppingFood, "unitWeightG" | "densityGPerMl" | "buyAs">): PurchaseQuantity {
  assertNonNegative(grams, "grams", "Los gramos");
  const mode = food.buyAs ?? (food.unitWeightG ? "unit" : "mass");
  if (mode === "unit" && food.unitWeightG && food.unitWeightG > 0) {
    const n = Math.max(1, Math.ceil(grams / food.unitWeightG - 1e-9));
    return { quantity: n, unit: "unit", label: n === 1 ? "1 unidad" : `${n} unidades` };
  }
  if (mode === "volume" && food.densityGPerMl && food.densityGPerMl > 0) {
    const ml = grams / food.densityGPerMl;
    if (ml < 1000) {
      const q = Math.max(10, ceilTo(ml, 10));
      return { quantity: q, unit: "ml", label: `${fmt(q)} ml` };
    }
    const l = ceilTo(ml / 1000, 0.1);
    return { quantity: l, unit: "l", label: `${fmt(l, 1)} L` };
  }
  if (grams < 1000) {
    const q = Math.max(10, ceilTo(grams, 10));
    return { quantity: q, unit: "g", label: `${fmt(q)} g` };
  }
  const kg = ceilTo(grams / 1000, 0.1);
  return { quantity: kg, unit: "kg", label: `${fmt(kg, 1)} kg` };
}

/** Precio referencial (`reference_prices`): `price` por `perQuantity` `perUnit`. */
export interface ReferencePrice {
  foodId: string;
  price: number;
  perQuantity: number;
  perUnit: "kg" | "l" | "unit";
  currencyCode: string;
  observedOn?: string | null;
  source?: string | null;
}

export type PriceStatus = "priced" | "no_price" | "needs_density" | "needs_unit_weight" | "other_currency";

export interface ShoppingItem {
  foodId: string;
  name: string;
  category: ShoppingCategory;
  /** Gramos exactos del plan (1 decimal). */
  grams: number;
  quantity: number;
  unit: PurchaseUnit;
  label: string;
  estimatedPrice: number | null;
  priceStatus: PriceStatus;
  priceSource: string | null;
}

export interface ShoppingList {
  currencyCode: string;
  categories: { code: ShoppingCategory; label: string; items: ShoppingItem[] }[];
  itemsCount: number;
  /** Suma de los ítems con precio (2 decimales); null si ninguno tiene precio. */
  estimatedTotal: number | null;
  pricedCount: number;
  unpriced: { foodId: string; name: string; reason: PriceStatus }[];
  budget: number | null;
  /** null si no hay presupuesto o si el total es parcial y no lo supera. */
  overBudget: boolean | null;
  missingFoods: string[];
  notes: string[];
}

function estimate(
  grams: number,
  purchase: PurchaseQuantity,
  food: ShoppingFood,
  price: ReferencePrice | undefined,
  currency: string,
): { value: number | null; status: PriceStatus } {
  if (!price) return { value: null, status: "no_price" };
  if (price.currencyCode !== currency) return { value: null, status: "other_currency" };
  if (!(price.perQuantity > 0) || !(price.price >= 0)) return { value: null, status: "no_price" };
  const perOne = price.price / price.perQuantity;
  if (price.perUnit === "kg") return { value: perOne * (grams / 1000), status: "priced" };
  if (price.perUnit === "l") {
    if (!food.densityGPerMl || food.densityGPerMl <= 0) return { value: null, status: "needs_density" };
    return { value: perOne * (grams / food.densityGPerMl / 1000), status: "priced" };
  }
  // Precio por unidad: se compran unidades enteras.
  if (purchase.unit === "unit") return { value: perOne * purchase.quantity, status: "priced" };
  if (!food.unitWeightG || food.unitWeightG <= 0) return { value: null, status: "needs_unit_weight" };
  return { value: perOne * Math.ceil(grams / food.unitWeightG - 1e-9), status: "priced" };
}

export function buildShoppingList(input: {
  lines: readonly IngredientLine[];
  foods: readonly ShoppingFood[];
  prices?: readonly ReferencePrice[];
  currencyCode?: string;
  budget?: number | null;
}): ShoppingList {
  const currency = input.currencyCode ?? "PEN";
  const foods = new Map(input.foods.map((f) => [f.foodId, f]));
  // Precio más reciente por alimento en la moneda pedida (si no hay, el más reciente en otra).
  const prices = new Map<string, ReferencePrice>();
  for (const p of input.prices ?? []) {
    const current = prices.get(p.foodId);
    const better =
      !current ||
      (p.currencyCode === currency && current.currencyCode !== currency) ||
      (p.currencyCode === current.currencyCode && (p.observedOn ?? "") > (current.observedOn ?? ""));
    if (better) prices.set(p.foodId, p);
  }

  const grouped = new Map<ShoppingCategory, ShoppingItem[]>();
  const missingFoods: string[] = [];
  const unpriced: ShoppingList["unpriced"] = [];
  let total = 0;
  let pricedCount = 0;
  let itemsCount = 0;

  for (const line of consolidateIngredients(input.lines)) {
    if (line.grams <= 0) continue;
    const food = foods.get(line.foodId);
    if (!food) {
      missingFoods.push(line.foodId);
      continue;
    }
    const category = normalizeShoppingCategory(food.category);
    const purchase = purchaseQuantity(line.grams, food);
    const price = prices.get(line.foodId);
    const est = estimate(line.grams, purchase, food, price, currency);
    const item: ShoppingItem = {
      foodId: line.foodId,
      name: food.name,
      category,
      grams: roundDecimals(line.grams, 1),
      ...purchase,
      estimatedPrice: est.value === null ? null : roundDecimals(est.value, 2),
      priceStatus: est.status,
      priceSource: est.status === "priced" ? (price?.source ?? null) : null,
    };
    if (item.estimatedPrice !== null) {
      total += item.estimatedPrice;
      pricedCount++;
    } else {
      unpriced.push({ foodId: item.foodId, name: item.name, reason: est.status });
    }
    itemsCount++;
    grouped.set(category, [...(grouped.get(category) ?? []), item]);
  }

  const categories = SHOPPING_CATEGORIES.filter((c) => grouped.has(c.code)).map((c) => ({
    ...c,
    items: [...grouped.get(c.code)!].sort((x, y) => x.name.localeCompare(y.name, "es")),
  }));
  const estimatedTotal = pricedCount === 0 ? null : roundDecimals(total, 2);
  const budget = input.budget ?? null;
  if (budget !== null) assertNonNegative(budget, "budget", "El presupuesto");
  let overBudget: boolean | null = null;
  if (budget !== null) {
    if (estimatedTotal !== null && estimatedTotal > budget) overBudget = true;
    else if (unpriced.length === 0) overBudget = false;
  }
  const notes = ["Los precios son referenciales (no en tiempo real) y pueden variar según el mercado o la tienda."];
  if (unpriced.length > 0 && itemsCount > 0) {
    notes.push(`${unpriced.length} ítem(s) no tienen precio referencial: el total es parcial.`);
  }
  return {
    currencyCode: currency,
    categories,
    itemsCount,
    estimatedTotal,
    pricedCount,
    unpriced,
    budget,
    overBudget,
    missingFoods,
    notes,
  };
}
