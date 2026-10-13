import { describe, expect, it } from "vitest";
import { toPer100g } from "./own-food";

const base = {
  energyKcal: 250,
  proteinG: 10,
  carbsG: 30,
  fatG: 8,
  fiberG: 3,
  sugarG: null,
  saturatedFatG: undefined,
  sodiumMg: 400,
};

describe("toPer100g", () => {
  it("deja igual los valores por 100 g", () => {
    const r = toPer100g({ ...base, basis: "per100g", basisGrams: null });
    expect(r).toEqual({
      ok: true,
      values: {
        energy_kcal: 250,
        protein_g: 10,
        carbs_g: 30,
        fat_g: 8,
        fiber_g: 3,
        sugar_g: null,
        saturated_fat_g: null,
        sodium_mg: 400,
      },
    });
  });

  it("convierte una porción a 100 g", () => {
    // Porción de 40 g con 160 kcal → 400 kcal por 100 g.
    const r = toPer100g({ ...base, energyKcal: 160, proteinG: 4, carbsG: 20, fatG: 6, basis: "perPortion", basisGrams: 40 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.values.energy_kcal).toBe(400);
      expect(r.values.protein_g).toBe(10);
      expect(r.values.carbs_g).toBe(50);
      expect(r.values.fat_g).toBe(15);
      expect(r.values.fiber_g).toBe(7.5);
      expect(r.values.sodium_mg).toBe(1000);
    }
  });

  it("rechaza valores imposibles por 100 g", () => {
    expect(toPer100g({ ...base, energyKcal: 950, basis: "per100g", basisGrams: null })).toMatchObject({ ok: false, field: "energyKcal" });
    expect(toPer100g({ ...base, proteinG: 101, basis: "per100g", basisGrams: null })).toMatchObject({ ok: false, field: "proteinG" });
    expect(toPer100g({ ...base, proteinG: 40, carbsG: 40, fatG: 40, basis: "per100g", basisGrams: null })).toMatchObject({
      ok: false,
      field: "proteinG",
    });
    // 30 g de grasa en una porción de 20 g → 150 g por 100 g.
    expect(toPer100g({ ...base, energyKcal: 100, proteinG: 1, carbsG: 1, fatG: 30, basis: "perPortion", basisGrams: 20 })).toMatchObject({ ok: false, field: "fatG" });
  });

  it("exige el peso de la porción", () => {
    expect(toPer100g({ ...base, basis: "perPortion", basisGrams: null })).toMatchObject({ ok: false, field: "basisGrams" });
  });
});
