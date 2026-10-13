import { describe, expect, it } from "vitest";
import { isNutritionInputError, NutritionInputError } from "./errors";
import {
  assertFiniteNumber,
  assertInRange,
  assertInteger,
  assertNonNegative,
  assertPositive,
  ceilTo,
  clamp,
  fmt,
  fmtPct,
  normalizeKey,
  roundDecimals,
  roundGrams,
  roundKcal,
  roundTo,
} from "./math";

describe("roundTo", () => {
  it("redondea al múltiplo más cercano", () => {
    expect(roundTo(1234, 10)).toBe(1230);
    expect(roundTo(1235, 10)).toBe(1240);
    expect(roundTo(2.37, 0.25)).toBe(2.25);
    expect(roundTo(2.38, 0.25)).toBe(2.5);
    expect(roundTo(0.1 + 0.2, 0.1)).toBe(0.3);
    expect(roundTo(0.12345678, 1e-7)).toBe(0.1234568);
    expect(roundTo(0.12345678, 2.5e-7)).toBe(0.12345675);
  });

  it("es simétrico respecto de cero y no devuelve -0", () => {
    expect(roundTo(-555, 10)).toBe(-560);
    expect(roundTo(-5, 10)).toBe(-10);
    expect(Object.is(roundTo(-0.4, 1), 0)).toBe(true);
  });

  it("usa paso 1 por defecto y rechaza pasos no positivos", () => {
    expect(roundTo(2.5)).toBe(3);
    expect(() => roundTo(1, 0)).toThrow(RangeError);
    expect(() => roundTo(1, -1)).toThrow(RangeError);
  });
});

describe("ceilTo", () => {
  it("redondea hacia arriba sin ruido de coma flotante", () => {
    expect(ceilTo(1250, 10)).toBe(1250);
    expect(ceilTo(1251, 10)).toBe(1260);
    expect(ceilTo(1.21, 0.1)).toBe(1.3);
    expect(ceilTo(0.3, 0.1)).toBe(0.3);
    expect(ceilTo(7)).toBe(7);
    expect(Object.is(ceilTo(-0.01, 1), 0)).toBe(true);
  });

  it("rechaza pasos no positivos", () => {
    expect(() => ceilTo(1, 0)).toThrow(RangeError);
  });
});

describe("redondeos con nombre", () => {
  it("roundDecimals, roundKcal y roundGrams", () => {
    expect(roundDecimals(2.345, 1)).toBe(2.3);
    expect(roundDecimals(1.005, 2)).toBe(1.01);
    expect(roundDecimals(0.12345678, 7)).toBe(0.1234568);
    expect(roundKcal(2554.4)).toBe(2550);
    expect(roundKcal(-347.5)).toBe(-350);
    expect(roundGrams(55.5)).toBe(56);
  });
});

describe("clamp", () => {
  it("limita al rango", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
});

describe("fmt y fmtPct", () => {
  it("formatea con punto decimal, sin ceros sobrantes y con signo menos tipográfico", () => {
    expect(fmt(2)).toBe("2");
    expect(fmt(2.5)).toBe("2.5");
    expect(fmt(1.239)).toBe("1.24");
    expect(fmt(1.239, 1)).toBe("1.2");
    expect(fmt(-3)).toBe("−3");
    expect(fmt(-0.0001)).toBe("0");
  });

  it("fmtPct convierte fracciones", () => {
    expect(fmtPct(0.25)).toBe("25 %");
    expect(fmtPct(0.075)).toBe("7.5 %");
  });
});

describe("aserciones", () => {
  it("assertFiniteNumber rechaza NaN, infinitos y no números", () => {
    expect(() => assertFiniteNumber(Number.NaN, "x", "El valor")).toThrow("El valor debe ser un número válido.");
    expect(() => assertFiniteNumber(Number.POSITIVE_INFINITY, "x", "El valor")).toThrow(NutritionInputError);
    expect(() => assertFiniteNumber("3", "x", "El valor")).toThrow(NutritionInputError);
    expect(() => assertFiniteNumber(3, "x", "El valor")).not.toThrow();
  });

  it("assertInRange da un mensaje en español con unidad y el campo", () => {
    try {
      assertInRange(19, 20, 400, "weightKg", "El peso", "kg");
      expect.unreachable();
    } catch (e) {
      expect(isNutritionInputError(e)).toBe(true);
      const err = e as NutritionInputError;
      expect(err.code).toBe("out_of_range");
      expect(err.field).toBe("weightKg");
      expect(err.name).toBe("NutritionInputError");
      expect(err.message).toBe("El peso debe estar entre 20 y 400 kg.");
    }
    expect(() => assertInRange(401, 20, 400, "w", "El peso")).toThrow("El peso debe estar entre 20 y 400.");
    expect(assertInRange(20, 20, 400, "w", "El peso")).toBe(20);
  });

  it("assertNonNegative, assertPositive y assertInteger", () => {
    expect(assertNonNegative(0, "x", "X")).toBe(0);
    expect(() => assertNonNegative(-1, "x", "X")).toThrow("X no puede ser negativo.");
    expect(assertPositive(1, "x", "X")).toBe(1);
    expect(() => assertPositive(0, "x", "X")).toThrow("X debe ser mayor que 0.");
    expect(assertInteger(3, 1, 7, "d", "Los días")).toBe(3);
    expect(() => assertInteger(2.5, 1, 7, "d", "Los días")).toThrow("Los días debe ser un número entero.");
    expect(() => assertInteger(8, 1, 7, "d", "Los días")).toThrow(NutritionInputError);
  });

  it("isNutritionInputError distingue otros errores", () => {
    expect(isNutritionInputError(new Error("x"))).toBe(false);
  });
});

describe("normalizeKey", () => {
  it("quita tildes, pasa a minúsculas y colapsa espacios", () => {
    expect(normalizeKey("  Ají   de GALLINA ")).toBe("aji de gallina");
    expect(normalizeKey("Vóley")).toBe("voley");
  });
});
