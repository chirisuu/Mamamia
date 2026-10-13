import { describe, expect, it } from "vitest";
import { portion, testFood } from "./__fixtures__/foods";
import { resolveSpokenAmount, splitSize } from "./resolve-amount";

const arroz = testFood({
  id: "arroz",
  name: "Arroz blanco cocido",
  portions: [portion("taza", "1 taza", 1, "taza", 160, true), portion("media", "1/2 taza", 0.5, "taza", 80)],
});

const palta = testFood({
  id: "palta",
  name: "Palta",
  portions: [portion("pp", "1 unidad pequeña", 1, "unidad", 120), portion("pm", "1 unidad mediana", 1, "unidad", 170, true)],
});

const leche = testFood({ id: "leche", name: "Leche entera", densityGPerMl: 1.03, portions: [] });
const pollo = testFood({ id: "pollo", name: "Pechuga de pollo", portions: [] });

describe("splitSize", () => {
  it("separa la unidad del tamaño", () => {
    expect(splitSize("unidad pequeña")).toEqual({ base: "unidad", size: "pequena" });
    expect(splitSize("taza")).toEqual({ base: "taza", size: null });
    expect(splitSize("grande")).toEqual({ base: "unidad", size: "grande" });
  });
});

describe("resolveSpokenAmount (solo datos de la base)", () => {
  it("gramos dichos explícitamente → se usan tal cual", () => {
    expect(resolveSpokenAmount({ quantity: 150, unit: "g", gramsIfStated: 150 }, pollo)).toMatchObject({
      optionKey: "g",
      amount: 150,
      grams: 150,
      status: "stated",
    });
  });

  it("unidad de masa → gramos (kg × 1000)", () => {
    expect(resolveSpokenAmount({ quantity: 0.25, unit: "kg", gramsIfStated: null }, pollo)).toMatchObject({ grams: 250, status: "mass" });
  });

  it("porción del alimento: «una taza» y «2 tazas» con la porción de la base", () => {
    expect(resolveSpokenAmount({ quantity: 1, unit: "taza", gramsIfStated: null }, arroz)).toMatchObject({
      optionKey: "p:taza",
      amount: 1,
      grams: 160,
      status: "portion",
      note: null,
    });
    expect(resolveSpokenAmount({ quantity: 2, unit: "tazas", gramsIfStated: null }, arroz)).toMatchObject({ grams: 320, status: "portion" });
  });

  it("tamaño: «una palta pequeña» elige la porción pequeña", () => {
    expect(resolveSpokenAmount({ quantity: 1, unit: "unidad pequeña", gramsIfStated: null }, palta)).toMatchObject({
      optionKey: "p:pp",
      grams: 120,
      status: "portion",
    });
  });

  it("tamaño sin porción de ese tamaño → aproximación avisada", () => {
    const res = resolveSpokenAmount({ quantity: 1, unit: "unidad grande", gramsIfStated: null }, palta);
    expect(res.status).toBe("approx");
    expect(res.grams).toBe(170);
    expect(res.note).toMatch(/Ajusta/);
  });

  it("volumen con densidad registrada → ml y gramos", () => {
    expect(resolveSpokenAmount({ quantity: 1, unit: "taza", gramsIfStated: null }, leche)).toMatchObject({
      optionKey: "ml",
      amount: 240,
      grams: 247.2,
      status: "volume",
    });
  });

  it("sin porción ni densidad → pide los gramos (nunca asume un peso)", () => {
    const res = resolveSpokenAmount({ quantity: 1, unit: "taza", gramsIfStated: null }, pollo);
    expect(res).toMatchObject({ optionKey: "g", amount: null, grams: null, status: "needs_grams" });
    expect(res.note).toMatch(/Indica los gramos/);
  });
});
