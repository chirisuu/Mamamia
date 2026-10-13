import { describe, expect, it } from "vitest";
import { NutritionInputError } from "./errors";
import { sumWaterMl, WATER_PRESETS_ML, waterProgress, waterTarget } from "./water";

describe("waterTarget (EFSA 2010)", () => {
  it("2000 ml mujer y 2500 ml hombre", () => {
    expect(waterTarget({ sex: "female" }).waterMl).toBe(2000);
    expect(waterTarget({ sex: "male" }).waterMl).toBe(2500);
    expect(waterTarget({ sex: "male" }).formula).toBe("EFSA, hombre adulto: 2500 ml");
  });

  it("suma 300 ml en embarazo y 700 ml en lactancia (sin acumular)", () => {
    expect(waterTarget({ sex: "female", healthFlags: ["pregnant"] })).toMatchObject({
      waterMl: 2300,
      formula: "EFSA, mujer adulta: 2000 ml + 300 ml (embarazo)",
    });
    expect(waterTarget({ sex: "female", healthFlags: ["lactating"] }).waterMl).toBe(2700);
    expect(waterTarget({ sex: "female", healthFlags: ["pregnant", "lactating"] }).waterMl).toBe(2700);
  });

  it("explica que es agua total y avisa con enfermedad renal", () => {
    expect(waterTarget({ sex: "female" }).notes[0]).toContain("agua total");
    expect(waterTarget({ sex: "female" }).notes).toHaveLength(2);
    expect(waterTarget({ sex: "male", healthFlags: ["kidney_disease"] }).notes[2]).toContain("enfermedad renal");
  });
});

describe("waterProgress", () => {
  it("calcula lo que falta y el avance", () => {
    expect(waterProgress(500, 2000)).toEqual({ consumedMl: 500, targetMl: 2000, remainingMl: 1500, progress: 0.25, reached: false });
  });

  it("tope en 100 % al superar la meta", () => {
    expect(waterProgress(2500, 2000)).toMatchObject({ remainingMl: 0, progress: 1, reached: true });
    expect(waterProgress(2000, 2000).reached).toBe(true);
  });

  it("valida los datos", () => {
    expect(() => waterProgress(-1, 2000)).toThrow(NutritionInputError);
    expect(() => waterProgress(100, 0)).toThrow("La meta de agua debe ser mayor que 0.");
  });
});

describe("sumWaterMl", () => {
  it("suma registros y rechaza negativos", () => {
    expect(sumWaterMl([{ amountMl: 250 }, { amountMl: 500 }])).toBe(750);
    expect(sumWaterMl([])).toBe(0);
    expect(() => sumWaterMl([{ amountMl: -10 }])).toThrow(NutritionInputError);
  });

  it("ofrece atajos de registro", () => {
    expect(WATER_PRESETS_ML.map((p) => p.ml)).toEqual([250, 500, 750, 1000]);
  });
});
