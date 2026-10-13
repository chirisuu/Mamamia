import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { getActiveGoal, getActiveTargets } from "@/lib/data/targets";
import { ageOn, diffDays } from "@/lib/dates";
import { computeBmi, isHealthFlag, isGoal, isSex, screenRisk, type RiskScreening } from "@/lib/nutrition";
import { costPerServing, toPlannerRecipe } from "@/features/recipes/lib/adapters";
import { listPlannableRecipes } from "@/features/recipes/queries";
import { parsePlanParams, plannerMealsPerDay, resolvePlanTargets, slotFromPosition, type ResolvedTargets } from "./lib/plan";
import type { DraftItem, PlanDraft, PlanParams, PlanRecipeOption, PlanStatus } from "./lib/types";

type Client = SupabaseClient<Database>;

export interface PlannerContext {
  today: string;
  currency: string;
  targets: ResolvedTargets | null;
  defaults: PlanParams;
  /** Planes automáticos bloqueados por el perfil de salud (revisión profesional). */
  autoPlansBlocked: boolean;
  riskMessages: string[];
  budgetNote: string | null;
  pool: PlanRecipeOption[];
}

/** Perfil, objetivo, metas, cribado de riesgo y recetas planificables de la persona. */
export async function getPlannerContext(supabase: Client, userId: string, today: string): Promise<PlannerContext> {
  const [{ data: profile }, goal, rawTargets, { data: weights }, cards] = await Promise.all([
    supabase.from("profiles").select("sex, birth_date, height_cm, currency_code").eq("id", userId).maybeSingle(),
    getActiveGoal(supabase, userId),
    getActiveTargets(supabase, userId, today),
    supabase.from("weight_logs").select("weight_kg").eq("user_id", userId).order("local_date", { ascending: false }).limit(1),
    listPlannableRecipes(supabase, userId),
  ]);
  const currency = profile?.currency_code ?? "PEN";
  const sex = profile?.sex && isSex(profile.sex) ? profile.sex : null;

  let risk: RiskScreening | null = null;
  if (profile?.birth_date && sex && goal && isGoal(goal.goal_type)) {
    const weight = weights?.[0]?.weight_kg ?? goal.current_weight_kg;
    const height = profile.height_cm;
    let bmi: number | null = null;
    try {
      bmi = weight && height ? computeBmi(Number(weight), Number(height)) : null;
    } catch {
      bmi = null;
    }
    risk = screenRisk({
      ageYears: ageOn(profile.birth_date, today),
      sex,
      bmi,
      healthFlags: (goal.health_flags ?? []).filter(isHealthFlag),
      goal: goal.goal_type,
    });
  }
  const autoPlansBlocked = Boolean(goal?.requires_professional_review) || Boolean(risk?.blocks.autoPlans);

  const targets = resolvePlanTargets(rawTargets ? { energy_kcal: rawTargets.energy_kcal, protein_g: rawTargets.protein_g, source: rawTargets.source } : null, sex);

  const budgetCurrency = goal?.budget_currency ?? currency;
  const budgetUsable = goal?.weekly_budget != null && budgetCurrency === currency;
  const budgetNote =
    goal?.weekly_budget != null && !budgetUsable
      ? `Tu presupuesto está en ${budgetCurrency} y tu perfil usa ${currency}: no lo comparamos para no mezclar monedas.`
      : null;

  const pool: PlanRecipeOption[] = cards.flatMap((c) => {
    const r = toPlannerRecipe(c, currency);
    return r ? [{ ...r, title: c.title, slug: c.slug, imageUrl: c.imageUrl }] : [];
  });

  const dietPattern = goal?.diet_pattern ?? null;
  const defaults: PlanParams = {
    version: 1,
    seed: null,
    mealsPerDay: plannerMealsPerDay(goal?.meals_per_day),
    targetKcal: targets?.targetKcal ?? null,
    proteinG: targets?.proteinG ?? null,
    targetSource: targets?.source ?? null,
    floorApplied: targets?.floorApplied ?? false,
    avoidAllergens: [...new Set([...(goal?.allergies ?? []), ...(goal?.intolerances ?? [])])],
    dietPattern: dietPattern && dietPattern !== "omnivore" ? dietPattern : null,
    weeklyBudget: budgetUsable ? Number(goal!.weekly_budget) : null,
    currency,
    maxPrepMinutes: null,
    regenerations: 0,
    generation: null,
  };
  return {
    today,
    currency,
    targets,
    defaults,
    autoPlansBlocked,
    riskMessages: risk?.messages ?? (goal?.requires_professional_review ? ["Tu objetivo está marcado para revisión profesional."] : []),
    budgetNote,
    pool,
  };
}

export interface PlanSummary {
  id: string;
  name: string;
  startDate: string;
  days: number;
  status: PlanStatus;
  generator: string;
  itemsCount: number;
  isShared: boolean;
  updatedAt: string;
}

export async function listPlans(supabase: Client, userId: string): Promise<PlanSummary[]> {
  const { data, error } = await supabase
    .from("meal_plans")
    .select("id, name, start_date, days, status, generator, share_token, updated_at, meal_plan_items(count)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`meal_plans: ${error.code ?? "error"}`);
  return (data ?? []).map((p) => {
    const counts = (p as typeof p & { meal_plan_items: Array<{ count: number }> | null }).meal_plan_items;
    return {
      id: p.id,
      name: p.name,
      startDate: p.start_date,
      days: p.days,
      status: p.status as PlanStatus,
      generator: p.generator,
      itemsCount: counts?.[0]?.count ?? 0,
      isShared: Boolean(p.share_token),
      updatedAt: p.updated_at,
    };
  });
}

type ItemRow = Database["public"]["Tables"]["meal_plan_items"]["Row"] & {
  recipes: { title: string; slug: string; servings: number; estimated_cost: number | null; cost_currency: string | null } | null;
  foods: { name: string } | null;
};

const ITEM_SELECT =
  "id, plan_id, user_id, day_index, meal_type, recipe_id, food_id, servings, grams, energy_kcal, protein_g, carbs_g, fat_g, position, created_at, updated_at, recipes(title, slug, servings, estimated_cost, cost_currency), foods(name)" as const;

function toDraftItem(row: ItemRow, currency: string | null): DraftItem {
  const recipe = row.recipes;
  const servings = row.servings == null ? null : Number(row.servings);
  const perServingCost = recipe && recipe.cost_currency === currency ? costPerServing(recipe.estimated_cost, Number(recipe.servings)) : null;
  return {
    key: row.id,
    id: row.id,
    dayIndex: row.day_index,
    slotIndex: slotFromPosition(row.position),
    kind: row.recipe_id || (!row.food_id && servings != null) ? "recipe" : "food",
    recipeId: row.recipe_id,
    foodId: row.food_id,
    name: recipe?.title ?? row.foods?.name ?? (row.recipe_id || servings != null ? "Receta no disponible" : "Alimento no disponible"),
    slug: recipe?.slug ?? null,
    servings,
    grams: row.grams == null ? null : Number(row.grams),
    kcal: Number(row.energy_kcal),
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
    cost: perServingCost != null && servings != null ? Math.round(perServingCost * servings * 100) / 100 : null,
  };
}

export interface PlanRecord extends PlanDraft {
  id: string;
  shareToken: string | null;
  sharedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Plan propio con sus ítems listo para el editor. null si no existe o no es de la persona. */
export async function getPlan(supabase: Client, userId: string, planId: string): Promise<PlanRecord | null> {
  const { data: plan, error } = await supabase.from("meal_plans").select("*").eq("id", planId).eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`meal_plans: ${error.code ?? "error"}`);
  if (!plan) return null;
  const { data: items, error: itemsError } = await supabase
    .from("meal_plan_items")
    .select(ITEM_SELECT)
    .eq("plan_id", plan.id)
    .order("day_index", { ascending: true })
    .order("position", { ascending: true });
  if (itemsError) throw new Error(`meal_plan_items: ${itemsError.code ?? "error"}`);
  const params = parsePlanParams(plan.params);
  return {
    id: plan.id,
    name: plan.name,
    startDate: plan.start_date,
    days: plan.days,
    generator: plan.generator === "manual" ? "manual" : "engine",
    status: plan.status as PlanStatus,
    params,
    items: ((items ?? []) as unknown as ItemRow[]).map((r) => toDraftItem(r, params.currency)),
    shareToken: plan.share_token,
    sharedAt: plan.shared_at,
    createdAt: plan.created_at,
    updatedAt: plan.updated_at,
  };
}

/** Comidas de hoy del plan activo (si hoy cae dentro del plan). */
export async function getActivePlanToday(supabase: Client, userId: string, today: string) {
  const { data: plans } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1);
  const id = plans?.[0]?.id;
  if (!id) return null;
  const plan = await getPlan(supabase, userId, id);
  if (!plan) return null;
  const dayIndex = diffDays(plan.startDate, today);
  const inRange = dayIndex >= 0 && dayIndex < plan.days;
  return { plan, dayIndex: inRange ? dayIndex : null, items: inRange ? plan.items.filter((it) => it.dayIndex === dayIndex) : [] };
}

/** Planes que aceptan recetas (no archivados), para "Añadir al plan". */
export async function listEditablePlans(supabase: Client, userId: string) {
  const { data } = await supabase
    .from("meal_plans")
    .select("id, name, start_date, days, status, params")
    .eq("user_id", userId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(30);
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    startDate: p.start_date,
    days: p.days,
    status: p.status as PlanStatus,
    mealsPerDay: parsePlanParams(p.params).mealsPerDay,
  }));
}
