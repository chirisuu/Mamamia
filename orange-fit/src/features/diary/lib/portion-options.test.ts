import { describe, expect, it } from "vitest";
import {
  buildAmountOptions,
  defaultAmountOption,
  gramsForAmount,
  matchItemAmount,
  portionUnitLabel,
  storedQuantity,
} from "./portion-options";
import type { FoodPortion } from "../types";

const portions: FoodPortion[] = [
  { id: "a", label: "1 unidad grande", quantity: 1, unit: "unidad", gramWeight: 60, isDefault: false },
  { id: "b", label: "1/2 taza", quantity: 0.5, unit: "taza", gramWeight: 95, isDefault: true },
  { id: "c", label: "10 unidades", quantity: 10, unit: "unidad", gramWeight: 50, isDefault: false },
];

describe("portionUnitLabel", () => {
  it("quita la cantidad inicial de la etiqueta", () => {
    expect(portionUnitLabel(portions[0]!)).toBe("unidad grande");
    expect(portionUnitLabel(portions[1]!)).toBe("taza");
    expect(portionUnitLabel(portions[2]!)).toBe("unidades");
    expect(portionUnitLabel({ label: "1/8 de pollo, parte comestible", unit: "pollo" })).toBe("pollo, parte comestible");
    expect(portionUnitLabel({ label: "  ", unit: "vaso" })).toBe("vaso");
  });
});

describe("buildAmountOptions", () => {
  it("pone primero la porción por defecto, luego el resto y gramos", () => {
    const options = buildAmountOptions({ portions, densityGPerMl: null });
    expect(options.map((o) => o.key)).toEqual(["p:b", "p:a", "p:c", "g"]);
    const half = options[0]!;
    expect(half.gramsPerUnit).toBe(190);
    expect(half.defaultAmount).toBe(0.5);
    expect(half.step).toBe(0.5);
  });

  it("agrega mililitros solo con densidad", () => {
    expect(buildAmountOptions({ portions: [], densityGPerMl: 1.03 }).map((o) => o.key)).toEqual(["g", "ml"]);
    expect(buildAmountOptions({ portions: [], densityGPerMl: null }).map((o) => o.key)).toEqual(["g"]);
  });

  it("ignora porciones inválidas", () => {
    const bad: FoodPortion = { id: "x", label: "rota", quantity: 0, unit: "u", gramWeight: 10, isDefault: true };
    expect(buildAmountOptions({ portions: [bad], densityGPerMl: null }).map((o) => o.key)).toEqual(["g"]);
  });
});

describe("gramos y cantidad guardada", () => {
  const options = buildAmountOptions({ portions, densityGPerMl: 1.03 });

  it("convierte a gramos", () => {
    expect(gramsForAmount(options.find((o) => o.key === "p:b")!, 1)).toBe(190);
    expect(gramsForAmount(options.find((o) => o.key === "p:c")!, 3)).toBe(15);
    expect(gramsForAmount(options.find((o) => o.key === "ml")!, 250)).toBe(257.5);
    expect(gramsForAmount(options.find((o) => o.key === "g")!, 0)).toBe(0);
  });

  it("guarda la unidad legible", () => {
    expect(storedQuantity(options.find((o) => o.key === "p:a")!, 2)).toEqual({ quantity: 2, unit: "unidad grande" });
    expect(storedQuantity(options.find((o) => o.key === "g")!, 150)).toEqual({ quantity: 150, unit: "g" });
  });

  it("la opción por defecto es la porción marcada", () => {
    expect(defaultAmountOption(options, portions).key).toBe("p:b");
    expect(defaultAmountOption(buildAmountOptions({ portions: [], densityGPerMl: null }), []).key).toBe("g");
  });

  it("reconoce la porción de un ítem guardado o vuelve a gramos", () => {
    expect(matchItemAmount(options, { quantity: 2, unit: "unidad grande", grams: 120 })).toMatchObject({
      option: { key: "p:a" },
      amount: 2,
    });
    expect(matchItemAmount(options, { quantity: 150, unit: "g", grams: 150 })).toMatchObject({ option: { key: "g" }, amount: 150 });
    // La porción cambió de peso desde que se registró: se edita en gramos.
    expect(matchItemAmount(options, { quantity: 2, unit: "unidad grande", grams: 200 })).toMatchObject({
      option: { key: "g" },
      amount: 200,
    });
  });
});
