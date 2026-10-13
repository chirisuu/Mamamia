import { describe, expect, it } from "vitest";
import { assertSex, bmrWarnings, mifflinFormula, mifflinStJeor } from "./bmr";
import { NutritionInputError } from "./errors";

describe("mifflinStJeor", () => {
  it("hombre: 10 × kg + 6.25 × cm − 5 × edad + 5", () => {
    expect(mifflinStJeor({ sex: "male", weightKg: 80, heightCm: 175, ageYears: 30 })).toBeCloseTo(1748.75, 10);
  });

  it("mujer: 10 × kg + 6.25 × cm − 5 × edad − 161", () => {
    expect(mifflinStJeor({ sex: "female", weightKg: 60, heightCm: 165, ageYears: 25 })).toBeCloseTo(1345.25, 10);
  });

  it("la diferencia entre sexos es 166 kcal con los mismos datos", () => {
    const base = { weightKg: 70, heightCm: 170, ageYears: 40 };
    expect(mifflinStJeor({ ...base, sex: "male" }) - mifflinStJeor({ ...base, sex: "female" })).toBe(166);
  });

  it("valida edad, sexo, peso y talla", () => {
    const ok = { sex: "male" as const, weightKg: 70, heightCm: 170, ageYears: 30 };
    expect(() => mifflinStJeor({ ...ok, ageYears: 12 })).toThrow("La edad debe estar entre 13 y 100 años.");
    expect(() => mifflinStJeor({ ...ok, ageYears: 101 })).toThrow(NutritionInputError);
    expect(() => mifflinStJeor({ ...ok, weightKg: 10 })).toThrow(NutritionInputError);
    expect(() => mifflinStJeor({ ...ok, heightCm: 300 })).toThrow(NutritionInputError);
    // @ts-expect-error: valor inválido a propósito
    expect(() => mifflinStJeor({ ...ok, sex: "x" })).toThrow("El sexo para el cálculo debe ser hombre o mujer.");
  });
});

describe("assertSex", () => {
  it("devuelve el sexo válido y rechaza no textos", () => {
    expect(assertSex("female")).toBe("female");
    expect(() => assertSex(1)).toThrow(NutritionInputError);
  });
});

describe("mifflinFormula", () => {
  it("muestra los valores del usuario", () => {
    expect(mifflinFormula({ sex: "male", weightKg: 80, heightCm: 175, ageYears: 30 })).toBe(
      "10 × 80 kg + 6.25 × 175 cm − 5 × 30 años + 5",
    );
    expect(mifflinFormula({ sex: "female", weightKg: 60.5, heightCm: 162.5, ageYears: 41 })).toBe(
      "10 × 60.5 kg + 6.25 × 162.5 cm − 5 × 41 años − 161",
    );
  });
});

describe("bmrWarnings", () => {
  it("avisa fuera del rango de validación (19–78 años)", () => {
    expect(bmrWarnings({ ageYears: 16 })[0]).toContain("menores de 18");
    expect(bmrWarnings({ ageYears: 30 })).toEqual([]);
    expect(bmrWarnings({ ageYears: 78 })).toEqual([]);
    expect(bmrWarnings({ ageYears: 80 })[0]).toContain("19 a 78 años");
  });
});
