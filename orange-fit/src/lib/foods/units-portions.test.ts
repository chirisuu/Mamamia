import { describe, expect, it } from "vitest";
import type { FoodPortionDto } from "./api-types";
import { amountOptions, defaultAmountOption, gramsFor, parseGramsFromLabel, resolveAmount } from "./units-portions";

const portion = (id: string, label: string, unit: string, gramWeight: number, isDefault = false, quantity = 1): FoodPortionDto => ({
  id,
  label,
  quantity,
  unit,
  gramWeight,
  isDefault,
});

const rice = {
  densityGPerMl: null,
  portions: [portion("a", "1 taza", "taza", 160), portion("b", "1 cucharón", "cucharon", 90, true), portion("c", "Media taza", "taza", 80, false, 0.5)],
};

describe("parseGramsFromLabel", () => {
  it.each([
    ["30 g", 30],
    ["2 cucharadas (30 g)", 30],
    ["1 oz (28g)", 28],
    ["0,5 kg", 500],
    ["100 grams", 100],
    ["1 paquete (36 g)", 36],
    ["1 oz", 28.35],
  ])("%s → %s g", (text, grams) => {
    expect(parseGramsFromLabel(text)).toBe(grams);
  });

  it.each(["250 ml", "1 cup (240 ml)", "500 mg", "", null, "2 galletas", "9000 g"])("%s → null (sin asumir densidad)", (text) => {
    expect(parseGramsFromLabel(text)).toBeNull();
  });
});

describe("opciones de cantidad", () => {
  it("gramos primero; porciones con la por defecto al inicio", () => {
    const opts = amountOptions(rice);
    expect(opts.map((o) => o.label)).toEqual(["Gramos", "1 cucharón", "Media taza", "1 taza"]);
    expect(defaultAmountOption(opts).label).toBe("1 cucharón");
    expect(defaultAmountOption(amountOptions({ densityGPerMl: null, portions: [] })).kind).toBe("grams");
  });

  it("resolveAmount calcula gramos y la cantidad visible en la unidad de la porción", () => {
    const opts = amountOptions(rice);
    expect(resolveAmount(opts[0], 150)).toEqual({ grams: 150, quantity: 150, unit: "g" });
    const half = opts.find((o) => o.label === "Media taza")!;
    expect(resolveAmount(half, 2)).toEqual({ grams: 160, quantity: 1, unit: "taza" });
  });
});

describe("gramsFor", () => {
  it("usa masa directa, la porción del alimento o la densidad", () => {
    expect(gramsFor(2, "kg", rice)).toEqual({ ok: true, grams: 2000 });
    expect(gramsFor(1, "taza", rice)).toEqual({ ok: true, grams: 160 });
    expect(gramsFor(250, "ml", { densityGPerMl: 1.03, portions: [] })).toEqual({ ok: true, grams: 257.5 });
  });

  it("explica por qué no puede convertir (nunca asume densidad 1)", () => {
    const r = gramsFor(250, "ml", { densityGPerMl: null, portions: [] });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toMatch(/densidad/);
  });
});
