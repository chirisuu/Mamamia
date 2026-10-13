import { describe, expect, it } from "vitest";
import { ACTIVITY_LEVELS, activityFactor, suggestActivityLevel, WORK_ACTIVITY_LABELS } from "./activity";
import { NutritionInputError } from "./errors";
import { ACTIVITY_LEVEL_CODES } from "./types";

describe("ACTIVITY_LEVELS", () => {
  it("usa los factores habituales", () => {
    expect(ACTIVITY_LEVELS.sedentary.factor).toBe(1.2);
    expect(ACTIVITY_LEVELS.light.factor).toBe(1.375);
    expect(ACTIVITY_LEVELS.moderate.factor).toBe(1.55);
    expect(ACTIVITY_LEVELS.active.factor).toBe(1.725);
    expect(ACTIVITY_LEVELS.very_active.factor).toBe(1.9);
  });

  it("cada nivel tiene etiqueta y descripción en español", () => {
    for (const code of ACTIVITY_LEVEL_CODES) {
      expect(ACTIVITY_LEVELS[code].label.length).toBeGreaterThan(3);
      expect(ACTIVITY_LEVELS[code].description.length).toBeGreaterThan(20);
    }
    expect(Object.keys(WORK_ACTIVITY_LABELS)).toEqual(["seated", "standing", "physical"]);
  });
});

describe("activityFactor", () => {
  it("devuelve el factor y valida el nivel", () => {
    expect(activityFactor("moderate")).toBe(1.55);
    // @ts-expect-error: valor inválido a propósito
    expect(() => activityFactor("extreme")).toThrow("El nivel de actividad no es válido.");
  });
});

describe("suggestActivityLevel", () => {
  it.each([
    [0, "seated", "sedentary"],
    [1, "seated", "light"],
    [2, "seated", "light"],
    [3, "seated", "moderate"],
    [5, "seated", "moderate"],
    [6, "seated", "active"],
    [7, "seated", "active"],
    [8, "seated", "very_active"],
    [0, "standing", "light"],
    [4, "standing", "active"],
    [0, "physical", "moderate"],
    [6, "physical", "very_active"],
    [14, "physical", "very_active"],
  ] as const)("%i sesiones + trabajo %s → %s", (days, work, level) => {
    const s = suggestActivityLevel({ trainingDaysPerWeek: days, work });
    expect(s.level).toBe(level);
    expect(s.factor).toBe(ACTIVITY_LEVELS[level].factor);
  });

  it("explica la sugerencia", () => {
    expect(suggestActivityLevel({ trainingDaysPerWeek: 1, work: "seated" }).reason).toContain("1 sesión de entrenamiento");
    expect(suggestActivityLevel({ trainingDaysPerWeek: 4, work: "physical" }).reason).toContain("«Muy activo»");
  });

  it("valida los datos", () => {
    expect(() => suggestActivityLevel({ trainingDaysPerWeek: 15, work: "seated" })).toThrow(NutritionInputError);
    expect(() => suggestActivityLevel({ trainingDaysPerWeek: 2.5, work: "seated" })).toThrow("debe ser un número entero");
    // @ts-expect-error: valor inválido a propósito
    expect(() => suggestActivityLevel({ trainingDaysPerWeek: 2, work: "office" })).toThrow("El tipo de trabajo no es válido.");
    // @ts-expect-error: valor inválido a propósito
    expect(() => suggestActivityLevel({ trainingDaysPerWeek: 2, work: "toString" })).toThrow(NutritionInputError);
  });
});
