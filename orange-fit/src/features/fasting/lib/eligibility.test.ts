import { describe, expect, it } from "vitest";
import { fastingEligibility, type EligibilityInput } from "./eligibility";

const today = "2026-10-13";

function input(overrides: Partial<EligibilityInput> & { flags?: string[]; birth?: string; weight?: number | null } = {}): EligibilityInput {
  const { flags = [], birth = "1990-05-01", weight = 72, ...rest } = overrides;
  return {
    today,
    profile: { birth_date: birth, sex: "female", height_cm: 165 },
    goal: { goal_type: "lose_fat", health_flags: flags, current_weight_kg: 74 },
    latestWeightKg: weight,
    hasActiveSession: false,
    ...rest,
  };
}

describe("bloqueos de ayuno (cribado de riesgo)", () => {
  it("adulto sin banderas: puede iniciar y siempre recibe el aviso de malestar", () => {
    const r = fastingEligibility(input());
    expect(r.allowed).toBe(true);
    expect(r.code).toBe("ok");
    expect(r.cautions.some((c) => c.includes("mareo"))).toBe(true);
  });

  it.each([
    ["pregnant", "Embarazo"],
    ["lactating", "Lactancia"],
    ["eating_disorder_history", "Antecedente de trastorno de la conducta alimentaria"],
    ["diabetes_medication", "Diabetes con medicación"],
    ["kidney_disease", "Enfermedad renal"],
  ])("bandera %s bloquea el ayuno y explica el motivo", (flag, label) => {
    const r = fastingEligibility(input({ flags: [flag] }));
    expect(r.allowed).toBe(false);
    expect(r.code).toBe("risk_blocked");
    expect(r.reason).toMatch(/médico o nutricionista/);
    expect(r.blockedBy).toContain(label);
  });

  it("menor de 18 años: bloqueado", () => {
    const r = fastingEligibility(input({ birth: "2010-01-01" }));
    expect(r.allowed).toBe(false);
    expect(r.blockedBy).toContain("Menor de 18 años");
  });

  it("IMC bajo (< 18.5) con el último peso: bloqueado", () => {
    const r = fastingEligibility(input({ weight: 48 })); // 48 / 1.65² ≈ 17.6
    expect(r.allowed).toBe(false);
    expect(r.blockedBy).toContain("IMC menor de 18.5");
  });

  it("sin pesaje usa el peso del objetivo para el IMC", () => {
    const r = fastingEligibility(input({ weight: null, goal: { goal_type: "maintain", health_flags: [], current_weight_kg: 45 } }));
    expect(r.allowed).toBe(false);
    expect(r.code).toBe("risk_blocked");
  });

  it("65 años o más: permitido con avisos de precaución", () => {
    const r = fastingEligibility(input({ birth: "1955-01-01" }));
    expect(r.allowed).toBe(true);
    expect(r.cautions.length).toBeGreaterThan(1);
  });

  it("faltan datos (sin fecha de nacimiento u objetivo): por prudencia no se permite", () => {
    expect(fastingEligibility(input({ profile: { birth_date: null, sex: "female", height_cm: 165 } })).code).toBe("missing_data");
    expect(fastingEligibility(input({ goal: null })).allowed).toBe(false);
    expect(fastingEligibility(input({ profile: null })).code).toBe("missing_data");
  });

  it("con un ayuno activo no se puede iniciar otro", () => {
    const r = fastingEligibility(input({ hasActiveSession: true }));
    expect(r.allowed).toBe(false);
    expect(r.code).toBe("active_session");
  });

  it("el bloqueo por riesgo tiene prioridad sobre el ayuno activo", () => {
    expect(fastingEligibility(input({ flags: ["pregnant"], hasActiveSession: true })).code).toBe("risk_blocked");
  });
});
