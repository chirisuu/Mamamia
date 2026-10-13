import { describe, expect, it } from "vitest";
import { assistantRiskBlocks, buildAssistantContext, isCareMode, type AssistantContextInput } from "./context";

const base: AssistantContextInput = {
  today: "2026-10-13",
  goalType: "lose_fat",
  targets: { energyKcal: 1850, proteinG: 120, carbsG: 200, fatG: 60, fiberG: 28, waterMl: 2200 },
  consumed: { energyKcal: 900, proteinG: 50, carbsG: 100, fatG: 30, fiberG: 10, itemsCount: 4 },
  quota: { used: 10, limit: 400 },
  safety: { eatingDisorderHistory: false, professionalReview: false, flaggedConversation: false },
};

describe("contexto mínimo del asistente", () => {
  it("incluye solo meta, objetivo, totales de hoy y cupo", () => {
    const text = buildAssistantContext(base);
    expect(text).toContain("Fecha de hoy (su zona horaria): 2026-10-13");
    expect(text).toContain("Objetivo declarado: bajar grasa");
    expect(text).toContain("Meta diaria vigente: 1,850 kcal");
    expect(text).toContain("Registrado hoy (4 alimentos): 900 kcal");
    expect(text).toContain("Le quedan 950 kcal");
    expect(text).toContain("Mensajes del asistente que le quedan este mes: 390 de 400");
    expect(text).toMatch(/no tienes acceso a otros datos, fotos ni datos de terceros/);
  });

  it("pasarse de la meta es información, no un fracaso", () => {
    const text = buildAssistantContext({ ...base, consumed: { ...base.consumed!, energyKcal: 2000 } });
    expect(text).toContain("150 kcal sobre su meta (es información, no un fracaso)");
  });

  it("sin meta ni registros lo dice (no inventa)", () => {
    const text = buildAssistantContext({ ...base, targets: null, consumed: null, goalType: null });
    expect(text).toContain("Meta diaria: aún no definida");
    expect(text).toContain("Registrado hoy: todavía nada");
    expect(text).toContain("Objetivo declarado: no definido");
  });

  it("modo cuidado (antecedente de TCA o conversación marcada): sin cifras de calorías", () => {
    for (const safety of [
      { ...base.safety, eatingDisorderHistory: true },
      { ...base.safety, flaggedConversation: true },
    ]) {
      expect(isCareMode(safety)).toBe(true);
      const text = buildAssistantContext({ ...base, safety });
      expect(text).not.toMatch(/\d kcal/);
      expect(text).toContain("MODO CUIDADO");
      expect(text).toContain("Línea 113");
    }
  });

  it("respeta los bloqueos del cribado de riesgo (déficit y ayuno)", () => {
    const text = buildAssistantContext({ ...base, safety: { ...base.safety, deficitBlocked: true, fastingBlocked: true } });
    expect(text).toContain("no aplica déficit");
    expect(text).toContain("no habilita el ayuno");
  });
});

describe("assistantRiskBlocks (src/lib/nutrition/risk.ts)", () => {
  it("menor de edad o embarazo bloquean déficit y ayuno", () => {
    expect(assistantRiskBlocks({ ageYears: 16, heightCm: 165, weightKg: 60, healthFlags: [], goalType: "lose_fat" })).toEqual({
      deficitBlocked: true,
      fastingBlocked: true,
    });
    expect(assistantRiskBlocks({ ageYears: 30, heightCm: null, weightKg: null, healthFlags: ["pregnant"], goalType: "maintain" })).toEqual({
      deficitBlocked: true,
      fastingBlocked: true,
    });
  });

  it("IMC bajo bloquea; diabetes con medicación solo bloquea el ayuno", () => {
    expect(assistantRiskBlocks({ ageYears: 30, heightCm: 170, weightKg: 50, healthFlags: [], goalType: "lose_fat" }).deficitBlocked).toBe(true);
    expect(assistantRiskBlocks({ ageYears: 40, heightCm: 170, weightKg: 80, healthFlags: ["diabetes_medication"], goalType: "lose_fat" })).toEqual({
      deficitBlocked: false,
      fastingBlocked: true,
    });
  });

  it("sin datos ni banderas no bloquea; ignora banderas desconocidas", () => {
    expect(assistantRiskBlocks({ ageYears: null, heightCm: null, weightKg: null, healthFlags: ["otra"], goalType: null })).toEqual({
      deficitBlocked: false,
      fastingBlocked: false,
    });
  });
});
