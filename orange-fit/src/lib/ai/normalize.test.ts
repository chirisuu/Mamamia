import { describe, expect, it } from "vitest";
import { normalizeGramsRange, normalizePhotoAnalysis, normalizeTextParse } from "./normalize";
import { photoAnalysisSchema, textParseSchema } from "./schemas";

describe("normalizeGramsRange", () => {
  it("ordena min ≤ best ≤ max, redondea y respeta 1–5000 g", () => {
    expect(normalizeGramsRange({ min: 200, best: 150, max: 100 })).toEqual({ min: 100, best: 150, max: 200 });
    expect(normalizeGramsRange({ min: 0, best: 0, max: 0 })).toEqual({ min: 1, best: 1, max: 1 });
    expect(normalizeGramsRange({ min: 100.4, best: 9000, max: 120 })).toEqual({ min: 100, best: 5000, max: 5000 });
  });
});

describe("normalizePhotoAnalysis", () => {
  it("sin comida → sin ítems aunque el modelo mande alguno", () => {
    const res = normalizePhotoAnalysis({
      is_food_image: false,
      uncertainty_note: "Es una foto de un paisaje.",
      items: [{ name_es: "x", preparation: "", estimated_grams: { min: 1, best: 2, max: 3 }, confidence: 0.1, visible_evidence: "" }],
    });
    expect(res).toEqual({ isFoodImage: false, items: [], uncertaintyNote: "Es una foto de un paisaje." });
  });

  it("descarta nombres vacíos, acota la confianza y recorta a 15 ítems", () => {
    const item = { name_es: "Papa sancochada", preparation: "sancochado", estimated_grams: { min: 80, best: 120, max: 160 }, confidence: 1.4, visible_evidence: "  Papas  amarillas  " };
    const res = normalizePhotoAnalysis({
      is_food_image: true,
      uncertainty_note: "",
      items: [{ ...item, name_es: "   " }, ...Array.from({ length: 20 }, () => item)],
    });
    expect(res.items).toHaveLength(15);
    expect(res.items[0]).toEqual({
      nameEs: "Papa sancochada",
      preparation: "sancochado",
      estimatedGrams: { min: 80, best: 120, max: 160 },
      confidence: 1,
      visibleEvidence: "Papas amarillas",
    });
    expect(res.uncertaintyNote).toBeNull();
  });
});

describe("normalizeTextParse", () => {
  it("marca la aclaración cuando falta la cantidad y no inventa gramos", () => {
    const res = normalizeTextParse({
      items: [
        { food_query: "Arroz", quantity: 2, unit: "Tazas", grams_if_stated: null, needs_clarification: false, clarification_question: null },
        { food_query: "leche", quantity: 1, unit: "vaso", grams_if_stated: null, needs_clarification: true, clarification_question: "¿Leche entera o descremada?" },
        { food_query: "pan", quantity: 0, unit: "unidad", grams_if_stated: 0, needs_clarification: false, clarification_question: null },
        { food_query: "  ", quantity: 1, unit: "g", grams_if_stated: null, needs_clarification: false, clarification_question: null },
      ],
    });
    expect(res.items).toHaveLength(3);
    expect(res.items[0]).toEqual({ foodQuery: "Arroz", quantity: 2, unit: "tazas", gramsIfStated: null, needsClarification: false, clarificationQuestion: null });
    expect(res.items[1]!.clarificationQuestion).toBe("¿Leche entera o descremada?");
    expect(res.items[2]).toMatchObject({ quantity: 1, gramsIfStated: null, needsClarification: true, clarificationQuestion: "¿Cuánto comiste de pan?" });
  });
});

describe("esquemas de salida", () => {
  it("no tienen ningún campo de calorías ni nutrientes", () => {
    const keys = JSON.stringify([Object.keys(photoAnalysisSchema.shape), Object.keys(photoAnalysisSchema.shape.items.element.shape), Object.keys(textParseSchema.shape.items.element.shape)]);
    expect(keys).not.toMatch(/kcal|calor|protein|carb|fat|grasa|nutri/i);
  });

  it("validan rangos (confianza 0–1)", () => {
    const bad = photoAnalysisSchema.safeParse({
      is_food_image: true,
      uncertainty_note: "",
      items: [{ name_es: "pan", preparation: "", estimated_grams: { min: 1, best: 2, max: 3 }, confidence: 7, visible_evidence: "" }],
    });
    expect(bad.success).toBe(false);
  });
});
