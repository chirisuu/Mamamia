import { describe, expect, it } from "vitest";
import { NutritionInputError } from "./errors";
import {
  convertMass,
  convertVolume,
  formatQuantity,
  fromGrams,
  gramsPerPortionUnit,
  isMassUnit,
  isVolumeUnit,
  normalizeUnit,
  toGrams,
  tryToGrams,
  UnitConversionError,
  VOLUME_UNITS,
} from "./units";

describe("normalizeUnit", () => {
  it("reconoce alias en español e inglés, sin tildes ni mayúsculas", () => {
    expect(normalizeUnit("Gramos")).toBe("g");
    expect(normalizeUnit(" KILOS ")).toBe("kg");
    expect(normalizeUnit("onzas")).toBe("oz");
    expect(normalizeUnit("Libras")).toBe("lb");
    expect(normalizeUnit("litros")).toBe("l");
    expect(normalizeUnit("Taza")).toBe("cup");
    expect(normalizeUnit("Cucharadas")).toBe("tbsp");
    expect(normalizeUnit("CDTA.")).toBe("tsp");
    expect(normalizeUnit("Rebanada")).toBe("rebanada");
  });

  it("isMassUnit / isVolumeUnit no se confunden con propiedades heredadas", () => {
    expect(isMassUnit("g")).toBe(true);
    expect(isMassUnit("cup")).toBe(false);
    expect(isVolumeUnit("cup")).toBe(true);
    expect(isMassUnit("toString")).toBe(false);
  });
});

describe("toGrams — masa", () => {
  it("convierte g, kg, oz y lb", () => {
    expect(toGrams(150, "g")).toBe(150);
    expect(toGrams(1.5, "kg")).toBe(1500);
    expect(toGrams(2, "oz")).toBeCloseTo(56.69904625, 8);
    expect(toGrams(1, "lb")).toBeCloseTo(453.59237, 8);
    expect(toGrams(0, "g")).toBe(0);
  });
});

describe("toGrams — volumen", () => {
  it("usa la densidad del alimento (taza 240 ml, cda 15 ml, cdta 5 ml)", () => {
    expect(VOLUME_UNITS.cup.ml).toBe(240);
    expect(toGrams(1, "taza", { densityGPerMl: 1.03 })).toBeCloseTo(247.2, 8);
    expect(toGrams(1, "cda", { densityGPerMl: 0.92 })).toBeCloseTo(13.8, 8);
    expect(toGrams(2, "tsp", { densityGPerMl: 1 })).toBe(10);
    expect(toGrams(0.5, "litros", { densityGPerMl: 1 })).toBe(500);
    expect(toGrams(200, "ml", { densityGPerMl: 1.03 })).toBeCloseTo(206, 8);
  });

  it("sin densidad lanza un error explícito", () => {
    try {
      toGrams(1, "taza");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(UnitConversionError);
      expect(e).toBeInstanceOf(NutritionInputError);
      const err = e as UnitConversionError;
      expect(err.code).toBe("missing_density");
      expect(err.name).toBe("UnitConversionError");
      expect(err.message).toContain("no tiene densidad registrada");
    }
    expect(() => toGrams(1, "ml", { densityGPerMl: null })).toThrow(UnitConversionError);
  });

  it("rechaza densidades inválidas", () => {
    expect(() => toGrams(1, "ml", { densityGPerMl: 0 })).toThrow("La densidad del alimento no es válida.");
    expect(() => toGrams(1, "ml", { densityGPerMl: Number.POSITIVE_INFINITY })).toThrow(UnitConversionError);
  });
});

describe("toGrams — porciones del alimento", () => {
  const egg = [{ unit: "unidad", gramWeight: 50 }];

  it("usa el peso de la porción definida", () => {
    expect(toGrams(2, "unidad", { portions: egg })).toBe(100);
    expect(toGrams(3, "slice", { portions: [{ unit: "slice", quantity: 2, gramWeight: 60 }] })).toBe(90);
  });

  it("la porción del alimento tiene prioridad sobre la densidad", () => {
    expect(toGrams(1, "taza", { densityGPerMl: 1, portions: [{ unit: "cup", gramWeight: 158 }] })).toBe(158);
  });

  it("también encuentra la porción por su etiqueta", () => {
    expect(toGrams(2, "Rebanada", { portions: [{ unit: "slice", label: "rebanada", gramWeight: 30 }] })).toBe(60);
  });

  it("medida casera sin porción definida → error explícito", () => {
    const r = tryToGrams(1, "puñado");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe("missing_portion");
      expect(r.error.message).toContain("«puñado» no tiene un peso definido");
    }
  });

  it("porción inválida", () => {
    expect(() => toGrams(1, "unidad", { portions: [{ unit: "unidad", gramWeight: 0 }] })).toThrow(
      "La porción definida para este alimento no es válida.",
    );
    expect(() => toGrams(1, "unidad", { portions: [{ unit: "unidad", gramWeight: 10, quantity: 0 }] })).toThrow(UnitConversionError);
  });

  it("gramsPerPortionUnit devuelve null si no hay coincidencia", () => {
    expect(gramsPerPortionUnit("taza", egg)).toBeNull();
    expect(gramsPerPortionUnit("taza")).toBeNull();
  });
});

describe("toGrams — validación", () => {
  it("rechaza cantidades negativas, no numéricas y unidades vacías", () => {
    expect(() => toGrams(-1, "g")).toThrow("La cantidad no puede ser negativa.");
    expect(() => toGrams(Number.NaN, "g")).toThrow("La cantidad debe ser un número válido.");
    expect(() => toGrams(1, "  ")).toThrow("Indica una unidad.");
  });
});

describe("tryToGrams", () => {
  it("devuelve el resultado sin lanzar", () => {
    expect(tryToGrams(2, "kg")).toEqual({ ok: true, grams: 2000 });
    expect(tryToGrams(1, "ml")).toMatchObject({ ok: false, error: { code: "missing_density" } });
  });

  it("vuelve a lanzar errores que no son de entrada", () => {
    const portions = [
      {
        get unit(): string {
          throw new TypeError("boom");
        },
        gramWeight: 1,
      },
    ];
    expect(() => tryToGrams(1, "unidad", { portions })).toThrow(TypeError);
  });
});

describe("conversiones y formato", () => {
  it("convertMass y convertVolume", () => {
    expect(convertMass(1, "lb", "kg")).toBeCloseTo(0.45359237, 8);
    expect(convertMass(1000, "g", "kg")).toBe(1);
    expect(convertVolume(1, "cup", "tbsp")).toBe(16);
    expect(convertVolume(1, "l", "ml")).toBe(1000);
    expect(() => convertMass(Number.NaN, "g", "kg")).toThrow(NutritionInputError);
    expect(() => convertVolume(Number.NaN, "ml", "l")).toThrow(NutritionInputError);
  });

  it("fromGrams es la inversa de toGrams", () => {
    expect(fromGrams(500, "kg")).toBe(0.5);
    expect(fromGrams(240, "taza", { densityGPerMl: 1 })).toBe(1);
    expect(fromGrams(150, "unidad", { portions: [{ unit: "unidad", gramWeight: 50 }] })).toBe(3);
    expect(() => fromGrams(Number.NaN, "g")).toThrow(NutritionInputError);
  });

  it("formatQuantity usa etiquetas legibles", () => {
    expect(formatQuantity(1.5, "taza")).toBe("1.5 taza");
    expect(formatQuantity(200, "gramos")).toBe("200 g");
    expect(formatQuantity(0.5, "litro")).toBe("0.5 L");
    expect(formatQuantity(2, " rebanada ")).toBe("2 rebanada");
    expect(formatQuantity(-1, "g")).toBe("-1 g");
  });
});
