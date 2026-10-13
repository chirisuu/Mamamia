import { describe, expect, it } from "vitest";
import { NutritionInputError } from "./errors";
import {
  estimateExercise,
  EXERCISE_CATALOG,
  EXERCISE_CATALOG_SOURCE,
  EXERCISE_CATEGORY_LABELS,
  EXERCISE_INTENSITY_LABELS,
  findActivity,
  grossExerciseKcal,
  intensityFromMet,
  netExerciseKcal,
  searchActivities,
} from "./exercise";

describe("EXERCISE_CATALOG", () => {
  it("tiene unas 40–50 actividades con códigos únicos de 5 dígitos", () => {
    expect(EXERCISE_CATALOG.length).toBeGreaterThanOrEqual(40);
    expect(EXERCISE_CATALOG.length).toBeLessThanOrEqual(50);
    const codes = EXERCISE_CATALOG.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const a of EXERCISE_CATALOG) {
      expect(a.code).toMatch(/^\d{5}$/);
      expect(a.met).toBeGreaterThanOrEqual(1);
      expect(a.met).toBeLessThanOrEqual(25);
      expect(a.nameEs.length).toBeGreaterThan(3);
      expect(a.compendiumDescription.length).toBeGreaterThan(3);
      expect(EXERCISE_CATEGORY_LABELS[a.category]).toBeTruthy();
    }
  });

  it("no presenta valores como verificados mientras no se cotejen", () => {
    expect(EXERCISE_CATALOG.every((a) => a.verified === false)).toBe(true);
    expect(EXERCISE_CATALOG_SOURCE.verified).toBe(false);
    expect(EXERCISE_CATALOG_SOURCE.name).toContain("2024");
  });

  it("cubre caminar (varios ritmos), correr, ciclismo, natación, fuerza, HIIT, fútbol, vóley, baile, yoga, escaleras y casa", () => {
    const has = (re: RegExp) => EXERCISE_CATALOG.some((a) => re.test(a.nameEs));
    expect(EXERCISE_CATALOG.filter((a) => a.category === "walking" && a.nameEs.startsWith("Caminar")).length).toBeGreaterThanOrEqual(4);
    for (const re of [/Correr/, /Bicicleta/, /Natación/, /Pesas/, /HIIT/, /Fútbol/, /Vóley/, /Baile/, /Yoga/, /escaleras/, /Barrer|Trapear/]) {
      expect(has(re)).toBe(true);
    }
    for (const category of Object.keys(EXERCISE_CATEGORY_LABELS)) {
      expect(EXERCISE_CATALOG.some((a) => a.category === category)).toBe(true);
    }
  });
});

describe("kcal por MET", () => {
  it("brutas = MET × kg × h; netas = (MET − 1) × kg × h", () => {
    expect(grossExerciseKcal(4, 70, 30)).toBe(140);
    expect(netExerciseKcal(4, 70, 30)).toBe(105);
    expect(netExerciseKcal(1, 70, 60)).toBe(0);
  });

  it("valida MET, peso y duración", () => {
    expect(() => grossExerciseKcal(0.5, 70, 30)).toThrow("El MET debe estar entre 1 y 25.");
    expect(() => grossExerciseKcal(4, 10, 30)).toThrow(NutritionInputError);
    expect(() => netExerciseKcal(4, 70, 0)).toThrow("La duración debe estar entre 1 y 600 min.");
    expect(() => netExerciseKcal(4, 70, 601)).toThrow(NutritionInputError);
  });
});

describe("intensityFromMet", () => {
  it.each([
    [1.8, "light"],
    [2.9, "light"],
    [3, "moderate"],
    [5.9, "moderate"],
    [6, "vigorous"],
    [11.8, "vigorous"],
  ] as const)("%s MET → %s", (met, intensity) => {
    expect(intensityFromMet(met)).toBe(intensity);
    expect(EXERCISE_INTENSITY_LABELS[intensity]).toBeTruthy();
  });
});

describe("estimateExercise", () => {
  it("con una actividad del catálogo usa su MET y explica que se usan las netas", () => {
    const e = estimateExercise({ code: "17200", weightKg: 70, durationMin: 45 });
    expect(e.met).toBe(4.8);
    expect(e.grossKcal).toBe(252);
    expect(e.netKcal).toBe(199.5);
    expect(e.intensity).toBe("moderate");
    expect(e.grossFormula).toBe("4.8 MET × 70 kg × 45 min ÷ 60");
    expect(e.netFormula).toBe("(4.8 − 1) MET × 70 kg × 45 min ÷ 60");
    expect(e.explanation).toContain("netas");
    expect(e.verified).toBe(false);
  });

  it("acepta una actividad propia con su MET", () => {
    const e = estimateExercise({ met: 8, weightKg: 60, durationMin: 60, nameEs: " Escalada " });
    expect(e).toMatchObject({ code: "custom", nameEs: "Escalada", grossKcal: 480, netKcal: 420, intensity: "vigorous" });
    expect(estimateExercise({ met: 3, weightKg: 60, durationMin: 10 }).nameEs).toBe("Actividad personalizada");
  });

  it("redondea a 1 decimal", () => {
    expect(estimateExercise({ code: "02150", weightKg: 63.3, durationMin: 37 }).netKcal).toBe(50.7);
  });

  it("errores claros", () => {
    expect(() => estimateExercise({ code: "99999", weightKg: 70, durationMin: 30 })).toThrow("No encontramos esa actividad");
    expect(() => estimateExercise({ weightKg: 70, durationMin: 30 })).toThrow("Elige una actividad o indica su MET.");
  });
});

describe("búsqueda", () => {
  it("findActivity por código", () => {
    expect(findActivity(" 02050 ")?.nameEs).toContain("Pesas");
    expect(findActivity("99999")).toBeNull();
  });

  it("searchActivities sin tildes, por código y por categoría", () => {
    expect(searchActivities("voley").length).toBeGreaterThanOrEqual(2);
    expect(searchActivities("VÓLEY").length).toBe(searchActivities("voley").length);
    expect(searchActivities("1713").map((a) => a.code)).toEqual(["17133", "17134"]);
    expect(searchActivities("", { category: "water" })).toHaveLength(4);
    expect(searchActivities("natación", { category: "gym" })).toHaveLength(0);
    expect(searchActivities("")).toHaveLength(EXERCISE_CATALOG.length);
  });
});
