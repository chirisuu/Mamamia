import { describe, expect, it } from "vitest";
import { fittingServings, recommendForToday } from "./recommend";
import { card } from "./test-fixtures";

const pollo = card({ id: "pollo", title: "Pollo al horno", meal_types: ["lunch", "dinner"], allergens: [], diet_tags: ["high_protein"] }, { per_serving_energy_kcal: 400, per_serving_protein_g: 40 });
const pasta = card({ id: "pasta", title: "Tallarines", meal_types: ["lunch"], allergens: ["gluten"], diet_tags: ["vegetarian"] }, { per_serving_energy_kcal: 600, per_serving_protein_g: 15 });
const yogurt = card({ id: "yogurt", title: "Yogurt con fruta", meal_types: ["snack"], allergens: ["lactosa"], diet_tags: ["vegetarian"] }, { per_serving_energy_kcal: 180, per_serving_protein_g: 18 });
const sinDatos = card({ id: "vacia", title: "Sin ingredientes" }, { ingredients_count: 0 });

describe("fittingServings", () => {
  it("elige la mayor porción en pasos de 0.25 que no se pasa", () => {
    expect(fittingServings(400, 500)).toBe(1.25);
    expect(fittingServings(400, 2000)).toBe(2);
    expect(fittingServings(400, 150)).toBeNull();
    expect(fittingServings(0, 500)).toBeNull();
  });
});

describe("recommendForToday", () => {
  it("sin meta no sugiere nada", () => {
    expect(recommendForToday([pollo], { remainingKcal: null, remainingProteinG: null }).status).toBe("no_target");
  });

  it("con la meta cubierta lo informa sin sugerir", () => {
    expect(recommendForToday([pollo], { remainingKcal: 100, remainingProteinG: 0 })).toEqual({ status: "met", items: [] });
    expect(recommendForToday([pollo], { remainingKcal: -300, remainingProteinG: 0 }).status).toBe("met");
  });

  it("prioriza proteína y nunca se pasa de las kcal restantes", () => {
    const res = recommendForToday([pasta, pollo, yogurt, sinDatos], { remainingKcal: 700, remainingProteinG: 50, mealType: "lunch" });
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(res.items[0]!.card.id).toBe("pollo");
    for (const item of res.items) expect(item.kcal).toBeLessThanOrEqual(700);
    expect(res.items.map((i) => i.card.id)).not.toContain("vacia");
    expect(res.items[0]!.reason).toMatch(/proteína/);
  });

  it("respeta alérgenos y patrón de dieta", () => {
    const res = recommendForToday([pasta, pollo, yogurt], { remainingKcal: 900, remainingProteinG: 40, avoidAllergens: ["lactosa"], dietPattern: "vegetarian" });
    expect(res.status === "ok" && res.items.map((i) => i.card.id)).toEqual(["pasta"]);
    const none = recommendForToday([yogurt], { remainingKcal: 900, remainingProteinG: 40, avoidAllergens: ["lactosa"] });
    expect(none.status).toBe("none");
  });
});
