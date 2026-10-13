/**
 * Planificador de comidas determinista (sin IA). Misma entrada + misma semilla = mismo plan.
 *
 * 1. Filtra recetas por alérgenos, patrón de dieta y tiempo de preparación.
 * 2. Reparte las kcal del día entre comidas (desayuno 25 %, almuerzo 35 %, cena 25 %, snacks el resto).
 * 3. Por cada comida elige la receta con mejor puntaje (cercanía a las kcal de esa comida, proteína,
 *    repeticiones, costo y un poco de azar con semilla para variar).
 * 4. Ajusta porciones (0.5–2.5 en pasos de 0.25) para acercar el día a la meta y, si aún queda
 *    fuera de ±10 %, prueba cambiar recetas.
 * 5. Devuelve diagnósticos honestos: si no se pudo cumplir, dice por qué.
 */
import { NutritionInputError } from "./errors";
import { assertInRange, assertInteger, assertNonNegative, fmt, normalizeKey, roundDecimals, roundTo } from "./math";
import type { DietPattern, MealType } from "./types";
import { isDietPattern } from "./types";

export type PlannerMealType = Exclude<MealType, "custom">;

export interface PlannerRecipe {
  id: string;
  title?: string;
  mealTypes: readonly MealType[];
  /** Por porción: kcal, p (proteína g), c (carbohidratos g), g (grasa g), fibra g. */
  perServing: { kcal: number; p: number; c: number; g: number; fiber: number };
  allergens: readonly string[];
  dietTags: readonly string[];
  prepMinutes: number | null;
  costPerServing?: number | null;
}

export interface PlannerInput {
  targetKcal: number;
  proteinG: number;
  days: number;
  mealsPerDay: number;
  recipes: readonly PlannerRecipe[];
  avoidAllergens?: readonly string[];
  dietPattern?: DietPattern | null;
  maxPrepMinutes?: number | null;
  /** Presupuesto semanal (misma moneda que `costPerServing`). */
  weeklyBudget?: number | null;
  seed: number | string;
  /** Veces que una receta puede aparecer en todo el plan (por defecto 2). */
  maxRepeatsPerRecipe?: number;
}

export interface MealSlot {
  mealType: PlannerMealType;
  label: string;
  share: number;
}

export interface PlannedMeal {
  dayIndex: number;
  position: number;
  mealType: PlannerMealType;
  label: string;
  recipeId: string;
  title: string | null;
  servings: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  /** Costo de las porciones; null si la receta no tiene costo. */
  cost: number | null;
  slotTargetKcal: number;
}

export interface DayDiagnostics {
  dayIndex: number;
  targetKcal: number;
  kcal: number;
  /** (kcal − meta) / meta × 100, 1 decimal. */
  deviationPct: number;
  withinTolerance: boolean;
  proteinTargetG: number;
  proteinG: number;
  proteinPct: number | null;
  emptySlots: string[];
  issues: string[];
}

export interface PlanDiagnostics {
  tolerancePct: number;
  /** Todos los días dentro de ±10 % de kcal. */
  withinTolerance: boolean;
  days: DayDiagnostics[];
  recipesProvided: number;
  recipesEligible: number;
  excluded: { invalid: number; allergens: number; diet: number; prepTime: number };
  repeatsRelaxed: boolean;
  estimatedCost: number | null;
  costIsPartial: boolean;
  /** Presupuesto proporcional a los días del plan. */
  budget: number | null;
  /** null si no hay presupuesto, o si el costo es parcial y no lo supera. */
  overBudget: boolean | null;
  warnings: string[];
}

export interface MealPlan {
  generator: "engine";
  seed: string;
  days: number;
  mealsPerDay: number;
  meals: PlannedMeal[];
  diagnostics: PlanDiagnostics;
}

export const SERVINGS_STEP = 0.25;
export const MIN_SERVINGS = 0.5;
export const MAX_SERVINGS = 2.5;
export const PLAN_KCAL_TOLERANCE_PCT = 10;
export const DEFAULT_MAX_REPEATS = 2;
const PROTEIN_OK_RATIO = 0.9;

/** Reparto de kcal por comida según comidas al día. */
export function mealSlots(mealsPerDay: number): MealSlot[] {
  assertInteger(mealsPerDay, 3, 5, "mealsPerDay", "Las comidas por día");
  if (mealsPerDay === 3) {
    return [
      { mealType: "breakfast", label: "Desayuno", share: 0.3 },
      { mealType: "lunch", label: "Almuerzo", share: 0.4 },
      { mealType: "dinner", label: "Cena", share: 0.3 },
    ];
  }
  if (mealsPerDay === 4) {
    return [
      { mealType: "breakfast", label: "Desayuno", share: 0.25 },
      { mealType: "lunch", label: "Almuerzo", share: 0.35 },
      { mealType: "snack", label: "Media tarde", share: 0.15 },
      { mealType: "dinner", label: "Cena", share: 0.25 },
    ];
  }
  return [
    { mealType: "breakfast", label: "Desayuno", share: 0.25 },
    { mealType: "snack", label: "Media mañana", share: 0.075 },
    { mealType: "lunch", label: "Almuerzo", share: 0.35 },
    { mealType: "snack", label: "Media tarde", share: 0.075 },
    { mealType: "dinner", label: "Cena", share: 0.25 },
  ];
}

/** Generador pseudoaleatorio determinista (FNV-1a + mulberry32). Devuelve valores en [0, 1). */
export function createRng(seed: number | string): () => number {
  const text = String(seed);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tagKey = (t: string) => normalizeKey(t).replace(/[\s-]+/g, "_");

/** Etiquetas de dieta que una receta debe tener para cada patrón (filtro duro). */
const DIET_REQUIRES: Partial<Record<DietPattern, readonly string[]>> = {
  vegetarian: ["vegetarian", "vegan"],
  vegan: ["vegan"],
  pescatarian: ["pescatarian", "vegetarian", "vegan"],
  keto: ["keto"],
  low_carb: ["low_carb", "keto"],
};
/** Patrones de estilo: no excluyen, solo dan preferencia. */
const DIET_PREFERS: Partial<Record<DietPattern, readonly string[]>> = {
  high_protein: ["high_protein"],
  mediterranean: ["mediterranean"],
};

function isValidRecipe(r: PlannerRecipe): boolean {
  if (!r || typeof r.id !== "string" || r.id.trim() === "") return false;
  if (!Array.isArray(r.mealTypes) || !Array.isArray(r.allergens) || !Array.isArray(r.dietTags)) return false;
  const ps = r.perServing;
  if (!ps || !(Number.isFinite(ps.kcal) && ps.kcal > 0)) return false;
  return [ps.p, ps.c, ps.g, ps.fiber].every((v) => Number.isFinite(v) && v >= 0);
}

interface Draft {
  slot: MealSlot;
  position: number;
  slotKcal: number;
  recipe: PlannerRecipe | null;
  servings: number;
}

const clampServings = (s: number) => Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, roundTo(s, SERVINGS_STEP)));
const draftKcal = (d: Draft) => (d.recipe ? d.recipe.perServing.kcal * d.servings : 0);
const dayKcal = (drafts: readonly Draft[]) => drafts.reduce((s, d) => s + draftKcal(d), 0);
const dayProtein = (drafts: readonly Draft[]) => drafts.reduce((s, d) => s + (d.recipe ? d.recipe.perServing.p * d.servings : 0), 0);

/** Ajusta porciones paso a paso: prioriza el total del día y, en segundo plano, el equilibrio entre comidas. */
function adjustServings(drafts: Draft[], target: number): void {
  const objective = () =>
    Math.abs(dayKcal(drafts) - target) + 0.15 * drafts.reduce((s, d) => s + (d.recipe ? Math.abs(draftKcal(d) - d.slotKcal) : 0), 0);
  for (let iter = 0; iter < 200; iter++) {
    const current = objective();
    let best: { i: number; servings: number; value: number } | null = null;
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i]!;
      if (!d.recipe) continue;
      for (const delta of [-SERVINGS_STEP, SERVINGS_STEP]) {
        const s = roundTo(d.servings + delta, SERVINGS_STEP);
        if (s < MIN_SERVINGS || s > MAX_SERVINGS) continue;
        const old = d.servings;
        d.servings = s;
        const value = objective();
        d.servings = old;
        if (value < (best?.value ?? current) - 1e-9) best = { i, servings: s, value };
      }
    }
    if (!best) break;
    drafts[best.i]!.servings = best.servings;
  }
}

export function generatePlan(input: PlannerInput): MealPlan {
  const targetKcal = assertInRange(input.targetKcal, 500, 10000, "targetKcal", "La meta de calorías", "kcal");
  const proteinTarget = assertInRange(input.proteinG, 0, 1000, "proteinG", "La meta de proteína", "g");
  const days = assertInteger(input.days, 1, 7, "days", "Los días del plan");
  const slots = mealSlots(input.mealsPerDay);
  const maxRepeats = input.maxRepeatsPerRecipe ?? DEFAULT_MAX_REPEATS;
  assertInteger(maxRepeats, 1, 14, "maxRepeatsPerRecipe", "Las repeticiones por receta");
  if (input.maxPrepMinutes != null) assertInRange(input.maxPrepMinutes, 1, 1440, "maxPrepMinutes", "El tiempo máximo", "min");
  if (input.weeklyBudget != null) assertNonNegative(input.weeklyBudget, "weeklyBudget", "El presupuesto");
  const pattern = input.dietPattern ?? null;
  if (pattern !== null && !isDietPattern(pattern)) {
    throw new NutritionInputError("invalid_value", "dietPattern", "El tipo de dieta no es válido.");
  }
  if (!Array.isArray(input.recipes as unknown)) {
    throw new NutritionInputError("invalid_value", "recipes", "Las recetas deben ser una lista.");
  }
  if (typeof input.seed !== "string" && !(typeof input.seed === "number" && Number.isFinite(input.seed))) {
    throw new NutritionInputError("invalid_value", "seed", "La semilla debe ser un número o un texto.");
  }

  // 1. Filtros.
  const avoid = new Set((input.avoidAllergens ?? []).map(tagKey));
  const requires = pattern ? DIET_REQUIRES[pattern] : undefined;
  const prefers = pattern ? DIET_PREFERS[pattern] : undefined;
  const excluded = { invalid: 0, allergens: 0, diet: 0, prepTime: 0 };
  const seen = new Set<string>();
  const pool: PlannerRecipe[] = [];
  for (const r of input.recipes) {
    if (!isValidRecipe(r) || seen.has(r.id)) {
      excluded.invalid++;
      continue;
    }
    seen.add(r.id);
    const tags = new Set(r.dietTags.map(tagKey));
    if (r.allergens.some((al) => avoid.has(tagKey(al)))) excluded.allergens++;
    else if (requires && !requires.some((t) => tags.has(t))) excluded.diet++;
    else if (input.maxPrepMinutes != null && (r.prepMinutes == null || r.prepMinutes > input.maxPrepMinutes)) excluded.prepTime++;
    else pool.push(r);
  }
  const preferred = new Set(
    pool.filter((r) => prefers?.some((t) => r.dietTags.map(tagKey).includes(t))).map((r) => r.id),
  );

  const rng = createRng(input.seed);
  const usage = new Map<string, number>();
  const used = (id: string) => usage.get(id) ?? 0;
  const bump = (id: string, by: number) => usage.set(id, used(id) + by);
  const dayBudget = input.weeklyBudget != null ? input.weeklyBudget / 7 : null;
  let repeatsRelaxed = false;

  /** Recetas posibles para la comida; si todas superan el tope de repeticiones, se relaja el tope. */
  const candidatesFor = (slot: MealSlot, usedToday: ReadonlySet<string>) => {
    const all = pool.filter((r) => r.mealTypes.includes(slot.mealType) && !usedToday.has(r.id));
    const underCap = all.filter((r) => used(r.id) < maxRepeats);
    return underCap.length > 0 ? { list: underCap, relaxed: false } : { list: all, relaxed: all.length > 0 };
  };

  const score = (r: PlannerRecipe, slotKcal: number, slotProtein: number, slotBudget: number | null) => {
    const servings = clampServings(slotKcal / r.perServing.kcal);
    const kcal = r.perServing.kcal * servings;
    const kcalErr = Math.abs(kcal - slotKcal) / slotKcal;
    const protein = r.perServing.p * servings;
    const proteinShort = slotProtein > 0 ? Math.max(0, slotProtein - protein) / slotProtein : 0;
    const cost = r.costPerServing != null ? r.costPerServing * servings : null;
    const budgetPenalty = slotBudget && cost !== null ? Math.max(0, cost - slotBudget) / slotBudget : 0;
    const value =
      kcalErr + 0.5 * proteinShort + 0.15 * used(r.id) + 0.3 * budgetPenalty - (preferred.has(r.id) ? 0.05 : 0) + 0.08 * rng();
    return { servings, value };
  };

  const meals: PlannedMeal[] = [];
  const dayDiagnostics: DayDiagnostics[] = [];

  for (let dayIndex = 0; dayIndex < days; dayIndex++) {
    const usedToday = new Set<string>();
    const drafts: Draft[] = [];
    slots.forEach((slot, position) => {
      const slotKcal = targetKcal * slot.share;
      const candidates = candidatesFor(slot, usedToday);
      let best: { recipe: PlannerRecipe; servings: number; value: number } | null = null;
      for (const r of candidates.list) {
        const s = score(r, slotKcal, proteinTarget * slot.share, dayBudget !== null ? dayBudget * slot.share : null);
        if (!best || s.value < best.value) best = { recipe: r, servings: s.servings, value: s.value };
      }
      if (best) {
        usedToday.add(best.recipe.id);
        bump(best.recipe.id, 1);
        if (candidates.relaxed) repeatsRelaxed = true;
      }
      drafts.push({ slot, position, slotKcal, recipe: best?.recipe ?? null, servings: best?.servings ?? 0 });
    });

    adjustServings(drafts, targetKcal);

    // Si el día sigue fuera de tolerancia, prueba cambiar una receta por otra que cierre la brecha.
    const deviation = () => (Math.abs(dayKcal(drafts) - targetKcal) / targetKcal) * 100;
    for (let attempt = 0; attempt < slots.length && deviation() > PLAN_KCAL_TOLERANCE_PCT; attempt++) {
      let bestSwap: { i: number; recipe: PlannerRecipe; servings: number; err: number; relaxed: boolean } | null = null;
      const currentErr = Math.abs(dayKcal(drafts) - targetKcal);
      for (let i = 0; i < drafts.length; i++) {
        const d = drafts[i]!;
        const others = new Set(drafts.filter((x, j) => j !== i && x.recipe).map((x) => x.recipe!.id));
        const rest = dayKcal(drafts) - draftKcal(d);
        const candidates = candidatesFor(d.slot, others);
        for (const r of candidates.list) {
          if (r.id === d.recipe?.id) continue;
          const servings = clampServings((targetKcal - rest) / r.perServing.kcal);
          const err = Math.abs(rest + r.perServing.kcal * servings - targetKcal);
          if (err < (bestSwap?.err ?? currentErr) - 1e-9) bestSwap = { i, recipe: r, servings, err, relaxed: candidates.relaxed };
        }
      }
      if (!bestSwap) break;
      const { i, recipe, servings, relaxed } = bestSwap;
      if (relaxed) repeatsRelaxed = true;
      const d = drafts[i]!;
      if (d.recipe) bump(d.recipe.id, -1);
      bump(recipe.id, 1);
      d.recipe = recipe;
      d.servings = servings;
      adjustServings(drafts, targetKcal);
    }

    // Si las kcal ya cuadran pero falta proteína, prueba cambios que suban la proteína sin salir de ±10 %.
    for (let attempt = 0; attempt < slots.length; attempt++) {
      if (proteinTarget <= 0 || dayProtein(drafts) >= proteinTarget * PROTEIN_OK_RATIO) break;
      const currentProtein = dayProtein(drafts);
      let bestSwap: { i: number; recipe: PlannerRecipe; servings: number; protein: number; relaxed: boolean } | null = null;
      for (let i = 0; i < drafts.length; i++) {
        const d = drafts[i]!;
        if (!d.recipe) continue;
        const others = new Set(drafts.filter((x, j) => j !== i && x.recipe).map((x) => x.recipe!.id));
        const restKcal = dayKcal(drafts) - draftKcal(d);
        const restProtein = currentProtein - d.recipe.perServing.p * d.servings;
        const candidates = candidatesFor(d.slot, others);
        for (const r of candidates.list) {
          if (r.id === d.recipe.id) continue;
          const servings = clampServings((targetKcal - restKcal) / r.perServing.kcal);
          const kcal = restKcal + r.perServing.kcal * servings;
          if ((Math.abs(kcal - targetKcal) / targetKcal) * 100 > PLAN_KCAL_TOLERANCE_PCT) continue;
          // Con presupuesto, no cambia a una receta que se pase del monto de esa comida.
          const slotBudget = dayBudget !== null ? dayBudget * d.slot.share : null;
          if (slotBudget !== null && r.costPerServing != null && r.costPerServing * servings > slotBudget) continue;
          const protein = restProtein + r.perServing.p * servings;
          if (protein > (bestSwap?.protein ?? currentProtein) + 1e-9) {
            bestSwap = { i, recipe: r, servings, protein, relaxed: candidates.relaxed };
          }
        }
      }
      if (!bestSwap) break;
      const d = drafts[bestSwap.i]!;
      if (bestSwap.relaxed) repeatsRelaxed = true;
      bump(d.recipe!.id, -1);
      bump(bestSwap.recipe.id, 1);
      d.recipe = bestSwap.recipe;
      d.servings = bestSwap.servings;
    }

    // Resultado y diagnóstico del día.
    let kcal = 0;
    let protein = 0;
    const emptySlots: string[] = [];
    for (const d of drafts) {
      if (!d.recipe) {
        emptySlots.push(d.slot.label);
        continue;
      }
      const ps = d.recipe.perServing;
      const s = d.servings;
      kcal += ps.kcal * s;
      protein += ps.p * s;
      meals.push({
        dayIndex,
        position: d.position,
        mealType: d.slot.mealType,
        label: d.slot.label,
        recipeId: d.recipe.id,
        title: d.recipe.title ?? null,
        servings: s,
        kcal: roundDecimals(ps.kcal * s, 1),
        proteinG: roundDecimals(ps.p * s, 1),
        carbsG: roundDecimals(ps.c * s, 1),
        fatG: roundDecimals(ps.g * s, 1),
        fiberG: roundDecimals(ps.fiber * s, 1),
        cost: d.recipe.costPerServing != null ? roundDecimals(d.recipe.costPerServing * s, 2) : null,
        slotTargetKcal: roundDecimals(d.slotKcal, 0),
      });
    }
    const deviationPct = roundDecimals(((kcal - targetKcal) / targetKcal) * 100, 1);
    const withinTolerance = Math.abs(deviationPct) <= PLAN_KCAL_TOLERANCE_PCT;
    const proteinPct = proteinTarget > 0 ? roundDecimals((protein / proteinTarget) * 100, 1) : null;
    const issues: string[] = [];
    for (const label of emptySlots) {
      issues.push(`${label}: no hay recetas que cumplan tus filtros (tipo de comida, alérgenos, dieta o tiempo).`);
    }
    if (!withinTolerance) {
      issues.push(
        `Quedó a ${fmt(deviationPct, 1)} % de tu meta de calorías: no hay suficientes recetas que encajen. Prueba ampliar tus filtros o agregar recetas.`,
      );
    }
    if (proteinPct !== null && proteinPct < PROTEIN_OK_RATIO * 100) {
      issues.push(`La proteína quedó en ${fmt(proteinPct, 1)} % de tu meta.`);
    }
    dayDiagnostics.push({
      dayIndex,
      targetKcal,
      kcal: roundDecimals(kcal, 1),
      deviationPct,
      withinTolerance,
      proteinTargetG: proteinTarget,
      proteinG: roundDecimals(protein, 1),
      proteinPct,
      emptySlots,
      issues,
    });
  }

  // Costo y presupuesto.
  const withCost = meals.filter((m) => m.cost !== null);
  const costIsPartial = withCost.length < meals.length;
  const estimatedCost = withCost.length === 0 ? null : roundDecimals(withCost.reduce((s, m) => s + (m.cost ?? 0), 0), 2);
  const budget = input.weeklyBudget != null ? roundDecimals((input.weeklyBudget * days) / 7, 2) : null;
  let overBudget: boolean | null = null;
  if (budget !== null) {
    if (estimatedCost !== null && estimatedCost > budget) overBudget = true;
    else if (!costIsPartial) overBudget = false;
  }

  const warnings: string[] = [];
  if (pool.length === 0) warnings.push("Ninguna receta cumple tus filtros: no pudimos armar el plan.");
  if (excluded.invalid > 0) warnings.push(`Omitimos ${excluded.invalid} receta(s) con datos incompletos o repetidos.`);
  if (repeatsRelaxed) {
    warnings.push(`Algunas recetas se repiten más de ${maxRepeats} veces porque no hay suficientes opciones con tus filtros.`);
  }
  if (costIsPartial && meals.length > 0 && budget !== null) {
    warnings.push("Algunas recetas no tienen costo referencial: el costo estimado es parcial.");
  }
  if (overBudget && estimatedCost !== null && budget !== null) {
    warnings.push(`El costo estimado (${fmt(estimatedCost, 2)}) supera el presupuesto para estos días (${fmt(budget, 2)}).`);
  }

  return {
    generator: "engine",
    seed: String(input.seed),
    days,
    mealsPerDay: slots.length,
    meals,
    diagnostics: {
      tolerancePct: PLAN_KCAL_TOLERANCE_PCT,
      withinTolerance: dayDiagnostics.every((d) => d.withinTolerance),
      days: dayDiagnostics,
      recipesProvided: input.recipes.length,
      recipesEligible: pool.length,
      excluded,
      repeatsRelaxed,
      estimatedCost,
      costIsPartial,
      budget,
      overBudget,
      warnings,
    },
  };
}
