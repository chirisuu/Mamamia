import { describe, expect, it } from "vitest";
import { NutritionInputError } from "./errors";
import type { NutrientsPer100g } from "./portions";
import { divideNutrients, emptyNutrients, roundNutrients, scaleNutrients, sumNutrients } from "./portions";

const rice: NutrientsPer100g = {
  energyKcal: 130,
  proteinG: 2.7,
  carbsG: 28,
  fatG: 0.3,
  fiberG: 0.4,
  sugarG: null,
  sodiumMg: 1,
  micronutrients: { iron: 0.2 },
};

describe("scaleNutrients", () => {
  it("escala los 8 núcleo y los micronutrientes por gramos / 100", () => {
    const n = scaleNutrients(rice, 150);
    expect(n.energyKcal).toBeCloseTo(195, 10);
    expect(n.proteinG).toBeCloseTo(4.05, 10);
    expect(n.carbsG).toBeCloseTo(42, 10);
    expect(n.fatG).toBeCloseTo(0.45, 10);
    expect(n.fiberG).toBeCloseTo(0.6, 10);
    expect(n.sugarG).toBeNull();
    expect(n.saturatedFatG).toBeNull(); // no venía (undefined)
    expect(n.sodiumMg).toBeCloseTo(1.5, 10);
    expect(n.micronutrients.iron).toBeCloseTo(0.3, 10);
  });

  it("0 g → ceros; sin micronutrientes → objeto vacío", () => {
    const n = scaleNutrients({ energyKcal: 100, proteinG: 1, carbsG: 1, fatG: 1, micronutrients: null }, 0);
    expect(n.energyKcal).toBe(0);
    expect(n.micronutrients).toEqual({});
  });

  it("valida gramos y valores", () => {
    expect(() => scaleNutrients(rice, -1)).toThrow("Los gramos no puede ser negativo.");
    expect(() => scaleNutrients({ ...rice, proteinG: -1 }, 100)).toThrow(NutritionInputError);
    expect(() => scaleNutrients({ ...rice, fiberG: -1 }, 100)).toThrow("La fibra no puede ser negativo.");
    expect(() => scaleNutrients({ ...rice, micronutrients: { iron: -1 } }, 100)).toThrow(NutritionInputError);
  });
});

describe("sumNutrients", () => {
  it("lista vacía → ceros completos", () => {
    expect(sumNutrients([])).toEqual(emptyNutrients());
  });

  it("suma y marca como incompletos los opcionales que faltan en algún ítem", () => {
    const a = scaleNutrients(rice, 100);
    const b = scaleNutrients({ energyKcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: null, sugarG: null, sodiumMg: 74 }, 100);
    const total = sumNutrients([a, b]);
    expect(total.energyKcal).toBeCloseTo(295, 10);
    expect(total.proteinG).toBeCloseTo(33.7, 10);
    expect(total.fiberG).toBeCloseTo(0.4, 10); // mínimo: falta en b
    expect(total.sugarG).toBeNull(); // falta en todos
    expect(total.saturatedFatG).toBeNull();
    expect(total.sodiumMg).toBeCloseTo(75, 10);
    expect(total.incomplete).toEqual(["fiberG", "sugarG", "saturatedFatG"]);
    expect(total.micronutrients).toEqual({ iron: 0.2 });
    expect(total.incompleteMicronutrients).toEqual(["iron"]);
  });

  it("propaga las marcas de totales ya incompletos", () => {
    const partial = { ...emptyNutrients(), energyKcal: 100, incomplete: ["sodiumMg" as const], incompleteMicronutrients: ["zinc"] };
    const total = sumNutrients([partial, partial]);
    expect(total.energyKcal).toBe(200);
    expect(total.incomplete).toEqual(["sodiumMg"]);
    expect(total.incompleteMicronutrients).toEqual(["zinc"]);
  });

  it("rechaza valores obligatorios inválidos", () => {
    expect(() => sumNutrients([{ ...emptyNutrients(), energyKcal: Number.NaN }])).toThrow("La energía debe ser un número válido.");
  });
});

describe("roundNutrients y divideNutrients", () => {
  it("redondea conservando nulos", () => {
    const n = roundNutrients(scaleNutrients(rice, 33), 1);
    expect(n.energyKcal).toBe(42.9);
    expect(n.proteinG).toBe(0.9);
    expect(n.sugarG).toBeNull();
    expect(n.micronutrients.iron).toBe(0.1);
    const full = roundNutrients({ ...emptyNutrients(), saturatedFatG: 1.234, sodiumMg: 2.345, sugarG: 3.456, fiberG: null });
    expect(full).toMatchObject({ saturatedFatG: 1.23, sodiumMg: 2.35, sugarG: 3.46, fiberG: null });
  });

  it("divide totales y conserva marcas", () => {
    const total = sumNutrients([scaleNutrients(rice, 200), scaleNutrients({ ...rice, fiberG: null }, 100)]);
    const half = divideNutrients(total, 2);
    expect(half.energyKcal).toBeCloseTo(195, 10);
    expect(half.fiberG).toBeCloseTo(0.4, 10);
    expect(half.sugarG).toBeNull();
    expect(half.incomplete).toContain("fiberG");
    expect(half.micronutrients.iron).toBeCloseTo(0.3, 10);
    const withValues = divideNutrients({ ...emptyNutrients(), sugarG: 4, saturatedFatG: 2, sodiumMg: 10, fiberG: null }, 2);
    expect(withValues).toMatchObject({ sugarG: 2, saturatedFatG: 1, sodiumMg: 5, fiberG: null });
    expect(() => divideNutrients(total, 0)).toThrow("El divisor debe ser mayor que 0.");
  });
});
