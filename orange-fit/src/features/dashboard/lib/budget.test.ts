import { describe, expect, it } from "vitest";
import { buildBudgetBreakdown } from "./budget";

describe("buildBudgetBreakdown", () => {
  it("sin contar ejercicio: base − consumido (el ejercicio no se suma dos veces)", () => {
    const b = buildBudgetBreakdown({ targetKcal: 2000, exerciseKcal: 300, countExercise: false, consumedKcal: 1200 });
    expect(b.budget.total).toBe(2000);
    expect(b.budget.exercise).toBe(0);
    expect(b.budget.exerciseLogged).toBe(300);
    expect(b.budget.remaining).toBe(800);
    expect(b.rows.map((r) => r.key)).toEqual(["base", "adjustments", "consumed", "remaining"]);
    expect(b.budget.explanation.join(" ")).toContain("no se suman");
  });

  it("contando ejercicio: base + ejercicio neto − consumido", () => {
    const b = buildBudgetBreakdown({ targetKcal: 2000, exerciseKcal: 250.4, countExercise: true, consumedKcal: 1500 });
    expect(b.budget.total).toBe(2250);
    expect(b.budget.remaining).toBe(750);
    const exercise = b.rows.find((r) => r.key === "exercise");
    expect(exercise).toMatchObject({ value: 250, sign: "+", note: "kcal netas registradas hoy" });
  });

  it("muestra la fila de ejercicio aunque hoy no haya, si está activado", () => {
    const b = buildBudgetBreakdown({ targetKcal: 1800, exerciseKcal: 0, countExercise: true, consumedKcal: 0 });
    expect(b.rows.find((r) => r.key === "exercise")?.note).toBe("Aún no registras ejercicio hoy");
    expect(b.rows.find((r) => r.key === "adjustments")?.note).toBe("Sin ajustes para hoy");
  });

  it("pasarse se informa sin signo negativo ni castigo", () => {
    const b = buildBudgetBreakdown({ targetKcal: 1800, exerciseKcal: 0, countExercise: false, consumedKcal: 2000 });
    expect(b.budget.remaining).toBe(-200);
    expect(b.rows.at(-1)).toEqual({ key: "remaining", label: "Sobre tu presupuesto", value: 200, sign: "=" });
  });

  it("aplica ajustes", () => {
    const b = buildBudgetBreakdown({ targetKcal: 2000, exerciseKcal: 0, countExercise: false, adjustmentsKcal: -100, consumedKcal: 0 });
    expect(b.budget.total).toBe(1900);
    expect(b.rows.find((r) => r.key === "adjustments")).toMatchObject({ value: -100, sign: "−" });
  });
});
