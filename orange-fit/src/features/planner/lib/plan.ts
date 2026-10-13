/**
 * Lógica pura del planificador en la app: adapta el objetivo y las recetas al motor
 * (`generatePlan`, determinista, nunca IA), convierte el resultado en un plan editable y ofrece
 * las operaciones de edición (cambiar receta, porciones, regenerar un día). Sin I/O.
 */
import {
  clamp,
  DEFAULT_MAX_REPEATS,
  generatePlan,
  MAX_SERVINGS,
  MIN_ENERGY_KCAL,
  MIN_SERVINGS,
  mealSlots,
  normalizeKey,
  roundDecimals,
  roundTo,
  SERVINGS_STEP,
  isDietPattern,
  type MealPlan,
  type PlannerInput,
  type Sex,
} from "@/lib/nutrition";
import type { DraftItem, GenerationSummary, PlanDraft, PlanParams, PlanRecipeOption, PlanSlot, SlotMealType } from "./types";

export const MIN_PLAN_DAYS = 1;
export const MAX_PLAN_DAYS = 7;
export const SLOT_POSITION_FACTOR = 10;
export const MAX_ITEMS_PER_SLOT = SLOT_POSITION_FACTOR;

/** Comidas por día que entiende el motor (3–5). El objetivo admite 2–6: se acerca al rango. */
export function plannerMealsPerDay(goalMealsPerDay: number | null | undefined): number {
  if (goalMealsPerDay == null || !Number.isFinite(goalMealsPerDay)) return 4;
  return clamp(Math.round(goalMealsPerDay), 3, 5);
}

export function planSlots(mealsPerDay: number): PlanSlot[] {
  return mealSlots(plannerMealsPerDay(mealsPerDay)).map((s, index) => ({
    index,
    mealType: s.mealType as SlotMealType,
    label: s.label,
    share: s.share,
  }));
}

export const itemPosition = (slotIndex: number, order: number) => slotIndex * SLOT_POSITION_FACTOR + order;
export const slotFromPosition = (position: number) => Math.floor(position / SLOT_POSITION_FACTOR);

let keyCounter = 0;
/** Clave local única para un ítem nuevo del plan. */
export function newItemKey(prefix = "n"): string {
  keyCounter += 1;
  return `${prefix}${Date.now().toString(36)}${keyCounter.toString(36)}`;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/** Lee `meal_plans.params` (jsonb) de forma tolerante. */
export function parsePlanParams(raw: unknown, fallbackMealsPerDay = 4): PlanParams {
  const o = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const gen = o.generation && typeof o.generation === "object" ? (o.generation as Record<string, unknown>) : null;
  const excluded = (gen?.excluded && typeof gen.excluded === "object" ? gen.excluded : {}) as Record<string, unknown>;
  const generation: GenerationSummary | null = gen
    ? {
        recipesProvided: isNum(gen.recipesProvided) ? gen.recipesProvided : 0,
        recipesEligible: isNum(gen.recipesEligible) ? gen.recipesEligible : 0,
        excluded: {
          invalid: isNum(excluded.invalid) ? excluded.invalid : 0,
          allergens: isNum(excluded.allergens) ? excluded.allergens : 0,
          diet: isNum(excluded.diet) ? excluded.diet : 0,
          prepTime: isNum(excluded.prepTime) ? excluded.prepTime : 0,
        },
        repeatsRelaxed: gen.repeatsRelaxed === true,
        warnings: strList(gen.warnings),
      }
    : null;
  return {
    version: 1,
    seed: typeof o.seed === "string" ? o.seed : isNum(o.seed) ? String(o.seed) : null,
    mealsPerDay: plannerMealsPerDay(isNum(o.mealsPerDay) ? o.mealsPerDay : fallbackMealsPerDay),
    targetKcal: isNum(o.targetKcal) ? o.targetKcal : null,
    proteinG: isNum(o.proteinG) ? o.proteinG : null,
    targetSource: typeof o.targetSource === "string" ? o.targetSource : null,
    floorApplied: o.floorApplied === true,
    avoidAllergens: strList(o.avoidAllergens),
    dietPattern: typeof o.dietPattern === "string" ? o.dietPattern : null,
    weeklyBudget: isNum(o.weeklyBudget) ? o.weeklyBudget : null,
    currency: typeof o.currency === "string" ? o.currency : null,
    maxPrepMinutes: isNum(o.maxPrepMinutes) ? o.maxPrepMinutes : null,
    regenerations: isNum(o.regenerations) ? o.regenerations : 0,
    generation,
  };
}

export interface ResolvedTargets {
  targetKcal: number;
  proteinG: number;
  source: string | null;
  /** La meta guardada estaba por debajo del piso de seguridad y se usó el piso. */
  floorApplied: boolean;
  notes: string[];
}

/**
 * Metas para planificar desde `nutrition_targets`. Respeta el piso de seguridad
 * (1200 kcal mujer / 1500 kcal hombre) salvo que la meta la haya puesto un profesional.
 */
export function resolvePlanTargets(
  targets: { energy_kcal: number; protein_g: number; source: string | null } | null,
  sex: Sex | null,
): ResolvedTargets | null {
  if (!targets || !(targets.energy_kcal > 0)) return null;
  const notes: string[] = [];
  let kcal = targets.energy_kcal;
  let floorApplied = false;
  const floor = sex ? MIN_ENERGY_KCAL[sex] : MIN_ENERGY_KCAL.female;
  if (kcal < floor && targets.source !== "professional") {
    kcal = floor;
    floorApplied = true;
    notes.push(`Tu meta está por debajo de ${floor} kcal: el plan usa ${floor} kcal, el mínimo prudente sin acompañamiento profesional.`);
  }
  return { targetKcal: clamp(kcal, 500, 10000), proteinG: Math.max(0, targets.protein_g ?? 0), source: targets.source, floorApplied, notes };
}

export interface GenerateOptions {
  pool: readonly PlanRecipeOption[];
  params: PlanParams;
  days: number;
}

export function buildPlannerInput({ pool, params, days }: GenerateOptions, seed: string): PlannerInput {
  if (params.targetKcal == null) throw new Error("Sin meta de calorías no se puede generar un plan.");
  return {
    targetKcal: params.targetKcal,
    proteinG: params.proteinG ?? 0,
    days,
    mealsPerDay: plannerMealsPerDay(params.mealsPerDay),
    recipes: pool,
    avoidAllergens: params.avoidAllergens,
    dietPattern: params.dietPattern && isDietPattern(params.dietPattern) ? params.dietPattern : null,
    maxPrepMinutes: params.maxPrepMinutes,
    weeklyBudget: params.weeklyBudget,
    seed,
  };
}

export function recipeItem(recipe: PlanRecipeOption, servings: number, dayIndex: number, slotIndex: number, key = newItemKey("r")): DraftItem {
  const s = clampManualServings(servings);
  return {
    key,
    id: null,
    dayIndex,
    slotIndex,
    kind: "recipe",
    recipeId: recipe.id,
    foodId: null,
    name: recipe.title,
    slug: recipe.slug,
    servings: s,
    grams: null,
    kcal: roundDecimals(recipe.perServing.kcal * s, 1),
    proteinG: roundDecimals(recipe.perServing.p * s, 1),
    carbsG: roundDecimals(recipe.perServing.c * s, 1),
    fatG: roundDecimals(recipe.perServing.g * s, 1),
    cost: recipe.costPerServing != null ? roundDecimals(recipe.costPerServing * s, 2) : null,
  };
}

export interface FoodForPlan {
  id: string;
  name: string;
  per100g: { energyKcal: number; proteinG: number; carbsG: number; fatG: number };
}

export function foodItem(food: FoodForPlan, grams: number, dayIndex: number, slotIndex: number, key = newItemKey("f")): DraftItem {
  const g = clamp(roundDecimals(grams, 1), 1, 5000);
  const k = g / 100;
  return {
    key,
    id: null,
    dayIndex,
    slotIndex,
    kind: "food",
    recipeId: null,
    foodId: food.id,
    name: food.name,
    slug: null,
    servings: null,
    grams: g,
    kcal: roundDecimals(food.per100g.energyKcal * k, 1),
    proteinG: roundDecimals(food.per100g.proteinG * k, 1),
    carbsG: roundDecimals(food.per100g.carbsG * k, 1),
    fatG: roundDecimals(food.per100g.fatG * k, 1),
    cost: null,
  };
}

/** Porciones que sugiere el motor (0.5–2.5 en pasos de 0.25). */
export const clampServings = (s: number) => clamp(roundTo(s, SERVINGS_STEP), MIN_SERVINGS, MAX_SERVINGS);
/** Porciones que la persona puede poner a mano (0.25–5). */
export const MANUAL_MIN_SERVINGS = 0.25;
export const MANUAL_MAX_SERVINGS = 5;
export const clampManualServings = (s: number) => clamp(roundTo(s, SERVINGS_STEP), MANUAL_MIN_SERVINGS, MANUAL_MAX_SERVINGS);

function itemsFromEngine(plan: MealPlan, poolById: ReadonlyMap<string, PlanRecipeOption>, dayOffset = 0): DraftItem[] {
  const items: DraftItem[] = [];
  for (const m of plan.meals) {
    const recipe = poolById.get(m.recipeId);
    if (!recipe) continue;
    items.push(recipeItem(recipe, m.servings, m.dayIndex + dayOffset, m.position));
  }
  return items;
}

function generationSummary(plan: MealPlan): GenerationSummary {
  const d = plan.diagnostics;
  return {
    recipesProvided: d.recipesProvided,
    recipesEligible: d.recipesEligible,
    excluded: { ...d.excluded },
    repeatsRelaxed: d.repeatsRelaxed,
    // Los avisos de costo se recalculan en vivo al editar (ver diagnostics.ts): no se duplican aquí.
    warnings: d.warnings.filter((w) => !/costo/i.test(w)),
  };
}

/** Genera un plan completo con el motor y lo devuelve listo para editar (sin guardar). */
export function generateDraft(opts: GenerateOptions & { name: string; startDate: string; seed: string }): PlanDraft {
  const plan = generatePlan(buildPlannerInput(opts, opts.seed));
  const poolById = new Map(opts.pool.map((r) => [r.id, r]));
  return {
    id: null,
    name: opts.name,
    startDate: opts.startDate,
    days: opts.days,
    generator: "engine",
    status: "draft",
    params: { ...opts.params, seed: opts.seed, mealsPerDay: plan.mealsPerDay, regenerations: 0, generation: generationSummary(plan) },
    items: itemsFromEngine(plan, poolById),
  };
}

/** Plan vacío para armar a mano. */
export function emptyDraft(opts: { name: string; startDate: string; days: number; params: PlanParams }): PlanDraft {
  return {
    id: null,
    name: opts.name,
    startDate: opts.startDate,
    days: opts.days,
    generator: "manual",
    status: "draft",
    params: { ...opts.params, seed: null, generation: null, regenerations: 0 },
    items: [],
  };
}

/**
 * Regenera un día con el motor (semilla derivada, así que es reproducible). Para no repetir de más,
 * evita las recetas que ya alcanzaron el tope de repeticiones en los otros días; si eso deja huecos
 * vacíos, vuelve a intentar con todas.
 */
export function regenerateDay(draft: PlanDraft, dayIndex: number, pool: readonly PlanRecipeOption[]): PlanDraft {
  const regenerations = draft.params.regenerations + 1;
  const seed = `${draft.params.seed ?? "manual"}:d${dayIndex}:r${regenerations}`;
  const usage = new Map<string, number>();
  for (const it of draft.items) {
    if (it.dayIndex !== dayIndex && it.recipeId) usage.set(it.recipeId, (usage.get(it.recipeId) ?? 0) + 1);
  }
  const fresh = pool.filter((r) => (usage.get(r.id) ?? 0) < DEFAULT_MAX_REPEATS);
  const poolById = new Map(pool.map((r) => [r.id, r]));
  const run = (recipes: readonly PlanRecipeOption[]) =>
    generatePlan(buildPlannerInput({ pool: recipes, params: draft.params, days: 1 }, seed));
  let plan = run(fresh);
  if (plan.diagnostics.days[0]!.emptySlots.length > 0 && fresh.length < pool.length) plan = run(pool);
  return {
    ...draft,
    params: { ...draft.params, regenerations },
    items: [...draft.items.filter((it) => it.dayIndex !== dayIndex), ...itemsFromEngine(plan, poolById, dayIndex)],
  };
}

export interface SwapOption {
  recipe: PlanRecipeOption;
  servings: number;
  kcal: number;
  proteinG: number;
  kcalDiff: number;
}

const tagKey = (t: string) => normalizeKey(t).replace(/[\s-]+/g, "_");
const DIET_REQUIRES: Record<string, readonly string[]> = {
  vegetarian: ["vegetarian", "vegan"],
  vegan: ["vegan"],
  pescatarian: ["pescatarian", "vegetarian", "vegan"],
  keto: ["keto"],
  low_carb: ["low_carb", "keto"],
};

/** ¿La receta respeta los alérgenos y el patrón de dieta del plan? */
export function recipeAllowed(recipe: Pick<PlanRecipeOption, "allergens" | "dietTags">, params: Pick<PlanParams, "avoidAllergens" | "dietPattern">): boolean {
  const avoid = new Set(params.avoidAllergens.map(tagKey));
  if (recipe.allergens.some((a) => avoid.has(tagKey(a)))) return false;
  const req = params.dietPattern ? DIET_REQUIRES[params.dietPattern] : undefined;
  if (req && !recipe.dietTags.map(tagKey).some((t) => req.includes(t))) return false;
  return true;
}

/**
 * Alternativas para cambiar una receta del plan: mismo tipo de comida, que respeten alérgenos y
 * dieta, que no estén ya ese día, con porciones ajustadas a kcal parecidas. Ordenadas por cercanía
 * en kcal y luego por proteína.
 */
export function swapAlternatives(draft: PlanDraft, item: DraftItem, pool: readonly PlanRecipeOption[], limit = 6): SwapOption[] {
  const slot = planSlots(draft.params.mealsPerDay)[item.slotIndex];
  if (!slot) return [];
  const usedToday = new Set(draft.items.filter((it) => it.dayIndex === item.dayIndex && it.key !== item.key && it.recipeId).map((it) => it.recipeId!));
  const target = item.kcal > 0 ? item.kcal : (draft.params.targetKcal ?? 2000) * slot.share;
  const options: SwapOption[] = [];
  for (const r of pool) {
    if (r.id === item.recipeId || usedToday.has(r.id)) continue;
    if (!r.mealTypes.includes(slot.mealType)) continue;
    if (!recipeAllowed(r, draft.params)) continue;
    const servings = clampServings(target / r.perServing.kcal);
    const kcal = r.perServing.kcal * servings;
    options.push({ recipe: r, servings, kcal: roundDecimals(kcal, 0), proteinG: roundDecimals(r.perServing.p * servings, 1), kcalDiff: Math.abs(kcal - target) });
  }
  // Las que quedan dentro de ±15 % primero; dentro de cada grupo, más proteína.
  const tolerance = target * 0.15;
  options.sort((a, b) => {
    const aIn = a.kcalDiff <= tolerance ? 0 : 1;
    const bIn = b.kcalDiff <= tolerance ? 0 : 1;
    return aIn - bIn || (aIn === 0 ? b.proteinG - a.proteinG : a.kcalDiff - b.kcalDiff) || a.recipe.title.localeCompare(b.recipe.title, "es");
  });
  return options.slice(0, limit);
}

/** Cambia las porciones de un ítem de receta (o los gramos de un alimento) y recalcula. */
export function updateItemAmount(item: DraftItem, amount: number, pool: readonly PlanRecipeOption[], foodPer100g?: FoodForPlan["per100g"]): DraftItem {
  if (item.kind === "recipe") {
    const recipe = pool.find((r) => r.id === item.recipeId);
    if (!recipe) {
      // Receta que ya no está disponible: se escala en proporción a lo guardado.
      const s = clampManualServings(amount);
      const k = item.servings && item.servings > 0 ? s / item.servings : 1;
      return {
        ...item,
        id: null,
        servings: s,
        kcal: roundDecimals(item.kcal * k, 1),
        proteinG: roundDecimals(item.proteinG * k, 1),
        carbsG: roundDecimals(item.carbsG * k, 1),
        fatG: roundDecimals(item.fatG * k, 1),
        cost: item.cost != null ? roundDecimals(item.cost * k, 2) : null,
      };
    }
    return { ...recipeItem(recipe, amount, item.dayIndex, item.slotIndex, item.key) };
  }
  const grams = clamp(roundDecimals(amount, 1), 1, 5000);
  if (foodPer100g) return foodItem({ id: item.foodId!, name: item.name, per100g: foodPer100g }, grams, item.dayIndex, item.slotIndex, item.key);
  const k = item.grams && item.grams > 0 ? grams / item.grams : 1;
  return {
    ...item,
    id: null,
    grams,
    kcal: roundDecimals(item.kcal * k, 1),
    proteinG: roundDecimals(item.proteinG * k, 1),
    carbsG: roundDecimals(item.carbsG * k, 1),
    fatG: roundDecimals(item.fatG * k, 1),
  };
}

/** Ítems de un hueco en orden. */
export function slotItems(draft: Pick<PlanDraft, "items">, dayIndex: number, slotIndex: number): DraftItem[] {
  return draft.items.filter((it) => it.dayIndex === dayIndex && it.slotIndex === slotIndex);
}

/** Posiciones para guardar: hueco × 10 + orden dentro del hueco. */
export function itemsWithPositions(draft: Pick<PlanDraft, "items">): Array<DraftItem & { position: number }> {
  const counters = new Map<string, number>();
  return [...draft.items]
    .sort((a, b) => a.dayIndex - b.dayIndex || a.slotIndex - b.slotIndex)
    .map((it) => {
      const k = `${it.dayIndex}:${it.slotIndex}`;
      const order = counters.get(k) ?? 0;
      counters.set(k, order + 1);
      return { ...it, position: itemPosition(it.slotIndex, Math.min(order, MAX_ITEMS_PER_SLOT - 1)) };
    });
}

/** Semilla nueva (texto) para generar un plan. */
export function newSeed(random: () => number = Math.random): string {
  return Math.floor(random() * 2 ** 32).toString(36).padStart(6, "0");
}
