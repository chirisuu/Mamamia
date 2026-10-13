import { describe, expect, it } from "vitest";
import {
  answersSchema,
  consentsSchema,
  isCompleteAnswers,
  ONBOARDING_DRAFT_VERSION,
  parseDraft,
  sanitizeDraftAnswers,
  submissionSchema,
  type OnboardingAnswers,
} from "./schemas";
import { ageGate, computePlan, goalNeedsRate, planInputFromAnswers, preliminaryRisk, weeklyRateOptions } from "./plan";
import { buildAutoTargetInputs, parseTargetInputs } from "@/features/profile/target-inputs";

const TODAY = "2026-10-13";

const base: OnboardingAnswers = {
  displayName: "Lucía",
  birthDate: "1994-05-20",
  sex: "female",
  heightCm: 162,
  weightKg: 70,
  targetWeightKg: 62,
  activityLevel: "light",
  trainingDaysPerWeek: 3,
  goal: "lose_fat",
  weeklyRateKg: 0.35,
  dietPattern: "omnivore",
  allergies: ["mani"],
  intolerances: ["lactosa"],
  restrictions: [],
  dislikedFoods: ["hígado"],
  countryCode: "PE",
  currencyCode: "PEN",
  weeklyBudget: 150,
  mealsPerDay: 4,
  experience: "beginner",
  healthFlags: [],
};

describe("esquemas del onboarding", () => {
  it("acepta respuestas completas y válidas", () => {
    expect(answersSchema.safeParse(base).success).toBe(true);
    expect(isCompleteAnswers(base)).toBe(true);
  });

  it.each([
    ["estatura fuera de rango", { heightCm: 90 }],
    ["peso fuera de rango", { weightKg: 401 }],
    ["fecha inválida", { birthDate: "2026-02-30" }],
    ["objetivo desconocido", { goal: "bulk" }],
    ["comidas por día fuera de rango", { mealsPerDay: 7 }],
    ["bandera de salud desconocida", { healthFlags: ["diabetes"] }],
    ["país en minúsculas", { countryCode: "pe" }],
    ["ritmo mayor a 2 kg", { weeklyRateKg: 2.5 }],
    ["días de entrenamiento con decimales", { trainingDaysPerWeek: 2.5 }],
  ])("rechaza %s", (_label, patch) => {
    expect(answersSchema.safeParse({ ...base, ...patch }).success).toBe(false);
  });

  it("deduplica etiquetas y banderas", () => {
    const parsed = answersSchema.parse({ ...base, allergies: ["mani", " mani "], healthFlags: ["pregnant", "pregnant"] });
    expect(parsed.allergies).toEqual(["mani"]);
    expect(parsed.healthFlags).toEqual(["pregnant"]);
  });

  it("los consentimientos de términos/privacidad y salud son obligatorios", () => {
    const ok = { termsPrivacy: true, healthData: true, aiProcessing: false, marketing: false };
    expect(consentsSchema.safeParse(ok).success).toBe(true);
    expect(consentsSchema.safeParse({ ...ok, healthData: false }).success).toBe(false);
    expect(consentsSchema.safeParse({ ...ok, termsPrivacy: false }).success).toBe(false);
    expect(submissionSchema.safeParse({ answers: base, consents: ok, timezone: "America/Lima" }).success).toBe(true);
  });

  it("el borrador conserva los campos válidos y descarta el resto", () => {
    expect(sanitizeDraftAnswers({ displayName: "Ana", heightCm: 30, sex: "otro", weightKg: 60 })).toEqual({
      displayName: "Ana",
      weightKg: 60,
    });
    const draft = parseDraft(
      JSON.stringify({
        version: ONBOARDING_DRAFT_VERSION,
        answers: { displayName: "Ana", heightCm: "alto" },
        consents: { termsPrivacy: true, healthData: "sí" },
        stepId: "height",
        stage: "awaiting_account",
      }),
    );
    expect(draft?.answers).toEqual({ displayName: "Ana" });
    expect(draft?.consents).toEqual({ termsPrivacy: true, healthData: false, aiProcessing: false, marketing: false });
    expect(draft?.stage).toBe("awaiting_account");
    expect(parseDraft("{no es json")).toBeNull();
    expect(parseDraft(JSON.stringify({ version: 99 }))).toBeNull();
  });
});

describe("edad", () => {
  it("clasifica por edad cumplida", () => {
    expect(ageGate("2014-10-14", TODAY)).toEqual({ gate: "too_young", age: 11 });
    expect(ageGate("2010-10-13", TODAY)).toEqual({ gate: "minor", age: 16 });
    expect(ageGate("2008-10-13", TODAY)).toEqual({ gate: "adult", age: 18 });
    expect(ageGate("2008-10-14", TODAY).gate).toBe("minor");
    expect(ageGate("1920-01-01", TODAY).gate).toBe("too_old");
    expect(ageGate("2027-01-01", TODAY).gate).toBe("invalid");
    expect(ageGate(undefined, TODAY).gate).toBe("invalid");
  });
});

describe("mapeo respuestas → computeTargets", () => {
  it("pasa los datos al motor y aplica el ritmo elegido al bajar grasa", () => {
    const plan = computePlan(planInputFromAnswers(base), TODAY);
    expect(plan.ageYears).toBe(32);
    expect(plan.effectiveGoal).toBe("lose_fat");
    expect(plan.requiresProfessionalReview).toBe(false);
    // TMB = 10×70 + 6.25×162 − 5×32 − 161 = 1391.5 → 1390; TDEE = 1390 × 1.375 = 1911 → 1910
    expect(plan.targets.bmr).toBe(1390);
    expect(plan.targets.tdee).toBe(1910);
    // Déficit = 0.35 × 7700 / 7 = 385 → 390 (redondeo a 10) → 1520 kcal
    expect(plan.targets.energyKcal).toBe(1520);
    expect(plan.targets.goalAdjustmentKcal).toBe(-390);
    expect(plan.storable).toBe(true);
  });

  it("el ritmo no se usa en objetivos sin déficit por ritmo", () => {
    const a = computePlan(planInputFromAnswers({ ...base, goal: "maintain", weeklyRateKg: 1 }), TODAY);
    expect(a.targets.goalAdjustmentKcal).toBe(0);
    const g = computePlan(planInputFromAnswers({ ...base, goal: "gain_muscle", weeklyRateKg: 0.2 }), TODAY);
    // Superávit por experiencia (principiante 15 %), no por ritmo.
    expect(g.targets.energyKcal).toBe(Math.round((1910 * 1.15) / 10) * 10);
  });

  it("menores de 18: sin déficit, metas de mantenimiento y revisión profesional", () => {
    const plan = computePlan(planInputFromAnswers({ ...base, birthDate: "2010-01-01" }), TODAY);
    expect(plan.ageYears).toBe(16);
    expect(plan.risk.level).toBe("professional");
    expect(plan.risk.flags).toContain("minor");
    expect(plan.effectiveGoal).toBe("maintain");
    expect(plan.targets.goalAdjustmentKcal).toBe(0);
    expect(plan.targets.energyKcal).toBe(plan.targets.tdee);
    expect(plan.requiresProfessionalReview).toBe(true);
    expect(plan.risk.messages.join(" ")).toMatch(/menos de 18 años/);
  });

  it("embarazo: sin déficit, agua extra y revisión profesional", () => {
    const plan = computePlan(planInputFromAnswers({ ...base, healthFlags: ["pregnant"] }), TODAY);
    expect(plan.risk.blocks.calorieDeficit).toBe(true);
    expect(plan.targets.goalAdjustmentKcal).toBe(0);
    expect(plan.requiresProfessionalReview).toBe(true);
    expect(plan.targets.waterMl).toBe(2300);
  });

  it("diabetes con medicación: el cribado no bloquea el déficit, pero las metas quedan en mantenimiento", () => {
    const plan = computePlan(planInputFromAnswers({ ...base, healthFlags: ["diabetes_medication"] }), TODAY);
    expect(plan.risk.blocks.calorieDeficit).toBe(false);
    expect(plan.risk.level).toBe("professional");
    expect(plan.maintenanceByProfile).toBe(true);
    expect(plan.targets.goalAdjustmentKcal).toBe(0);
    expect(plan.notes.join(" ")).toMatch(/mantenimiento/);
  });

  it("ganar músculo con perfil profesional también queda en mantenimiento", () => {
    const plan = computePlan(planInputFromAnswers({ ...base, goal: "gain_muscle", healthFlags: ["kidney_disease"] }), TODAY);
    expect(plan.effectiveGoal).toBe("maintain");
    expect(plan.targets.goalAdjustmentKcal).toBe(0);
    // Con enfermedad renal la proteína es solo referencial (0.8 g/kg).
    expect(plan.targets.proteinG).toBe(56);
  });

  it("guarda en inputs la fórmula, los pasos, supuestos, avisos y el cribado", () => {
    const input = planInputFromAnswers(base);
    const plan = computePlan(input, TODAY);
    const json = buildAutoTargetInputs(input, plan, {
      computedAt: "2026-10-13T12:00:00.000Z",
      weightSource: { kind: "onboarding", localDate: TODAY, weightKg: 70 },
      trigger: "onboarding",
    });
    expect(json.formula).toBe("Mifflin-St Jeor");
    const back = parseTargetInputs(JSON.parse(JSON.stringify(json)));
    expect(back.steps.length).toBe(plan.targets.steps.length);
    expect(back.assumptions).toEqual(plan.targets.assumptions);
    expect(back.bmr).toBe(1390);
    expect(back.tdee).toBe(1910);
    expect(back.weightKg).toBe(70);
    expect(parseTargetInputs({ steps: "roto" }).steps).toEqual([]);
    expect(parseTargetInputs(null).steps).toEqual([]);
  });
});

describe("opciones de ritmo", () => {
  it("muestra el % semanal y limita con perfil de precaución", () => {
    const ok = weeklyRateOptions("lose_fat", 80, { blocks: { aggressiveGoals: false, calorieDeficit: false, fasting: false, autoPlans: false } });
    expect(ok.map((o) => [o.pct, o.kg, o.disabled])).toEqual([
      [0.25, 0.2, false],
      [0.5, 0.4, false],
      [0.75, 0.6, false],
      [1, 0.8, false],
    ]);
    const older = preliminaryRisk({ birthDate: "1955-01-01", sex: "male", heightCm: 170, weightKg: 80, goal: "lose_fat" }, TODAY);
    expect(older.level).toBe("caution");
    const capped = weeklyRateOptions("lose_fat", 80, older);
    expect(capped.filter((o) => o.disabled).map((o) => o.pct)).toEqual([0.75, 1]);
    expect(capped[2]?.disabledReason).toMatch(/0.5 %/);
  });

  it("solo bajar grasa y ganar músculo piden ritmo", () => {
    expect(goalNeedsRate("lose_fat")).toBe(true);
    expect(goalNeedsRate("gain_muscle")).toBe(true);
    expect(goalNeedsRate("recomposition")).toBe(false);
    expect(weeklyRateOptions("maintain", 70, { blocks: { aggressiveGoals: false, calorieDeficit: false, fasting: false, autoPlans: false } })).toEqual([]);
    expect(weeklyRateOptions("gain_muscle", 70, { blocks: { aggressiveGoals: false, calorieDeficit: false, fasting: false, autoPlans: false } })[0]?.kg).toBe(0.18);
  });
});

describe("pasos del asistente", () => {
  // Importación diferida para no mezclar con los describe de arriba.
  it("muestra el paso de ritmo solo al bajar grasa o ganar músculo", async () => {
    const { visibleSteps } = await import("./steps");
    expect(visibleSteps({ goal: "lose_fat" })).toContain("rate");
    expect(visibleSteps({ goal: "maintain" })).not.toContain("rate");
    expect(visibleSteps({})).not.toContain("rate");
  });

  it("valida cada paso con mensajes en español", async () => {
    const { validateStep } = await import("./steps");
    expect(validateStep("name", {}, TODAY)).toBe("Escribe tu nombre.");
    expect(validateStep("name", { displayName: "Ana" }, TODAY)).toBeNull();
    expect(validateStep("birthDate", { birthDate: "2015-01-01" }, TODAY)).toMatch(/13 años/);
    expect(validateStep("birthDate", { birthDate: "2010-01-01" }, TODAY)).toBeNull();
    expect(validateStep("height", { heightCm: 99 }, TODAY)).toMatch(/100 cm/);
    // Presupuesto: sin responder ≠ "prefiero no indicarlo" (null).
    expect(validateStep("budget", {}, TODAY)).toMatch(/Prefiero no indicarlo/);
    expect(validateStep("budget", { weeklyBudget: null }, TODAY)).toBeNull();
    expect(validateStep("targetWeight", { targetWeightKg: null }, TODAY)).toBeNull();
  });

  it("el ritmo es obligatorio salvo que el déficit ya esté bloqueado (menor de edad)", async () => {
    const { validateStep } = await import("./steps");
    const adult = { birthDate: "1990-01-01", sex: "female" as const, heightCm: 160, weightKg: 70, goal: "lose_fat" as const };
    expect(validateStep("rate", adult, TODAY)).toBe("Elige un ritmo.");
    expect(validateStep("rate", { ...adult, weeklyRateKg: 0.35 }, TODAY)).toBeNull();
    expect(validateStep("rate", { ...adult, birthDate: "2011-01-01" }, TODAY)).toBeNull();
    // IMC < 18.5 también bloquea el déficit.
    expect(validateStep("rate", { ...adult, weightKg: 45 }, TODAY)).toBeNull();
  });

  it("valores iniciales al entrar a un paso, sin pisar respuestas", async () => {
    const { defaultsForStep, firstIncompleteStep } = await import("./steps");
    expect(defaultsForStep("height", { sex: "male" })).toEqual({ heightCm: 170 });
    expect(defaultsForStep("height", { heightCm: 181 })).toEqual({});
    expect(defaultsForStep("location", {})).toEqual({ countryCode: "PE", currencyCode: "PEN" });
    expect(firstIncompleteStep({ displayName: "Ana" }, TODAY)).toBe("birthDate");
    expect(firstIncompleteStep(base, TODAY)).toBe("result");
  });
});
