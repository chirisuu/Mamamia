import { describe, expect, it } from "vitest";
import { dailyBudget } from "./energy-balance";
import { NutritionInputError } from "./errors";

describe("dailyBudget", () => {
  it("por defecto el ejercicio NO suma (evita contarlo dos veces) y se explica", () => {
    const b = dailyBudget({ targetKcal: 2000, exerciseKcal: 300, countExercise: false });
    expect(b).toMatchObject({ base: 2000, exercise: 0, exerciseLogged: 300, adjustments: 0, total: 2000, remaining: 2000 });
    expect(b.consumed).toBeUndefined();
    expect("consumed" in b).toBe(false);
    expect(b.explanation.join(" ")).toContain("no se suman");
  });

  it("si el usuario lo activa, suma las kcal netas de ejercicio", () => {
    const b = dailyBudget({ targetKcal: 2000, exerciseKcal: 300.4, countExercise: true });
    expect(b.exercise).toBe(300);
    expect(b.total).toBe(2300);
    expect(b.explanation[1]).toContain("contándolo dos veces");
  });

  it("activado pero sin ejercicio registrado", () => {
    const b = dailyBudget({ targetKcal: 2000, countExercise: true });
    expect(b.total).toBe(2000);
    expect(b.explanation[1]).toContain("no hay ejercicio registrado");
  });

  it("sin ejercicio y sin activar no agrega texto de ejercicio", () => {
    expect(dailyBudget({ targetKcal: 1800, countExercise: false }).explanation).toEqual(["Base: tu meta diaria de 1800 kcal."]);
  });

  it("aplica ajustes manuales positivos o negativos", () => {
    expect(dailyBudget({ targetKcal: 2000, countExercise: false, manualAdjustmentKcal: -200 })).toMatchObject({
      adjustments: -200,
      total: 1800,
    });
    const plus = dailyBudget({ targetKcal: 2000, countExercise: false, manualAdjustmentKcal: 150 });
    expect(plus.total).toBe(2150);
    expect(plus.explanation).toContain("Ajustes: +150 kcal.");
    expect(dailyBudget({ targetKcal: 2000, countExercise: false, manualAdjustmentKcal: -200 }).explanation).toContain(
      "Ajustes: −200 kcal.",
    );
  });

  it("calcula lo que queda; pasarse es información, no castigo", () => {
    const b = dailyBudget({ targetKcal: 2000, countExercise: true, exerciseKcal: 200, consumedKcal: 1500 });
    expect(b.consumed).toBe(1500);
    expect(b.remaining).toBe(700);
    expect(dailyBudget({ targetKcal: 2000, countExercise: false, consumedKcal: 2300 }).remaining).toBe(-300);
    expect(dailyBudget({ targetKcal: 2000, countExercise: false, consumedKcal: null }).remaining).toBe(2000);
  });

  it("respeta un mínimo opcional", () => {
    const b = dailyBudget({ targetKcal: 1400, countExercise: false, manualAdjustmentKcal: -300, minimumKcal: 1200 });
    expect(b.total).toBe(1200);
    expect(b.minimumApplied).toBe(true);
    expect(b.explanation.at(-1)).toContain("1200 kcal");
    expect(dailyBudget({ targetKcal: 1400, countExercise: false, minimumKcal: 1200 }).minimumApplied).toBe(false);
  });

  it("valida las entradas", () => {
    expect(() => dailyBudget({ targetKcal: 0, countExercise: false })).toThrow("La meta de calorías debe ser mayor que 0.");
    expect(() => dailyBudget({ targetKcal: 2000, exerciseKcal: -1, countExercise: true })).toThrow(NutritionInputError);
    expect(() => dailyBudget({ targetKcal: 2000, countExercise: false, manualAdjustmentKcal: Number.NaN })).toThrow(
      NutritionInputError,
    );
    expect(() => dailyBudget({ targetKcal: 2000, countExercise: false, consumedKcal: -5 })).toThrow(NutritionInputError);
    expect(() => dailyBudget({ targetKcal: 2000, countExercise: false, minimumKcal: -5 })).toThrow(NutritionInputError);
  });
});
