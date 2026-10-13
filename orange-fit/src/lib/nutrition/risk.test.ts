import { describe, expect, it } from "vitest";
import type { RiskInput } from "./risk";
import { RISK_FLAG_LABELS, screenRisk } from "./risk";

const base: RiskInput = { ageYears: 30, sex: "female", bmi: 23, healthFlags: [], goal: "lose_fat" };

describe("screenRisk", () => {
  it("adulto sin banderas → ok, sin bloqueos ni mensajes", () => {
    const r = screenRisk(base);
    expect(r).toEqual({
      level: "ok",
      flags: [],
      blocks: { calorieDeficit: false, fasting: false, aggressiveGoals: false, autoPlans: false },
      messages: [],
    });
  });

  it.each([
    ["menor de 18", { ageYears: 16 }, "minor"],
    ["embarazo", { healthFlags: ["pregnant"] }, "pregnant"],
    ["lactancia", { healthFlags: ["lactating"] }, "lactating"],
    ["IMC < 18.5", { bmi: 17.9 }, "underweight"],
    ["antecedente de TCA", { healthFlags: ["eating_disorder_history"] }, "eating_disorder_history"],
  ] as const)("%s → profesional, bloquea déficit y ayuno", (_name, patch, flag) => {
    const r = screenRisk({ ...base, ...patch });
    expect(r.level).toBe("professional");
    expect(r.flags).toEqual([flag]);
    expect(r.blocks).toEqual({ calorieDeficit: true, fasting: true, aggressiveGoals: true, autoPlans: true });
    expect(r.messages.some((m) => m.includes("mantenimiento"))).toBe(true);
    expect(r.messages.some((m) => m.includes("revisión de un profesional"))).toBe(true);
  });

  it.each([
    ["diabetes con medicación", "diabetes_medication"],
    ["enfermedad renal", "kidney_disease"],
  ] as const)("%s → profesional, bloquea ayuno pero no el déficit", (_name, flag) => {
    const r = screenRisk({ ...base, healthFlags: [flag] });
    expect(r.level).toBe("professional");
    expect(r.blocks.fasting).toBe(true);
    expect(r.blocks.calorieDeficit).toBe(false);
    expect(r.blocks.autoPlans).toBe(true);
    expect(r.messages.some((m) => m.includes("mantenimiento"))).toBe(false);
  });

  it("65 años o más → precaución con mensaje, sin bloqueos fuertes", () => {
    const r = screenRisk({ ...base, ageYears: 65 });
    expect(r.level).toBe("caution");
    expect(r.flags).toEqual(["older_adult"]);
    expect(r.blocks).toEqual({ calorieDeficit: false, fasting: false, aggressiveGoals: true, autoPlans: false });
    expect(r.messages[0]).toContain("65 años");
    expect(screenRisk({ ...base, ageYears: 64 }).level).toBe("ok");
  });

  it("IMC ≥ 40 → precaución (se compara con 1 decimal)", () => {
    expect(screenRisk({ ...base, bmi: 40 }).flags).toEqual(["severe_obesity"]);
    expect(screenRisk({ ...base, bmi: 39.96 }).flags).toEqual(["severe_obesity"]);
    expect(screenRisk({ ...base, bmi: 39.94 }).flags).toEqual([]);
    expect(screenRisk({ ...base, bmi: 40 }).level).toBe("caution");
  });

  it("el corte de 18.5 coincide con la clasificación OMS", () => {
    expect(screenRisk({ ...base, bmi: 18.5 }).flags).toEqual([]);
    expect(screenRisk({ ...base, bmi: 18.46 }).flags).toEqual([]);
    expect(screenRisk({ ...base, bmi: 18.44 }).flags).toEqual(["underweight"]);
  });

  it("otra condición → precaución", () => {
    const r = screenRisk({ ...base, healthFlags: ["other_condition"] });
    expect(r.level).toBe("caution");
    expect(r.messages[0]).toContain("referenciales");
  });

  it("IMC desconocido no dispara banderas de IMC", () => {
    expect(screenRisk({ ...base, bmi: null }).level).toBe("ok");
  });

  it("combina banderas en orden estable y toma el nivel más alto", () => {
    const r = screenRisk({ ...base, ageYears: 70, healthFlags: ["other_condition", "diabetes_medication"] });
    expect(r.level).toBe("professional");
    expect(r.flags).toEqual(["diabetes_medication", "older_adult", "other_condition"]);
  });

  it("respeta las banderas declaradas aunque el sexo de cálculo sea masculino", () => {
    const r = screenRisk({ ...base, sex: "male", healthFlags: ["pregnant"] });
    expect(r.blocks.calorieDeficit).toBe(true);
  });

  it("sin objetivo de déficit no agrega el aviso de mantenimiento", () => {
    const r = screenRisk({ ...base, ageYears: 16, goal: "maintain" });
    expect(r.messages.some((m) => m.includes("mantenimiento"))).toBe(false);
    expect(screenRisk({ ...base, ageYears: 16, goal: "recomposition" }).messages.some((m) => m.includes("mantenimiento"))).toBe(
      true,
    );
  });

  it("los mensajes son prudentes: sin diagnósticos ni promesas", () => {
    const all = screenRisk({
      ...base,
      ageYears: 16,
      bmi: 17,
      healthFlags: ["pregnant", "lactating", "eating_disorder_history", "diabetes_medication", "kidney_disease", "other_condition"],
    }).messages.join(" ");
    expect(all).not.toMatch(/tienes (diabetes|anorexia|bulimia)|garantiza|cura/i);
    expect(Object.keys(RISK_FLAG_LABELS)).toHaveLength(10);
  });
});
