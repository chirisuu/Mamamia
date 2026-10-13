import { describe, expect, it } from "vitest";
import { aggregateHabitDays, evaluateBadges, evaluateChallenge } from "@/lib/nutrition";
import { buildHabitAggregates, toGamificationStats, type HabitInput } from "./habits";
import { isVegetableName, vegetableServings } from "./vegetables";

const targets = [{ effective_from: "2026-10-01", created_at: "2026-10-01T00:00:00Z", energy_kcal: 2000, protein_g: 100, water_ml: 2000 }];

function input(): HabitInput {
  return {
    mealLogs: [
      {
        local_date: "2026-10-10",
        meal_type: "breakfast",
        meal_log_items: [
          { name: "Avena", grams: 50, source: "search" },
          { name: "Plátano", grams: 100, source: "barcode" },
        ],
      },
      { local_date: "2026-10-10", meal_type: "lunch", meal_log_items: [{ name: "Ensalada de lechuga y tomate", grams: 200, source: "search" }] },
      { local_date: "2026-10-11", meal_type: "lunch", meal_log_items: [{ name: "Salsa de tomate", grams: 60, source: "manual" }] },
      { local_date: "2026-10-12", meal_type: "dinner", meal_log_items: [] },
    ],
    totals: [
      { local_date: "2026-10-10", protein_g: 95, items_count: 3 },
      { local_date: "2026-10-11", protein_g: 40, items_count: 1 },
    ],
    water: [
      { local_date: "2026-10-10", amount_ml: 1500 },
      { local_date: "2026-10-10", amount_ml: 750 },
      { local_date: "2026-10-12", amount_ml: 500 },
    ],
    exercise: [
      { local_date: "2026-10-11", duration_min: 20 },
      { local_date: "2026-10-11", duration_min: 15 },
    ],
    targets,
  };
}

describe("verduras por nombre (aproximación)", () => {
  it("reconoce verduras en español e inglés, sin tildes", () => {
    expect(isVegetableName("Brócoli al vapor")).toBe(true);
    expect(isVegetableName("Tomatoes, raw")).toBe(true);
    expect(isVegetableName("Zanahorias")).toBe(true);
  });
  it("excluye salsas, snacks y frutas", () => {
    expect(isVegetableName("Salsa de tomate")).toBe(false);
    expect(isVegetableName("Chips de papa")).toBe(false);
    expect(isVegetableName("Pollo a la brasa")).toBe(false);
    expect(isVegetableName(null)).toBe(false);
  });
  it("porciones de 80 g; menos de media porción no cuenta", () => {
    expect(vegetableServings([{ name: "Lechuga", grams: 240 }])).toBe(3);
    expect(vegetableServings([{ name: "Culantro", grams: 10 }, { name: "Cebolla", grams: 20 }])).toBe(0);
  });
});

describe("agregados reales por día", () => {
  it("cuenta ítems, agua, proteína, verduras, minutos y orígenes", () => {
    const agg = buildHabitAggregates(input());
    expect(agg.mealLogItemsTotal).toBe(4);
    expect(agg.logSourceCounts).toEqual({ search: 2, barcode: 1, manual: 1 });
    const d10 = agg.days.find((d) => d.date === "2026-10-10")!;
    expect(d10).toMatchObject({ itemsLogged: 3, waterMl: 2250, proteinG: 95, waterTargetMl: 2000, proteinTargetG: 100, vegetableServings: 2.5 });
    expect(agg.days.find((d) => d.date === "2026-10-11")).toMatchObject({ activityMinutes: 35, vegetableServings: 0 });
    // El reto de desayuno solo cuenta ítems del desayuno.
    expect(agg.breakfastDays.find((d) => d.date === "2026-10-10")?.itemsLogged).toBe(2);
    expect(agg.breakfastDays.find((d) => d.date === "2026-10-11")?.itemsLogged).toBe(0);

    expect(aggregateHabitDays(agg.days)).toEqual({ loggingDays: 2, waterGoalDays: 1, proteinGoalDays: 1, vegetableDays: 1 });
  });
});

describe("evaluación de logros", () => {
  const badges = [
    { code: "first_log", criteria: { type: "meal_log_items_total", min: 1 } },
    { code: "logging_days_7", criteria: { type: "logging_days", days: 7 } },
    { code: "first_barcode", criteria: { type: "log_source_used", source: "barcode", min: 1 } },
    { code: "first_weight", criteria: { type: "weight_logs_total", min: 1 } },
    { code: "unknown", criteria: { type: "steps_total", min: 1000 } },
  ];

  it("otorga solo lo cumplido, no repite y no otorga criterios desconocidos", () => {
    const agg = buildHabitAggregates(input());
    const stats = toGamificationStats(agg, aggregateHabitDays(agg.days), {
      recipesCreated: 0,
      weightLogsTotal: 0,
      mealPlansCreated: 0,
      challengesCompleted: 0,
    });
    const first = evaluateBadges(badges, stats);
    expect(first.newlyEarned.sort()).toEqual(["first_barcode", "first_log"]);
    const logging = first.results.find((r) => r.code === "logging_days_7")!;
    expect(logging).toMatchObject({ earned: false, current: 2, target: 7 });
    expect(first.results.find((r) => r.code === "unknown")?.supported).toBe(false);

    const again = evaluateBadges(badges, stats, ["first_log", "first_barcode"]);
    expect(again.newlyEarned).toEqual([]);
  });

  it("una insignia ganada no se pierde aunque bajen los agregados", () => {
    const r = evaluateBadges(badges, {}, ["first_weight"]);
    expect(r.results.find((x) => x.code === "first_weight")).toMatchObject({ earned: true, progress: 1 });
  });

  it("retos: suman días logrados desde el inicio, sin estado fallido", () => {
    const agg = buildHabitAggregates(input());
    const water = evaluateChallenge({ kind: "water", targetValue: 2000, durationDays: 7 }, { startedOn: "2026-10-09", today: "2026-10-13", days: agg.days });
    expect(water).toMatchObject({ qualifyingDays: 1, requiredDays: 7, completed: false });
    expect(water.message).toMatch(/no pasa nada/);

    const move = evaluateChallenge({ kind: "activity", targetValue: 30, durationDays: 1 }, { startedOn: "2026-10-11", today: "2026-10-13", days: agg.days });
    expect(move).toMatchObject({ completed: true, completedOn: "2026-10-11" });

    // Días antes de unirse no cuentan.
    const late = evaluateChallenge({ kind: "logging", targetValue: 1, durationDays: 2 }, { startedOn: "2026-10-11", today: "2026-10-13", days: agg.days });
    expect(late.qualifyingDays).toBe(1);
  });
});
