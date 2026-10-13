import { describe, expect, it } from "vitest";
import { NutritionInputError } from "./errors";
import type { PlannerInput, PlannerRecipe } from "./planner";
import { createRng, generatePlan, MAX_SERVINGS, mealSlots, MIN_SERVINGS } from "./planner";

const recipe = (
  id: string,
  mealTypes: PlannerRecipe["mealTypes"],
  kcal: number,
  p: number,
  extra: Partial<PlannerRecipe> = {},
): PlannerRecipe => ({
  id,
  title: id,
  mealTypes,
  perServing: { kcal, p, c: ((kcal - p * 4) * 0.55) / 4, g: ((kcal - p * 4) * 0.45) / 9, fiber: 5 },
  allergens: [],
  dietTags: [],
  prepMinutes: 20,
  costPerServing: 5,
  ...extra,
});

/** Catálogo suficiente: 6 desayunos, 10 almuerzos/cenas, 5 snacks. */
const CATALOG: PlannerRecipe[] = [
  recipe("avena", ["breakfast"], 350, 15, { dietTags: ["vegetarian"] }),
  recipe("pan-huevo", ["breakfast"], 420, 22, { allergens: ["huevo", "gluten"], dietTags: ["vegetarian"] }),
  recipe("yogurt-granola", ["breakfast", "snack"], 300, 18, { allergens: ["lácteos"], dietTags: ["vegetarian"] }),
  recipe("quinua-desayuno", ["breakfast"], 380, 14, { dietTags: ["vegan", "vegetarian"] }),
  recipe("tortilla", ["breakfast", "dinner"], 400, 28, { allergens: ["huevo"], dietTags: ["vegetarian", "high_protein"] }),
  recipe("batido", ["breakfast", "snack"], 280, 25, { allergens: ["lácteos"], dietTags: ["high_protein"] }),
  recipe("lomo", ["lunch", "dinner"], 650, 40),
  recipe("aji-gallina", ["lunch"], 700, 35, { allergens: ["lácteos", "maní"], prepMinutes: 60 }),
  recipe("ceviche", ["lunch"], 450, 45, { allergens: ["pescado"], dietTags: ["pescatarian", "high_protein"] }),
  recipe("arroz-pollo", ["lunch", "dinner"], 680, 38),
  recipe("lentejas", ["lunch", "dinner"], 520, 26, { dietTags: ["vegan", "vegetarian"] }),
  recipe("pescado-plancha", ["lunch", "dinner"], 480, 42, { allergens: ["pescado"], dietTags: ["pescatarian"] }),
  recipe("tallarines", ["lunch", "dinner"], 720, 30, { allergens: ["gluten"], prepMinutes: 45 }),
  recipe("sopa-verduras", ["dinner"], 350, 20, { dietTags: ["vegan", "vegetarian"] }),
  recipe("ensalada-pollo", ["lunch", "dinner"], 420, 38, { dietTags: ["high_protein"] }),
  recipe("causa", ["lunch", "dinner"], 500, 22, { allergens: ["huevo"], dietTags: ["vegetarian"] }),
  recipe("fruta", ["snack"], 120, 2, { dietTags: ["vegan", "vegetarian"] }),
  recipe("mani", ["snack"], 200, 8, { allergens: ["maní"], dietTags: ["vegan", "vegetarian"] }),
  recipe("huevo-duro", ["snack"], 150, 12, { allergens: ["huevo"], dietTags: ["vegetarian"] }),
  recipe("palta-tostada", ["snack", "breakfast"], 250, 7, { allergens: ["gluten"], dietTags: ["vegan", "vegetarian"] }),
  recipe("keto-huevos", ["breakfast"], 450, 25, { dietTags: ["keto", "low_carb"] }),
];

const base: PlannerInput = { targetKcal: 2000, proteinG: 130, days: 7, mealsPerDay: 4, recipes: CATALOG, seed: "semilla-1" };

describe("mealSlots", () => {
  it.each([3, 4, 5])("%i comidas: las proporciones suman 100 %", (n) => {
    const slots = mealSlots(n);
    expect(slots).toHaveLength(n);
    expect(slots.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 10);
  });

  it("desayuno 25 %, almuerzo 35 %, cena 25 % y snacks el resto (4 y 5 comidas)", () => {
    expect(mealSlots(4).map((s) => [s.mealType, s.share])).toEqual([
      ["breakfast", 0.25],
      ["lunch", 0.35],
      ["snack", 0.15],
      ["dinner", 0.25],
    ]);
    expect(mealSlots(5).filter((s) => s.mealType === "snack").map((s) => s.label)).toEqual(["Media mañana", "Media tarde"]);
  });

  it("solo 3 a 5 comidas", () => {
    expect(() => mealSlots(2)).toThrow(NutritionInputError);
    expect(() => mealSlots(6)).toThrow(NutritionInputError);
  });
});

describe("createRng", () => {
  it("es determinista y está en [0, 1)", () => {
    const a = createRng("x");
    const b = createRng("x");
    const seqA = Array.from({ length: 20 }, () => a());
    expect(Array.from({ length: 20 }, () => b())).toEqual(seqA);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(createRng("y")()).not.toBe(createRng("x")());
    expect(createRng(42)()).toBe(createRng("42")());
  });
});

describe("generatePlan — determinismo y calidad", () => {
  it("misma entrada y semilla → mismo plan; otra semilla → otro plan", () => {
    expect(generatePlan(base)).toEqual(generatePlan(base));
    const other = generatePlan({ ...base, seed: "semilla-2" });
    expect(other.meals.map((m) => m.recipeId)).not.toEqual(generatePlan(base).meals.map((m) => m.recipeId));
    expect(generatePlan(base).generator).toBe("engine");
  });

  it.each([
    [1500, 110, 3],
    [2000, 130, 4],
    [2800, 160, 5],
    [1200, 90, 3],
    [3500, 180, 5],
  ])("7 días dentro de ±10 %% con recetas suficientes (%i kcal, %i g, %i comidas)", (targetKcal, proteinG, mealsPerDay) => {
    for (const seed of ["a", "b", 7]) {
      const plan = generatePlan({ ...base, targetKcal, proteinG, mealsPerDay, seed });
      expect(plan.diagnostics.withinTolerance).toBe(true);
      expect(plan.diagnostics.days).toHaveLength(7);
      for (const d of plan.diagnostics.days) {
        expect(Math.abs(d.deviationPct)).toBeLessThanOrEqual(10);
        expect(Math.abs(d.kcal - targetKcal) / targetKcal).toBeLessThanOrEqual(0.1);
      }
    }
  });

  it("nunca repite la misma receta el mismo día y escala en pasos de 0.25 entre 0.5 y 2.5", () => {
    const plan = generatePlan({ ...base, mealsPerDay: 5 });
    for (let d = 0; d < 7; d++) {
      const ids = plan.meals.filter((m) => m.dayIndex === d).map((m) => m.recipeId);
      expect(new Set(ids).size).toBe(ids.length);
    }
    for (const m of plan.meals) {
      expect(m.servings).toBeGreaterThanOrEqual(MIN_SERVINGS);
      expect(m.servings).toBeLessThanOrEqual(MAX_SERVINGS);
      expect((m.servings * 100) % 25).toBe(0);
    }
  });

  it("limita repeticiones semanales cuando hay opciones", () => {
    const plan = generatePlan({ ...base, mealsPerDay: 3, days: 4 });
    const counts = new Map<string, number>();
    for (const m of plan.meals) counts.set(m.recipeId, (counts.get(m.recipeId) ?? 0) + 1);
    expect(plan.diagnostics.repeatsRelaxed).toBe(false);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
  });

  it("calcula los nutrientes de cada comida según las porciones", () => {
    const plan = generatePlan(base);
    const m = plan.meals[0]!;
    const r = CATALOG.find((x) => x.id === m.recipeId)!;
    expect(m.kcal).toBeCloseTo(r.perServing.kcal * m.servings, 1);
    expect(m.proteinG).toBeCloseTo(r.perServing.p * m.servings, 1);
    expect(m.cost).toBeCloseTo(5 * m.servings, 2);
    expect(m.title).toBe(r.id);
    expect(m.slotTargetKcal).toBe(500);
    const day0 = plan.meals.filter((x) => x.dayIndex === 0);
    expect(day0.map((x) => x.position)).toEqual([0, 1, 2, 3]);
    expect(plan.diagnostics.days[0]!.kcal).toBeCloseTo(day0.reduce((s, x) => s + x.kcal, 0), 0);
  });

  it("informa la proteína del día y sube la proteína cuando puede", () => {
    const plan = generatePlan(base);
    for (const d of plan.diagnostics.days) {
      expect(d.proteinTargetG).toBe(130);
      expect(d.proteinPct).toBeCloseTo((d.proteinG / 130) * 100, 0);
    }
    const avg = plan.diagnostics.days.reduce((s, d) => s + d.proteinPct!, 0) / 7;
    expect(avg).toBeGreaterThan(85);
    expect(generatePlan({ ...base, proteinG: 0 }).diagnostics.days[0]!.proteinPct).toBeNull();
  });
});

describe("generatePlan — filtros", () => {
  it("excluye alérgenos (sin importar tildes ni mayúsculas)", () => {
    const plan = generatePlan({ ...base, avoidAllergens: ["MANI", "Lacteos"] });
    const banned = new Set(CATALOG.filter((r) => r.allergens.some((a) => /man[ií]|l[aá]cteos/.test(a))).map((r) => r.id));
    expect(plan.meals.some((m) => banned.has(m.recipeId))).toBe(false);
    expect(plan.diagnostics.excluded.allergens).toBe(banned.size);
  });

  it("vegetariano acepta recetas veganas; excluye el resto", () => {
    const plan = generatePlan({ ...base, dietPattern: "vegetarian", mealsPerDay: 3 });
    const ok = new Set(CATALOG.filter((r) => r.dietTags.includes("vegetarian") || r.dietTags.includes("vegan")).map((r) => r.id));
    expect(plan.meals.every((m) => ok.has(m.recipeId))).toBe(true);
    expect(plan.diagnostics.excluded.diet).toBe(CATALOG.length - ok.size);
  });

  it("pescetariano y keto son filtros; alta proteína es una preferencia", () => {
    const pesc = generatePlan({ ...base, dietPattern: "pescatarian" });
    // Sin etiqueta pescetariana/vegetariana/vegana: batido, lomo, ají de gallina, arroz con pollo, tallarines,
    // ensalada de pollo y huevos keto.
    expect(pesc.diagnostics.excluded.diet).toBe(7);
    const keto = generatePlan({ ...base, dietPattern: "keto", mealsPerDay: 3, days: 1 });
    expect(keto.meals.every((m) => m.recipeId === "keto-huevos")).toBe(true);
    expect(keto.diagnostics.days[0]!.emptySlots).toEqual(["Almuerzo", "Cena"]);
    const hp = generatePlan({ ...base, dietPattern: "high_protein" });
    expect(hp.diagnostics.excluded.diet).toBe(0);
    expect(generatePlan({ ...base, dietPattern: "omnivore" }).diagnostics.excluded.diet).toBe(0);
  });

  it("respeta el tiempo máximo (y excluye recetas sin tiempo registrado)", () => {
    const recipes = [...CATALOG, recipe("sin-tiempo", ["lunch"], 600, 30, { prepMinutes: null })];
    const plan = generatePlan({ ...base, recipes, maxPrepMinutes: 30 });
    expect(plan.diagnostics.excluded.prepTime).toBe(3);
    expect(plan.meals.some((m) => ["aji-gallina", "tallarines", "sin-tiempo"].includes(m.recipeId))).toBe(false);
  });

  it("omite recetas inválidas o con id repetido", () => {
    const broken = [
      ...CATALOG,
      recipe("cero", ["lunch"], 0, 0),
      recipe("lomo", ["lunch"], 500, 20),
      { ...recipe("sin-listas", ["lunch"], 500, 20), allergens: undefined as unknown as string[] },
      recipe("negativo", ["lunch"], 500, -1),
      recipe("  ", ["lunch"], 500, 10),
    ];
    const plan = generatePlan({ ...base, recipes: broken });
    expect(plan.diagnostics.excluded.invalid).toBe(5);
    expect(plan.diagnostics.recipesProvided).toBe(CATALOG.length + 5);
    expect(plan.diagnostics.recipesEligible).toBe(CATALOG.length);
    expect(plan.diagnostics.warnings.some((w) => w.includes("Omitimos 5"))).toBe(true);
  });
});

describe("generatePlan — diagnósticos honestos", () => {
  it("sin recetas que cumplan los filtros", () => {
    const plan = generatePlan({ ...base, recipes: [], days: 2 });
    expect(plan.meals).toEqual([]);
    expect(plan.diagnostics.withinTolerance).toBe(false);
    expect(plan.diagnostics.warnings[0]).toContain("Ninguna receta cumple tus filtros");
    expect(plan.diagnostics.days[0]!.emptySlots).toHaveLength(4);
    expect(plan.diagnostics.days[0]!.issues.some((i) => i.includes("Quedó a"))).toBe(true);
    expect(plan.diagnostics.estimatedCost).toBeNull();
  });

  it("recetas insuficientes en kcal: lo dice en vez de inventar", () => {
    const tiny = [recipe("b", ["breakfast"], 100, 5), recipe("l", ["lunch"], 100, 5), recipe("d", ["dinner"], 100, 5)];
    const plan = generatePlan({ ...base, recipes: tiny, mealsPerDay: 3, targetKcal: 3000, days: 1 });
    const d = plan.diagnostics.days[0]!;
    expect(d.withinTolerance).toBe(false);
    expect(d.kcal).toBe(750); // 3 × 2.5 porciones × 100 kcal
    expect(d.issues.join(" ")).toContain("no hay suficientes recetas");
    expect(d.issues.join(" ")).toContain("La proteína quedó");
  });

  it("sin snacks disponibles, el espacio queda vacío pero el día se compensa con porciones", () => {
    const noSnacks = CATALOG.filter((r) => !r.mealTypes.includes("snack"));
    const plan = generatePlan({ ...base, recipes: noSnacks, days: 2 });
    const d = plan.diagnostics.days[0]!;
    expect(d.emptySlots).toEqual(["Media tarde"]);
    expect(d.issues[0]).toContain("Media tarde");
    expect(d.withinTolerance).toBe(true);
  });

  it("cambia recetas si con porciones no alcanza", () => {
    // Por presupuesto se elige primero el almuerzo «chico», que no permite llegar a la meta
    // ni con 2.5 porciones; el ajuste del día lo cambia por el que sí encaja (las kcal mandan).
    const recipes = [
      recipe("b", ["breakfast"], 200, 10),
      recipe("l-chico", ["lunch"], 100, 5, { costPerServing: 0 }),
      recipe("l-grande", ["lunch"], 700, 30, { costPerServing: 100 }),
      recipe("d", ["dinner"], 200, 10),
    ];
    const plan = generatePlan({ ...base, recipes, mealsPerDay: 3, days: 1, weeklyBudget: 7 });
    expect(plan.diagnostics.withinTolerance).toBe(true);
    expect(plan.meals.find((m) => m.mealType === "lunch")!.recipeId).toBe("l-grande");
    expect(plan.diagnostics.overBudget).toBe(true);
  });

  it("relaja el límite de repeticiones si faltan opciones y lo avisa", () => {
    const few = [recipe("b1", ["breakfast"], 500, 25), recipe("l1", ["lunch"], 700, 35), recipe("d1", ["dinner"], 500, 25)];
    const plan = generatePlan({ ...base, recipes: few, mealsPerDay: 3, days: 5 });
    expect(plan.diagnostics.repeatsRelaxed).toBe(true);
    expect(plan.diagnostics.warnings.some((w) => w.includes("se repiten más de 2 veces"))).toBe(true);
    expect(plan.meals).toHaveLength(15);
  });

  it("costo estimado vs presupuesto", () => {
    const over = generatePlan({ ...base, weeklyBudget: 50 });
    expect(over.diagnostics.budget).toBe(50);
    expect(over.diagnostics.overBudget).toBe(true);
    expect(over.diagnostics.estimatedCost!).toBeGreaterThan(50);
    expect(over.diagnostics.warnings.some((w) => w.includes("supera el presupuesto"))).toBe(true);

    const under = generatePlan({ ...base, weeklyBudget: 1000, days: 3 });
    expect(under.diagnostics.budget).toBeCloseTo((1000 * 3) / 7, 2);
    expect(under.diagnostics.overBudget).toBe(false);

    const noBudget = generatePlan(base);
    expect(noBudget.diagnostics.budget).toBeNull();
    expect(noBudget.diagnostics.overBudget).toBeNull();
  });

  it("costo parcial: no afirma estar dentro del presupuesto", () => {
    const recipes = CATALOG.map((r, i) => (i % 2 === 0 ? { ...r, costPerServing: null } : r));
    const plan = generatePlan({ ...base, recipes, weeklyBudget: 1000 });
    expect(plan.diagnostics.costIsPartial).toBe(true);
    expect(plan.diagnostics.overBudget).toBeNull();
    expect(plan.diagnostics.warnings.some((w) => w.includes("parcial"))).toBe(true);
    const none = generatePlan({ ...base, recipes: CATALOG.map((r) => ({ ...r, costPerServing: undefined })) });
    expect(none.diagnostics.estimatedCost).toBeNull();
  });

  it("con presupuesto ajustado prefiere recetas más baratas", () => {
    const recipes = CATALOG.map((r) => ({ ...r, costPerServing: r.id === "lomo" || r.id === "ceviche" ? 40 : 4 }));
    const cheap = generatePlan({ ...base, recipes, weeklyBudget: 150 });
    expect(cheap.meals.some((m) => m.recipeId === "lomo" || m.recipeId === "ceviche")).toBe(false);
  });
});

describe("generatePlan — validación", () => {
  it("rechaza entradas fuera de rango", () => {
    expect(() => generatePlan({ ...base, days: 0 })).toThrow("Los días del plan debe estar entre 1 y 7.");
    expect(() => generatePlan({ ...base, days: 8 })).toThrow(NutritionInputError);
    expect(() => generatePlan({ ...base, mealsPerDay: 6 })).toThrow(NutritionInputError);
    expect(() => generatePlan({ ...base, targetKcal: 400 })).toThrow(NutritionInputError);
    expect(() => generatePlan({ ...base, proteinG: -1 })).toThrow(NutritionInputError);
    expect(() => generatePlan({ ...base, maxPrepMinutes: 0 })).toThrow(NutritionInputError);
    expect(() => generatePlan({ ...base, weeklyBudget: -1 })).toThrow(NutritionInputError);
    expect(() => generatePlan({ ...base, maxRepeatsPerRecipe: 0 })).toThrow(NutritionInputError);
    // @ts-expect-error: valor inválido a propósito
    expect(() => generatePlan({ ...base, dietPattern: "paleo" })).toThrow("El tipo de dieta no es válido.");
    // @ts-expect-error: valor inválido a propósito
    expect(() => generatePlan({ ...base, recipes: null })).toThrow("Las recetas deben ser una lista.");
    expect(() => generatePlan({ ...base, seed: Number.NaN })).toThrow("La semilla debe ser un número o un texto.");
  });
});
