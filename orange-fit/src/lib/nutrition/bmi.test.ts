import { describe, expect, it } from "vitest";
import { BMI_CATEGORIES, bmiReport, classifyBmi, computeBmi, weightForBmi } from "./bmi";
import { NutritionInputError } from "./errors";

describe("computeBmi", () => {
  it("calcula peso / talla²", () => {
    expect(computeBmi(70, 175)).toBeCloseTo(22.857, 3);
    expect(computeBmi(64, 160)).toBeCloseTo(25, 10);
  });

  it("valida rangos de peso y talla", () => {
    expect(() => computeBmi(19, 170)).toThrow(NutritionInputError);
    expect(() => computeBmi(401, 170)).toThrow("El peso debe estar entre 20 y 400 kg.");
    expect(() => computeBmi(70, 99)).toThrow("La talla debe estar entre 100 y 250 cm.");
    expect(() => computeBmi(70, 251)).toThrow(NutritionInputError);
    expect(() => computeBmi(Number.NaN, 170)).toThrow("El peso debe ser un número válido.");
  });
});

describe("classifyBmi (OMS, redondeado a 1 decimal)", () => {
  it.each([
    [16, "underweight"],
    [18.4, "underweight"],
    [18.44, "underweight"],
    [18.45, "normal"],
    [18.5, "normal"],
    [24.9, "normal"],
    [24.96, "overweight"],
    [25, "overweight"],
    [29.9, "overweight"],
    [30, "obesity_1"],
    [34.9, "obesity_1"],
    [35, "obesity_2"],
    [39.9, "obesity_2"],
    [40, "obesity_3"],
    [65, "obesity_3"],
  ] as const)("IMC %s → %s", (bmi, category) => {
    expect(classifyBmi(bmi)).toBe(category);
  });

  it("todas las categorías tienen etiqueta en español", () => {
    expect(BMI_CATEGORIES.obesity_2.label).toBe("Obesidad grado II");
    expect(BMI_CATEGORIES.normal.label).toBe("Peso normal");
  });
});

describe("weightForBmi", () => {
  it("devuelve el peso para un IMC y talla", () => {
    expect(weightForBmi(25, 160)).toBeCloseTo(64, 10);
    expect(weightForBmi(18.5, 175)).toBeCloseTo(56.65625, 10);
  });

  it("valida el IMC y la talla", () => {
    expect(() => weightForBmi(5, 170)).toThrow("El IMC debe estar entre 10 y 60.");
    expect(() => weightForBmi(25, 90)).toThrow(NutritionInputError);
  });
});

describe("bmiReport", () => {
  it("resume IMC, categoría y rango normal para la talla", () => {
    const r = bmiReport(70, 175);
    expect(r.bmi).toBe(22.9);
    expect(r.category).toBe("normal");
    expect(r.label).toBe("Peso normal");
    expect(r.normalRangeKg).toEqual({ min: 56.7, max: 76.3 });
    expect(r.notes).toHaveLength(1);
  });

  it("agrega una nota para menores de 18", () => {
    const r = bmiReport(55, 160, 16);
    expect(r.notes).toHaveLength(2);
    expect(r.notes[1]).toContain("menores de 18");
    expect(bmiReport(55, 160, 30).notes).toHaveLength(1);
  });
});
