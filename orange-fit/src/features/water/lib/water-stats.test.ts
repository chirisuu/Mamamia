import { describe, expect, it } from "vitest";
import { sumWaterMl, waterProgress, WATER_PRESETS_ML } from "@/lib/nutrition";
import { sumByDate, summarizeWater, waterSeries } from "./water-stats";

const targets = [
  { effective_from: "2026-10-01", created_at: "2026-10-01T00:00:00Z", energy_kcal: 2000, protein_g: 100, water_ml: 2000 },
  { effective_from: "2026-10-12", created_at: "2026-10-12T00:00:00Z", energy_kcal: 2000, protein_g: 100, water_ml: 2500 },
];

describe("agua: cálculos del día e historial", () => {
  it("accesos rápidos del motor: vaso 250, botellas 500 y 750", () => {
    expect(WATER_PRESETS_ML.slice(0, 3).map((p) => p.ml)).toEqual([250, 500, 750]);
  });

  it("progreso del día con tope y lo que falta", () => {
    const total = sumWaterMl([{ amountMl: 250 }, { amountMl: 500 }, { amountMl: 750 }]);
    expect(total).toBe(1500);
    const p = waterProgress(total, 2000);
    expect(p.remainingMl).toBe(500);
    expect(p.reached).toBe(false);
    expect(waterProgress(2600, 2500).progress).toBe(1);
  });

  it("suma por fecha", () => {
    const m = sumByDate([
      { local_date: "2026-10-12", amount_ml: 250 },
      { local_date: "2026-10-12", amount_ml: 500 },
      { local_date: "2026-10-13", amount_ml: 300 },
    ]);
    expect(m.get("2026-10-12")).toBe(750);
    expect(m.get("2026-10-13")).toBe(300);
  });

  it("serie de 7 días: días sin registro quedan null (no 0) y la meta cambia por fecha", () => {
    const s = waterSeries(
      [
        { local_date: "2026-10-11", amount_ml: 2000 },
        { local_date: "2026-10-12", amount_ml: 2000 },
        { local_date: "2026-10-13", amount_ml: 2600 },
      ],
      targets,
      "2026-10-13",
      7,
    );
    expect(s).toHaveLength(7);
    expect(s[0]).toEqual({ date: "2026-10-07", ml: null, targetMl: 2000, reached: false });
    expect(s.find((d) => d.date === "2026-10-11")?.reached).toBe(true);
    expect(s.find((d) => d.date === "2026-10-12")).toMatchObject({ ml: 2000, targetMl: 2500, reached: false });
    expect(s.at(-1)).toMatchObject({ ml: 2600, reached: true });

    const summary = summarizeWater(s);
    expect(summary).toEqual({ days: 7, daysLogged: 3, averageMl: 2200, daysReached: 2, totalMl: 6600 });
  });

  it("sin meta vigente no marca días logrados", () => {
    const s = waterSeries([{ local_date: "2026-09-20", amount_ml: 3000 }], targets, "2026-09-20", 1);
    expect(s[0]).toEqual({ date: "2026-09-20", ml: 3000, targetMl: null, reached: false });
  });
});
