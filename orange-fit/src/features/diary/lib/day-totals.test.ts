import { describe, expect, it } from "vitest";
import { buildMealSections, mealKey, parseMealKey, summarizeItems } from "./day-totals";
import type { DiaryItem } from "../types";

function item(partial: Partial<DiaryItem> & { id: string; mealLogId: string }): DiaryItem {
  return {
    kind: "food",
    foodId: null,
    recipeId: null,
    recipeSlug: null,
    name: "x",
    brandName: null,
    quantity: 100,
    unit: "g",
    grams: 100,
    energyKcal: 100,
    proteinG: 10,
    carbsG: 10,
    fatG: 2,
    fiberG: 1,
    sugarG: 1,
    sodiumMg: 10,
    source: "search",
    provenance: "",
    isEstimate: false,
    isAi: false,
    food: null,
    ...partial,
  };
}

describe("summarizeItems", () => {
  it("suma y marca incompletos", () => {
    const t = summarizeItems([
      item({ id: "1", mealLogId: "m", energyKcal: 120.25, fiberG: 2, sugarG: null, sodiumMg: null }),
      item({ id: "2", mealLogId: "m", energyKcal: 80.3, fiberG: 3.5, sugarG: null, sodiumMg: 100 }),
    ]);
    expect(t.itemsCount).toBe(2);
    expect(t.energyKcal).toBe(200.6);
    expect(t.fiberG).toBe(5.5);
    expect(t.sugarG).toBeNull();
    expect(t.sodiumMg).toBe(100);
    expect(t.incomplete).toEqual(["sugarG", "sodiumMg"]);
  });

  it("día vacío", () => {
    expect(summarizeItems([])).toMatchObject({ itemsCount: 0, energyKcal: 0, fiberG: null, incomplete: [] });
  });
});

describe("buildMealSections", () => {
  it("siempre muestra las 4 comidas estándar y luego las personalizadas por creación", () => {
    const sections = buildMealSections(
      [
        { id: "L", mealType: "lunch", customName: null, createdAt: "2026-10-13T17:00:00Z" },
        { id: "C2", mealType: "custom", customName: "Post entreno", createdAt: "2026-10-13T20:00:00Z" },
        { id: "C1", mealType: "custom", customName: "Media mañana", createdAt: "2026-10-13T15:00:00Z" },
      ],
      [item({ id: "a", mealLogId: "L", energyKcal: 500 }), item({ id: "b", mealLogId: "C2", energyKcal: 200 })],
    );
    expect(sections.map((s) => s.label)).toEqual(["Desayuno", "Almuerzo", "Cena", "Snacks", "Media mañana", "Post entreno"]);
    expect(sections[0]!.id).toBeNull();
    expect(sections[1]!.kcal).toBe(500);
    expect(sections[5]!.items).toHaveLength(1);
  });
});

describe("mealKey", () => {
  it("ida y vuelta", () => {
    expect(mealKey({ mealType: "lunch", customName: null })).toBe("lunch");
    expect(parseMealKey("custom:Post entreno")).toEqual({ mealType: "custom", customName: "Post entreno" });
    expect(parseMealKey("dinner")).toEqual({ mealType: "dinner", customName: null });
    expect(parseMealKey("custom:")).toBeNull();
    expect(parseMealKey("brunch")).toBeNull();
  });
});
