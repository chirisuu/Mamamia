import { describe, expect, it } from "vitest";
import type { PhotoCandidateDto, TextCandidateDto } from "../schemas";
import { portion, testFood } from "./__fixtures__/foods";
import {
  addedReviewItem,
  confidenceLevel,
  itemGrams,
  itemNutrients,
  itemProblem,
  photoReviewItems,
  reviewTotals,
  selectFood,
  textReviewItems,
  toConfirmItems,
} from "./review";

const arroz = testFood({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Arroz blanco cocido",
  per100g: { energyKcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, fiberG: 0.4, sugarG: null, saturatedFatG: null, sodiumMg: null },
  portions: [portion("taza", "1 taza", 1, "taza", 160, true)],
});
const pollo = testFood({
  id: "22222222-2222-4222-8222-222222222222",
  name: "Pechuga de pollo a la plancha",
  per100g: { energyKcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: 0, sugarG: null, saturatedFatG: null, sodiumMg: 74 },
});

function photoCandidate(overrides: Partial<PhotoCandidateDto> = {}): PhotoCandidateDto {
  return {
    key: "p0",
    nameEs: "arroz blanco cocido",
    preparation: null,
    estimatedGrams: { min: 120, best: 150, max: 200 },
    confidence: 0.82,
    visibleEvidence: "Granos blancos sueltos.",
    matches: [arroz],
    ...overrides,
  };
}

function textCandidate(overrides: Partial<TextCandidateDto> = {}): TextCandidateDto {
  return {
    key: "t0",
    foodQuery: "arroz blanco cocido",
    quantity: 1,
    unit: "taza",
    gramsIfStated: null,
    needsClarification: false,
    clarificationQuestion: null,
    matches: [arroz],
    ...overrides,
  };
}

describe("revisión de candidatos de foto", () => {
  it("elige la primera coincidencia de la base y la mejor estimación de gramos", () => {
    const [item] = photoReviewItems([photoCandidate()]);
    expect(item).toMatchObject({ origin: "ai", included: true, optionKey: "g", amount: 150, confidence: 0.82 });
    expect(item!.food?.id).toBe(arroz.id);
    expect(item!.range).toEqual({ min: 120, best: 150, max: 200 });
  });

  it("sin coincidencia en la base: no se incluye y queda «sin alimento»", () => {
    const [item] = photoReviewItems([photoCandidate({ matches: [] })]);
    expect(item).toMatchObject({ food: null, included: false });
    expect(itemProblem(item!)).toBe("no_food");
  });

  it("los nutrientes de la vista previa salen de la base por 100 g (nunca de la IA)", () => {
    const [item] = photoReviewItems([photoCandidate()]);
    // 150 g × 130 kcal/100 g = 195 kcal
    expect(itemNutrients(item!)).toMatchObject({ energyKcal: 195, proteinG: 4.1, carbsG: 42 });
  });
});

describe("revisión de candidatos de texto", () => {
  it("convierte la cantidad dicha con las porciones de la base", () => {
    const [item] = textReviewItems([textCandidate()]);
    expect(item).toMatchObject({ optionKey: "p:taza", amount: 1, included: true, detail: "1 taza" });
    expect(itemGrams(item!)).toBe(160);
  });

  it("si no se puede convertir, pide los gramos y no lo marca para registrar", () => {
    const [item] = textReviewItems([textCandidate({ foodQuery: "pollo", unit: "taza", matches: [pollo] })]);
    expect(item).toMatchObject({ amount: null, included: false });
    expect(item!.note).toMatch(/Indica los gramos/);
    expect(itemProblem(item!)).toBe("no_amount");
  });

  it("muestra la pregunta de aclaración", () => {
    const [item] = textReviewItems([textCandidate({ needsClarification: true, clarificationQuestion: "¿Era arroz blanco o integral?" })]);
    expect(item!.clarification).toBe("¿Era arroz blanco o integral?");
  });

  it("al cambiar de alimento recalcula la cantidad dicha con el nuevo alimento", () => {
    const [item] = textReviewItems([textCandidate({ unit: "taza", matches: [pollo] })]);
    const next = selectFood(item!, arroz);
    expect(next).toMatchObject({ optionKey: "p:taza", amount: 1, included: true });
    expect(next.matches.map((m) => m.id)).toEqual([pollo.id, arroz.id]);
    expect(selectFood(next, null)).toMatchObject({ food: null, included: false });
  });
});

describe("confirmación", () => {
  it("solo se envían los ítems marcados y válidos; la confianza solo en los de la IA", () => {
    const [ai] = photoReviewItems([photoCandidate()]);
    const [excluded] = photoReviewItems([photoCandidate({ key: "p1" })]);
    const added = addedReviewItem(pollo, "a1");
    const res = toConfirmItems([ai!, { ...excluded!, included: false }, { ...added, amount: 120 }]);
    expect(res.blocked).toEqual([]);
    expect(res.items).toEqual([
      { foodId: arroz.id, grams: 150, quantity: 150, unit: "g", confidence: 0.82, origin: "ai" },
      { foodId: pollo.id, grams: 120, quantity: 120, unit: "g", confidence: null, origin: "added" },
    ]);
  });

  it("un ítem marcado sin cantidad bloquea la confirmación (nada se registra a medias)", () => {
    const [item] = textReviewItems([textCandidate({ unit: "taza", matches: [pollo] })]);
    const res = toConfirmItems([{ ...item!, included: true }]);
    expect(res.items).toEqual([]);
    expect(res.blocked).toHaveLength(1);
  });

  it("más de 5 kg por alimento no se acepta", () => {
    const [item] = photoReviewItems([photoCandidate()]);
    expect(itemProblem({ ...item!, amount: 6000 })).toBe("too_much");
  });

  it("totales de la revisión con los valores de la base", () => {
    const items = [...photoReviewItems([photoCandidate()]), { ...addedReviewItem(pollo, "a1"), amount: 100 }];
    const totals = reviewTotals(items);
    expect(totals.count).toBe(2);
    expect(totals.nutrients?.energyKcal).toBe(360); // 195 + 165
  });

  it("nivel de confianza legible", () => {
    expect(confidenceLevel(0.82)).toEqual({ label: "alta", percent: 82 });
    expect(confidenceLevel(0.5)).toEqual({ label: "media", percent: 50 });
    expect(confidenceLevel(0.2)).toEqual({ label: "baja", percent: 20 });
  });
});
