import { describe, expect, it } from "vitest";
import { computeRecommendations, pickHighProteinRecipes, type RecommendationInput } from "./recommendations";

const base: RecommendationInput = {
  hour: 12,
  today: { itemsCount: 3, energyKcal: 900, proteinG: 60, fiberG: 12, sodiumMg: 800, incomplete: [] },
  yesterday: { logged: true, proteinG: 110 },
  target: { energyKcal: 2000, proteinG: 120, fiberG: 28 },
  daysLoggedLast7: 5,
  isNewUser: false,
  highProteinRecipes: [
    { title: "Pollo al horno", slug: "pollo-al-horno", proteinG: 42, energyKcal: 380 },
    { title: "Tortilla de claras", slug: "tortilla-de-claras", proteinG: 25, energyKcal: 200 },
    { title: "Otra", slug: "otra", proteinG: 30, energyKcal: 500 },
  ],
};

const ids = (input: RecommendationInput) => computeRecommendations(input).map((r) => r.id);

describe("computeRecommendations", () => {
  it("sin señales no sugiere nada", () => {
    expect(ids(base)).toEqual([]);
  });

  it("proteína baja hoy (desde las 15 h) enlaza recetas altas en proteína", () => {
    const recs = computeRecommendations({ ...base, hour: 16, today: { ...base.today, proteinG: 30 } });
    const protein = recs.find((r) => r.id === "protein")!;
    expect(protein.body).toContain("Llevas 30 g de 120 g de proteína");
    expect(protein.links.map((l) => l.href)).toEqual(["/app/recetas/pollo-al-horno", "/app/recetas/tortilla-de-claras", "/app/recetas"]);
  });

  it("proteína baja ayer también cuenta", () => {
    const recs = computeRecommendations({ ...base, yesterday: { logged: true, proteinG: 70 } });
    expect(recs[0]?.body).toContain("Ayer llegaste a 70 g");
  });

  it("no sugiere por proteína antes de las 15 h si ayer estuvo bien", () => {
    expect(ids({ ...base, hour: 11, today: { ...base.today, proteinG: 5 } })).toEqual([]);
  });

  it("fibra baja solo con datos completos", () => {
    const low = { ...base.today, fiberG: 5 };
    expect(ids({ ...base, hour: 17, today: low })).toEqual(["fiber"]);
    expect(ids({ ...base, hour: 17, today: { ...low, incomplete: ["fiberG"] } })).toEqual([]);
  });

  it("sodio sobre el límite de la OMS (marcado como mínimo si es incompleto)", () => {
    const recs = computeRecommendations({ ...base, today: { ...base.today, sodiumMg: 2300, incomplete: ["sodiumMg"] } });
    expect(recs[0]).toMatchObject({ id: "sodium", title: "Hoy llevas al menos 2,300 mg de sodio" });
  });

  it("de noche y muy por debajo de la meta, recuerda no quedarse con poco (primero)", () => {
    const recs = computeRecommendations({ ...base, hour: 20, today: { ...base.today, energyKcal: 700, proteinG: 20 } });
    expect(recs.map((r) => r.id)).toEqual(["low_intake", "protein"]);
  });

  it("constancia solo para quien no es nuevo", () => {
    expect(ids({ ...base, daysLoggedLast7: 1 })).toEqual(["consistency"]);
    expect(ids({ ...base, daysLoggedLast7: 1, isNewUser: true })).toEqual([]);
  });

  it("como máximo 3 sugerencias y nada sin meta salvo sodio/constancia", () => {
    const many = computeRecommendations({
      ...base,
      hour: 21,
      today: { itemsCount: 2, energyKcal: 500, proteinG: 10, fiberG: 2, sodiumMg: 2500, incomplete: [] },
      daysLoggedLast7: 0,
    });
    expect(many).toHaveLength(3);
    expect(ids({ ...base, target: null, today: { ...base.today, sodiumMg: 2500 } })).toEqual(["sodium"]);
  });
});

describe("pickHighProteinRecipes", () => {
  it("ordena por proteína por kcal y exige 20 g", () => {
    const picked = pickHighProteinRecipes([
      { title: "A", slug: "a", proteinG: 30, energyKcal: 600 },
      { title: "B", slug: "b", proteinG: 25, energyKcal: 200 },
      { title: "C", slug: "c", proteinG: 10, energyKcal: 100 },
      { title: "D", slug: "d", proteinG: null, energyKcal: 100 },
    ]);
    expect(picked.map((p) => p.slug)).toEqual(["b", "a"]);
  });
});
