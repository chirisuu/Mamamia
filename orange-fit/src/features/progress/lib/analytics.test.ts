import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { projectGoalDate, weightTrend, type WeightEntry } from "@/lib/nutrition";
import { adherenceDays, measurementSeries, periodWindows, seriesChange, weightChartPoints, weightDomain } from "./analytics";
import { sortTargets, targetForDate } from "./targets-by-date";

/** n pesajes diarios terminando en `end`, con un cambio lineal por día. */
function series(end: string, n: number, start: number, perDay: number): WeightEntry[] {
  return Array.from({ length: n }, (_, i) => ({ date: addDays(end, i - n + 1), weightKg: Math.round((start + perDay * i) * 100) / 100 }));
}

describe("proyección a la meta (weight-trend sobre datos de la pantalla)", () => {
  const today = "2026-10-13";

  it("con bajada sostenida estima una fecha futura (on_track)", () => {
    const entries = series(today, 28, 80, -0.07); // ≈ −0.49 kg/sem
    const trend = weightTrend(entries);
    expect(trend.confidence).toBe("ok");
    expect(trend.weeklyRateKg!).toBeLessThan(-0.4);
    const p = projectGoalDate(trend, 75);
    expect(p.reason).toBe("on_track");
    expect(p.date! > today).toBe(true);
  });

  it("si la tendencia se aleja de la meta no inventa fecha", () => {
    const trend = weightTrend(series(today, 21, 80, 0.05));
    const p = projectGoalDate(trend, 75);
    expect(p.reason).toBe("moving_away");
    expect(p.date).toBeNull();
  });

  it("con muy pocos pesajes dice que no hay tendencia", () => {
    const trend = weightTrend(series(today, 2, 80, -0.1));
    expect(trend.confidence).toBe("insufficient");
    const p = projectGoalDate(trend, 75);
    expect(p.reason).toBe("insufficient_data");
    expect(p.date).toBeNull();
  });
});

describe("weightChartPoints", () => {
  it("filtra por rango pero calcula el promedio con todo el historial", () => {
    const entries = series("2026-10-13", 10, 80, 0);
    const points = weightChartPoints(entries, "2026-10-12", "2026-10-13");
    expect(points).toHaveLength(2);
    expect(points[0]!.average).toBe(80);
  });
  it("sin pesajes devuelve []", () => {
    expect(weightChartPoints([], "2026-10-01", "2026-10-13")).toEqual([]);
  });
});

describe("periodWindows", () => {
  it("7 días: actual incluye hoy y el anterior son los 7 previos", () => {
    expect(periodWindows("2026-10-13", 7)).toEqual({
      current: { from: "2026-10-07", to: "2026-10-13" },
      previous: { from: "2026-09-30", to: "2026-10-06" },
    });
  });
});

describe("adherenceDays y meta por fecha", () => {
  const targets = [
    { effective_from: "2026-10-10", created_at: "2026-10-10T10:00:00Z", energy_kcal: 2000, protein_g: 120, water_ml: 2000 },
    { effective_from: "2026-10-01", created_at: "2026-10-01T10:00:00Z", energy_kcal: 1800, protein_g: 100, water_ml: 2000 },
    { effective_from: "2026-10-10", created_at: "2026-10-10T12:00:00Z", energy_kcal: 2100, protein_g: 125, water_ml: 2200 },
  ];

  it("usa la meta vigente de cada día (desempate por created_at)", () => {
    const sorted = sortTargets(targets);
    expect(targetForDate(sorted, "2026-09-30")).toBeNull();
    expect(targetForDate(sorted, "2026-10-05")?.energy_kcal).toBe(1800);
    expect(targetForDate(sorted, "2026-10-12")?.energy_kcal).toBe(2100);
  });

  it("omite días sin meta (no cuentan como fallidos)", () => {
    const days = adherenceDays(
      [
        { local_date: "2026-09-29", energy_kcal: 1500, protein_g: 80, items_count: 4 },
        { local_date: "2026-10-12", energy_kcal: 2050, protein_g: 120, items_count: 6 },
      ],
      targets,
    );
    expect(days).toEqual([{ date: "2026-10-12", logged: true, energyKcal: 2050, proteinG: 120, targetKcal: 2100, targetProteinG: 125 }]);
  });
});

describe("medidas", () => {
  const rows = [
    { local_date: "2026-10-01", waist_cm: 90, hip_cm: null, chest_cm: null, arm_cm: null, thigh_cm: null, calf_cm: null, neck_cm: null },
    { local_date: "2026-10-10", waist_cm: 88.5, hip_cm: 100, chest_cm: null, arm_cm: null, thigh_cm: null, calf_cm: null, neck_cm: null },
  ];
  it("serie por medida ignora vacíos y calcula el cambio", () => {
    const waist = measurementSeries(rows, "waist_cm", null);
    expect(waist).toEqual([
      { date: "2026-10-01", value: 90 },
      { date: "2026-10-10", value: 88.5 },
    ]);
    expect(seriesChange(waist)).toBe(-1.5);
    expect(seriesChange(measurementSeries(rows, "hip_cm", null))).toBeNull();
  });
});

describe("weightDomain", () => {
  it("incluye la meta en el eje", () => {
    const [min, max] = weightDomain([{ date: "2026-10-13", weightKg: 80, average: 80 }], 70)!;
    expect(min).toBeLessThanOrEqual(70);
    expect(max).toBeGreaterThanOrEqual(80);
  });
});
