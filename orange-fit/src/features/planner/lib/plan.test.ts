import { describe, expect, it } from "vitest";
import { computeDraftDiagnostics } from "./diagnostics";
import {
  emptyDraft,
  foodItem,
  generateDraft,
  itemPosition,
  itemsWithPositions,
  parsePlanParams,
  planSlots,
  plannerMealsPerDay,
  recipeAllowed,
  recipeItem,
  regenerateDay,
  resolvePlanTargets,
  slotFromPosition,
  swapAlternatives,
  updateItemAmount,
} from "./plan";
import type { PlanParams, PlanRecipeOption } from "./types";

function recipe(id: string, mealTypes: PlanRecipeOption["mealTypes"], kcal: number, p: number, extra: Partial<PlanRecipeOption> = {}): PlanRecipeOption {
  return {
    id,
    title: `Receta ${id}`,
    slug: id,
    imageUrl: null,
    mealTypes,
    perServing: { kcal, p, c: kcal / 8, g: kcal / 40, fiber: 3 },
    allergens: [],
    dietTags: [],
    prepMinutes: 20,
    costPerServing: 3,
    ...extra,
  };
}

const pool: PlanRecipeOption[] = [
  ...[0, 1, 2, 3].map((i) => recipe(`b${i}`, ["breakfast"], 380 + i * 30, 18 + i)),
  ...[0, 1, 2, 3].map((i) => recipe(`l${i}`, ["lunch", "dinner"], 550 + i * 40, 35 + i * 2)),
  ...[0, 1, 2, 3].map((i) => recipe(`d${i}`, ["dinner"], 450 + i * 30, 30 + i)),
  ...[0, 1, 2].map((i) => recipe(`s${i}`, ["snack"], 180 + i * 40, 10 + i * 3)),
  recipe("mani", ["snack"], 250, 12, { allergens: ["mani"] }),
];

const params: PlanParams = {
  version: 1,
  seed: null,
  mealsPerDay: 4,
  targetKcal: 2000,
  proteinG: 120,
  targetSource: "auto",
  floorApplied: false,
  avoidAllergens: ["maní"],
  dietPattern: null,
  weeklyBudget: 140,
  currency: "PEN",
  maxPrepMinutes: null,
  regenerations: 0,
  generation: null,
};

describe("adaptadores del objetivo", () => {
  it("lleva las comidas por día al rango del motor", () => {
    expect(plannerMealsPerDay(2)).toBe(3);
    expect(plannerMealsPerDay(6)).toBe(5);
    expect(plannerMealsPerDay(null)).toBe(4);
    expect(planSlots(5).map((s) => s.label)).toEqual(["Desayuno", "Media mañana", "Almuerzo", "Media tarde", "Cena"]);
  });

  it("respeta el piso de seguridad salvo meta profesional", () => {
    expect(resolvePlanTargets({ energy_kcal: 1100, protein_g: 90, source: "manual" }, "female")).toMatchObject({ targetKcal: 1200, floorApplied: true });
    expect(resolvePlanTargets({ energy_kcal: 1300, protein_g: 90, source: "auto" }, "male")).toMatchObject({ targetKcal: 1500, floorApplied: true });
    expect(resolvePlanTargets({ energy_kcal: 1100, protein_g: 90, source: "professional" }, "female")).toMatchObject({ targetKcal: 1100, floorApplied: false });
    expect(resolvePlanTargets(null, "female")).toBeNull();
  });

  it("lee params guardados de forma tolerante", () => {
    const p = parsePlanParams({ seed: 123, mealsPerDay: 9, targetKcal: "x", avoidAllergens: ["gluten", 3], generation: { recipesEligible: 10, warnings: ["a"] } });
    expect(p).toMatchObject({ seed: "123", mealsPerDay: 5, targetKcal: null, avoidAllergens: ["gluten"] });
    expect(p.generation).toMatchObject({ recipesEligible: 10, recipesProvided: 0, warnings: ["a"] });
    expect(parsePlanParams(null).generation).toBeNull();
  });

  it("codifica el hueco en la posición", () => {
    expect(itemPosition(3, 2)).toBe(32);
    expect(slotFromPosition(32)).toBe(3);
  });
});

describe("generación y edición del plan", () => {
  const base = { pool, params, days: 7, name: "Semana", startDate: "2026-10-13", seed: "semilla-1" };

  it("genera un plan determinista, sin alérgenos y dentro de la tolerancia", () => {
    const a = generateDraft(base);
    const b = generateDraft(base);
    expect(a.items.map((i) => [i.recipeId, i.servings])).toEqual(b.items.map((i) => [i.recipeId, i.servings]));
    expect(a.params.seed).toBe("semilla-1");
    expect(a.items).toHaveLength(7 * 4);
    expect(a.items.some((i) => i.recipeId === "mani")).toBe(false);
    expect(a.params.generation?.excluded.allergens).toBe(1);
    const diag = computeDraftDiagnostics(a);
    expect(diag.allWithinTolerance).toBe(true);
    expect(diag.days).toHaveLength(7);
    // Otra semilla, otro plan.
    expect(generateDraft({ ...base, seed: "otra" }).items.map((i) => i.recipeId)).not.toEqual(a.items.map((i) => i.recipeId));
  });

  it("regenerar un día solo cambia ese día y es reproducible", () => {
    const draft = generateDraft(base);
    const r1 = regenerateDay(draft, 2, pool);
    const r2 = regenerateDay(draft, 2, pool);
    expect(r1.items.filter((i) => i.dayIndex !== 2).map((i) => i.key)).toEqual(draft.items.filter((i) => i.dayIndex !== 2).map((i) => i.key));
    expect(r1.items.filter((i) => i.dayIndex === 2)).toHaveLength(4);
    expect(r1.items.filter((i) => i.dayIndex === 2).map((i) => i.recipeId)).toEqual(r2.items.filter((i) => i.dayIndex === 2).map((i) => i.recipeId));
    expect(r1.params.regenerations).toBe(1);
  });

  it("propone cambios del mismo tipo de comida con kcal parecidas y sin repetir en el día", () => {
    const draft = generateDraft(base);
    const lunch = draft.items.find((i) => i.dayIndex === 0 && i.slotIndex === 1)!;
    const options = swapAlternatives(draft, lunch, pool);
    expect(options.length).toBeGreaterThan(0);
    const usedToday = new Set(draft.items.filter((i) => i.dayIndex === 0 && i.key !== lunch.key).map((i) => i.recipeId));
    for (const o of options) {
      expect(o.recipe.mealTypes).toContain("lunch");
      expect(o.recipe.id).not.toBe(lunch.recipeId);
      expect(usedToday.has(o.recipe.id)).toBe(false);
    }
    expect(Math.abs(options[0]!.kcal - lunch.kcal) / lunch.kcal).toBeLessThan(0.2);
  });

  it("ajusta porciones y gramos recalculando nutrientes", () => {
    const item = recipeItem(pool[0]!, 1, 0, 0);
    const scaled = updateItemAmount(item, 1.5, pool);
    expect(scaled).toMatchObject({ key: item.key, servings: 1.5, kcal: 570, proteinG: 27, cost: 4.5 });
    const food = foodItem({ id: "f", name: "Plátano", per100g: { energyKcal: 89, proteinG: 1.1, carbsG: 23, fatG: 0.3 } }, 120, 0, 2);
    expect(food).toMatchObject({ kind: "food", grams: 120, kcal: 106.8, cost: null });
    // Sin datos por 100 g a mano, se escala en proporción a lo guardado.
    expect(updateItemAmount(food, 60, pool)).toMatchObject({ grams: 60, kcal: 53.4 });
  });

  it("respeta alérgenos y dieta en las elecciones manuales", () => {
    expect(recipeAllowed(pool.find((r) => r.id === "mani")!, params)).toBe(false);
    expect(recipeAllowed(recipe("x", ["lunch"], 500, 20, { dietTags: ["vegan"] }), { avoidAllergens: [], dietPattern: "vegetarian" })).toBe(true);
    expect(recipeAllowed(recipe("y", ["lunch"], 500, 20), { avoidAllergens: [], dietPattern: "vegetarian" })).toBe(false);
  });

  it("numera las posiciones por hueco al guardar", () => {
    const d = emptyDraft({ name: "Manual", startDate: "2026-10-13", days: 2, params });
    d.items.push(recipeItem(pool[0]!, 1, 0, 0), recipeItem(pool[1]!, 1, 0, 0), recipeItem(pool[4]!, 1, 1, 1));
    expect(itemsWithPositions(d).map((i) => [i.dayIndex, i.position])).toEqual([
      [0, 0],
      [0, 1],
      [1, 10],
    ]);
  });
});

describe("diagnóstico del plan en edición", () => {
  it("informa huecos vacíos, proteína baja y presupuesto sin regañar", () => {
    const d = emptyDraft({ name: "Manual", startDate: "2026-10-13", days: 1, params: { ...params, weeklyBudget: 7 } });
    d.items.push(recipeItem(pool[4]!, 2, 0, 1));
    const diag = computeDraftDiagnostics(d);
    const day = diag.days[0]!;
    expect(day.emptySlots).toEqual(["Desayuno", "Media tarde", "Cena"]);
    expect(day.withinTolerance).toBe(false);
    expect(diag.budget).toBe(1);
    expect(diag.estimatedCost).toBe(6);
    expect(diag.overBudget).toBe(true);
    expect(diag.warnings.join(" ")).toMatch(/fuera de ±10 %/);
    expect(diag.warnings.join(" ")).toMatch(/sin asignar/);
    expect(diag.warnings.join(" ")).not.toMatch(/te pasaste|exceso/i);
  });

  it("sin meta no compara contra ella", () => {
    const d = emptyDraft({ name: "M", startDate: "2026-10-13", days: 1, params: { ...params, targetKcal: null, proteinG: null } });
    const diag = computeDraftDiagnostics(d);
    expect(diag.allWithinTolerance).toBeNull();
    expect(diag.days[0]!.deviationPct).toBeNull();
  });
});
