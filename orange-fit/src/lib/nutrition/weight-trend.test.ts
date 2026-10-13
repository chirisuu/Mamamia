import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import { NutritionInputError } from "./errors";
import type { WeightEntry } from "./weight-trend";
import {
  comparePeriods,
  linearRegression,
  movingAverage,
  normalizeWeights,
  projectGoalDate,
  summarizePeriod,
  weightTrend,
} from "./weight-trend";

const START = "2026-09-01";
/** Un pesaje diario durante n días con una función del índice. */
const series = (n: number, f: (i: number) => number, start = START): WeightEntry[] =>
  Array.from({ length: n }, (_, i) => ({ date: addDays(start, i), weightKg: Number(f(i).toFixed(3)) }));

describe("normalizeWeights", () => {
  it("ordena por fecha y deja el último pesaje de cada día", () => {
    expect(
      normalizeWeights([
        { date: "2026-09-03", weightKg: 80 },
        { date: "2026-09-01", weightKg: 81 },
        { date: "2026-09-03", weightKg: 79.5 },
      ]),
    ).toEqual([
      { date: "2026-09-01", weightKg: 81 },
      { date: "2026-09-03", weightKg: 79.5 },
    ]);
  });

  it("valida fecha y peso", () => {
    expect(() => normalizeWeights([{ date: "2026-13-01", weightKg: 80 }])).toThrow("AAAA-MM-DD");
    expect(() => normalizeWeights([{ date: "2026-09-01", weightKg: 10 }])).toThrow(NutritionInputError);
  });
});

describe("movingAverage (7 días, mínimo 3 pesajes)", () => {
  it("no promedia hasta tener 3 pesajes en la ventana", () => {
    const points = movingAverage(series(4, (i) => 80 - i));
    expect(points.map((p) => p.average)).toEqual([null, null, 79, 78.5]);
    expect(points.map((p) => p.count)).toEqual([1, 2, 3, 4]);
  });

  it("la ventana solo mira los últimos 7 días", () => {
    const points = movingAverage([
      { date: "2026-09-01", weightKg: 80 },
      { date: "2026-09-02", weightKg: 80 },
      { date: "2026-09-03", weightKg: 80 },
      { date: "2026-09-10", weightKg: 78 },
    ]);
    expect(points.at(-1)).toEqual({ date: "2026-09-10", weightKg: 78, average: null, count: 1 });
  });

  it("acepta ventana y mínimo configurables", () => {
    expect(movingAverage(series(2, () => 70), { windowDays: 3, minEntries: 1 }).map((p) => p.average)).toEqual([70, 70]);
  });
});

describe("linearRegression", () => {
  it("ajusta una recta exacta", () => {
    expect(
      linearRegression([
        { x: 0, y: 1 },
        { x: 1, y: 3 },
        { x: 2, y: 5 },
      ]),
    ).toEqual({ slope: 2, intercept: 1, r2: 1, n: 3 });
  });

  it("null con menos de 2 puntos o sin variación en x", () => {
    expect(linearRegression([{ x: 0, y: 1 }])).toBeNull();
    expect(
      linearRegression([
        { x: 1, y: 1 },
        { x: 1, y: 2 },
      ]),
    ).toBeNull();
  });

  it("y constante → pendiente 0 y r2 1", () => {
    expect(
      linearRegression([
        { x: 0, y: 5 },
        { x: 3, y: 5 },
      ]),
    ).toMatchObject({ slope: 0, r2: 1 });
  });

  it("r2 < 1 con ruido", () => {
    const fit = linearRegression([
      { x: 0, y: 0 },
      { x: 1, y: 2 },
      { x: 2, y: 1 },
    ])!;
    expect(fit.r2).toBeGreaterThan(0);
    expect(fit.r2).toBeLessThan(1);
  });
});

describe("weightTrend", () => {
  it("bajando 0.1 kg/día → ritmo semanal negativo y confianza ok", () => {
    const t = weightTrend(series(21, (i) => 80 - 0.1 * i));
    expect(t.confidence).toBe("ok");
    expect(t.weeklyRateKg!).toBeLessThan(-0.55);
    expect(t.weeklyRateKg!).toBeGreaterThan(-0.75);
    expect(t.startDate).toBe("2026-09-03");
    expect(t.endDate).toBe("2026-09-21");
    expect(t.spanDays).toBe(18);
    expect(t.latestAverageKg).toBeCloseTo(78.3, 5);
    expect(t.trendWeightKg!).toBeLessThan(79);
  });

  it("datos insuficientes", () => {
    const t = weightTrend(series(2, () => 80));
    expect(t).toMatchObject({ confidence: "insufficient", fit: null, weeklyRateKg: null, trendWeightKg: null, latestAverageKg: null });
    expect(weightTrend([]).startDate).toBeNull();
  });

  it("pocos puntos o poco tiempo → confianza baja", () => {
    expect(weightTrend(series(4, (i) => 80 - i * 0.1)).confidence).toBe("low");
  });
});

describe("projectGoalDate", () => {
  const down = weightTrend(series(21, (i) => 80 - 0.1 * i));

  it("estima la fecha si la tendencia va hacia la meta", () => {
    const p = projectGoalDate(down, 75);
    expect(p.reason).toBe("on_track");
    expect(p.days!).toBeGreaterThan(0);
    expect(p.date! > down.endDate!).toBe(true);
    expect(p.date).toBe(addDays(down.endDate!, p.days!));
    expect(p.message).toContain("aproximación");
  });

  it("null si la tendencia se aleja de la meta", () => {
    expect(projectGoalDate(down, 85)).toMatchObject({ date: null, reason: "moving_away" });
  });

  it("null si el peso está estable", () => {
    const flat = weightTrend(series(14, () => 70));
    expect(projectGoalDate(flat, 65)).toMatchObject({ date: null, reason: "flat" });
  });

  it("ya en la meta", () => {
    const flat = weightTrend(series(14, () => 70));
    expect(projectGoalDate(flat, 70)).toMatchObject({ date: flat.endDate, days: 0, reason: "reached" });
  });

  it("proyecciones de más de 2 años no se dan como fecha", () => {
    const slow = weightTrend(series(21, (i) => 80 - 0.01 * i));
    expect(projectGoalDate(slow, 60)).toMatchObject({ date: null, reason: "too_far" });
  });

  it("sin datos suficientes", () => {
    expect(projectGoalDate(weightTrend([]), 70)).toMatchObject({ date: null, reason: "insufficient_data" });
  });

  it("valida la meta", () => {
    expect(() => projectGoalDate(down, 10)).toThrow(NutritionInputError);
  });
});

describe("comparePeriods", () => {
  const entries = [
    ...series(7, () => 80, "2026-09-01"),
    ...series(7, () => 79, "2026-09-08"),
  ];

  it("compara promedios entre semanas", () => {
    const c = comparePeriods(entries, { from: "2026-09-01", to: "2026-09-07" }, { from: "2026-09-08", to: "2026-09-14" });
    expect(c.a).toEqual({ from: "2026-09-01", to: "2026-09-07", count: 7, averageKg: 80, minKg: 80, maxKg: 80 });
    expect(c.deltaKg).toBe(-1);
    expect(c.deltaPct).toBe(-1.25);
  });

  it("null si un periodo no tiene pesajes", () => {
    const c = comparePeriods(entries, { from: "2026-08-01", to: "2026-08-07" }, { from: "2026-09-08", to: "2026-09-14" });
    expect(c.a).toBeNull();
    expect(c.deltaKg).toBeNull();
    expect(c.deltaPct).toBeNull();
  });

  it("summarizePeriod valida fechas", () => {
    expect(() => summarizePeriod(entries, "2026-09-08", "2026-09-01")).toThrow("La fecha inicial debe ser anterior a la final.");
    expect(() => summarizePeriod(entries, "x", "2026-09-01")).toThrow(NutritionInputError);
    expect(summarizePeriod(entries, "2026-09-06", "2026-09-09")).toMatchObject({ count: 4, minKg: 79, maxKg: 80, averageKg: 79.5 });
  });
});
