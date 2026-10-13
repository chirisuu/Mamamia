import { describe, expect, it } from "vitest";
import { dailyBudget } from "@/lib/nutrition";
import { activityOverview, catalogExerciseRow, manualExerciseRow, resolveExerciseWeight, summarize } from "./activity-calc";

describe("actividad: peso, kcal netas y resúmenes", () => {
  it("usa el último pesaje; si no hay, el del objetivo; si nada, null", () => {
    expect(resolveExerciseWeight(70, 80)).toEqual({ weightKg: 70, source: "log" });
    expect(resolveExerciseWeight(null, 80)).toEqual({ weightKg: 80, source: "goal" });
    expect(resolveExerciseWeight(null, null)).toBeNull();
    expect(resolveExerciseWeight(5, null)).toBeNull();
  });

  it("catálogo: guarda kcal NETAS = (MET − 1) × kg × h", () => {
    // 17200 Caminar rápido, 4.8 MET; 70 kg, 30 min → (3.8 × 70 × 0.5) = 133.0 netas; 168.0 brutas
    const { row, estimate } = catalogExerciseRow("17200", 30, 70);
    expect(estimate.grossKcal).toBe(168);
    expect(row).toEqual({
      activity_code: "17200",
      activity_name: estimate.nameEs,
      met: 4.8,
      duration_min: 30,
      intensity: "moderate",
      energy_kcal: 133,
      energy_source: "met_estimate",
    });
  });

  it("catálogo: código desconocido o duración fuera de rango lanza error", () => {
    expect(() => catalogExerciseRow("99999", 30, 70)).toThrow();
    expect(() => catalogExerciseRow("17200", 0, 70)).toThrow();
    expect(() => catalogExerciseRow("17200", 601, 70)).toThrow();
  });

  it("intensidad vigorosa para MET ≥ 6", () => {
    expect(catalogExerciseRow("12050", 20, 60).row.intensity).toBe("vigorous");
    expect(catalogExerciseRow("02150", 60, 60).row.intensity).toBe("light");
  });

  it("manual: guarda lo que dice el reloj, marcado como manual y sin MET", () => {
    expect(manualExerciseRow({ name: "  Spinning ", durationMin: 45, intensity: "vigorous", energyKcal: 412.34 })).toEqual({
      activity_code: "manual",
      activity_name: "Spinning",
      met: null,
      duration_min: 45,
      intensity: "vigorous",
      energy_kcal: 412.3,
      energy_source: "manual",
    });
  });

  it("resúmenes de hoy, semana (desde el lunes) y 30 días", () => {
    const logs = [
      { local_date: "2026-10-13", duration_min: 30, energy_kcal: 133 },
      { local_date: "2026-10-12", duration_min: 60, energy_kcal: 300.4 },
      { local_date: "2026-10-11", duration_min: 20, energy_kcal: 80 },
    ];
    // 2026-10-13 es martes: la semana empieza el lunes 12.
    const o = activityOverview(logs, "2026-10-13");
    expect(o.today).toEqual({ sessions: 1, minutes: 30, kcal: 133 });
    expect(o.week).toEqual({ sessions: 2, minutes: 90, kcal: 433 });
    expect(o.last30.sessions).toBe(3);
    expect(summarize(logs, "2026-10-01", "2026-10-10").sessions).toBe(0);
  });

  it("el presupuesto solo suma el ejercicio si la persona lo activa (sin doble conteo)", () => {
    const off = dailyBudget({ targetKcal: 2000, exerciseKcal: 133, countExercise: false });
    const on = dailyBudget({ targetKcal: 2000, exerciseKcal: 133, countExercise: true });
    expect(off.total).toBe(2000);
    expect(on.total).toBe(2133);
    expect(off.explanation.join(" ")).toMatch(/dos veces/);
  });
});
