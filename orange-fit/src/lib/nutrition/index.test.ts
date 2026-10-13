import { describe, expect, it } from "vitest";
import * as engine from "./index";

describe("index", () => {
  it("reexporta las funciones públicas de cada módulo", () => {
    for (const name of [
      "computeBmi",
      "mifflinStJeor",
      "suggestActivityLevel",
      "computeTargets",
      "screenRisk",
      "toGrams",
      "scaleNutrients",
      "recipeNutrition",
      "dailyBudget",
      "estimateExercise",
      "weightTrend",
      "computeStreaks",
      "canStartFasting",
      "generatePlan",
      "buildShoppingList",
      "evaluateBadges",
      "waterTarget",
      "roundKcal",
      "parseHealthFlags",
    ] as const) {
      expect(typeof engine[name]).toBe("function");
    }
    expect(engine.NutritionInputError).toBeTypeOf("function");
  });

  it("flujo completo: metas → plan dentro de ±10 % respetando el riesgo", () => {
    const targets = engine.computeTargets({
      sex: "female",
      ageYears: 32,
      heightCm: 160,
      weightKg: 68,
      activityLevel: "light",
      goal: "lose_fat",
      weeklyRateKg: 0.4,
    });
    expect(targets.risk.blocks.autoPlans).toBe(false);
    const recipes: engine.PlannerRecipe[] = [
      ["d1", "breakfast", 350, 20],
      ["d2", "breakfast", 300, 18],
      ["d3", "breakfast", 400, 25],
      ["a1", "lunch", 550, 40],
      ["a2", "lunch", 600, 35],
      ["a3", "lunch", 500, 38],
      ["c1", "dinner", 450, 30],
      ["c2", "dinner", 400, 32],
      ["c3", "dinner", 500, 28],
    ].map(([id, meal, kcal, p]) => ({
      id: id as string,
      mealTypes: [meal as engine.MealType],
      perServing: { kcal: kcal as number, p: p as number, c: 40, g: 12, fiber: 6 },
      allergens: [],
      dietTags: [],
      prepMinutes: 20,
    }));
    const plan = engine.generatePlan({
      targetKcal: targets.energyKcal,
      proteinG: targets.proteinG,
      days: 3,
      mealsPerDay: 3,
      recipes,
      seed: "flujo",
    });
    expect(plan.diagnostics.withinTolerance).toBe(true);
  });
});
