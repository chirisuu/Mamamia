import { describe, expect, it } from "vitest";
import { NutritionInputError } from "./errors";
import type { TargetsInput } from "./targets";
import { computeMacros, computeTargets, KCAL_PER_KG_APPROX } from "./targets";

const male: TargetsInput = {
  sex: "male",
  ageYears: 30,
  heightCm: 175,
  weightKg: 80,
  activityLevel: "moderate",
  goal: "lose_fat",
  weeklyRateKg: 0.5,
};

const stepValue = (t: ReturnType<typeof computeTargets>, label: string) => t.steps.find((s) => s.label === label)?.value;

describe("computeTargets — caso base (hombre, perder grasa 0.5 kg/sem)", () => {
  const t = computeTargets(male);

  it("calcula TMB, gasto, déficit y calorías con redondeo a 10 kcal", () => {
    // TMB = 800 + 1093.75 − 150 + 5 = 1748.75 → 1750; gasto 1750 × 1.55 = 2712.5 → 2710
    expect(t.bmr).toBe(1750);
    expect(t.tdee).toBe(2710);
    // 0.5 × 7700 / 7 = 550
    expect(t.goalAdjustmentKcal).toBe(-550);
    expect(t.energyKcal).toBe(2160);
    expect(t.expectedWeeklyChangeKg).toBe(-0.5);
    expect(t.floorApplied).toBe(false);
    expect(t.capApplied).toBe(false);
  });

  it("reparte macros: proteína 2.0 g/kg, grasa 25 %, carbohidratos el resto", () => {
    expect(t.proteinG).toBe(160);
    expect(t.fatG).toBe(60); // 2160 × 0.25 / 9
    expect(t.carbsG).toBe(245); // (2160 − 640 − 540) / 4
    expect(t.fiberG).toBe(30); // 14 × 2.16 = 30.24
    expect(t.waterMl).toBe(2500);
    expect(t.proteinG * 4 + t.fatG * 9 + t.carbsG * 4).toBeCloseTo(t.energyKcal, -1);
  });

  it("justifica cada paso con su fórmula", () => {
    expect(t.method).toBe("mifflin_st_jeor");
    expect(t.steps.map((s) => s.label)).toEqual([
      "Metabolismo basal (Mifflin-St Jeor)",
      "Gasto energético total diario",
      "Ajuste por objetivo",
      "Calorías objetivo",
      "Proteína",
      "Grasa",
      "Carbohidratos",
      "Fibra",
      "Agua",
    ]);
    expect(t.steps[0]!.formula).toBe("10 × 80 kg + 6.25 × 175 cm − 5 × 30 años + 5");
    expect(t.steps[1]!.formula).toBe("1750 kcal × 1.55 (Moderado)");
    expect(t.steps[2]!.formula).toBe("−(0.5 kg/semana × 7700 kcal/kg ÷ 7 días)");
    expect(t.steps[3]!.formula).toBe("2710 kcal − 550 kcal");
    expect(stepValue(t, "Calorías objetivo")).toBe(t.energyKcal);
    expect(stepValue(t, "Agua")).toBe(2500);
    expect(t.assumptions.some((a) => a.includes("Hall, 2008"))).toBe(true);
    expect(t.assumptions.some((a) => a.includes("ISSN, 2017"))).toBe(true);
    expect(t.assumptions.some((a) => a.includes("14 g por cada 1000 kcal"))).toBe(true);
    expect(t.assumptions.some((a) => a.includes("EFSA (2010)"))).toBe(true);
    expect(t.warnings).toEqual([]);
    expect(t.bmi).toBe(26.1);
    expect(t.referenceWeightKg).toBe(80);
    expect(t.risk.level).toBe("ok");
  });
});

describe("computeTargets — límites del déficit", () => {
  it("tope de 25 % del gasto y piso de 1200 kcal en mujeres", () => {
    const t = computeTargets({
      sex: "female",
      ageYears: 45,
      heightCm: 155,
      weightKg: 58,
      activityLevel: "sedentary",
      goal: "lose_fat",
      weeklyRateKg: 1,
    });
    // TMB 1158.75 → 1160; gasto 1392 → 1390; déficit pedido 638 > 25 % (347.5) → −350; 1040 < piso 1200
    expect(t.bmr).toBe(1160);
    expect(t.tdee).toBe(1390);
    expect(stepValue(t, "Ajuste por objetivo")).toBe(-350);
    expect(t.capApplied).toBe(true);
    expect(t.floorApplied).toBe(true);
    expect(t.energyKcal).toBe(1200);
    expect(t.goalAdjustmentKcal).toBe(-190);
    expect(t.expectedWeeklyChangeKg).toBe(-0.17);
    expect(stepValue(t, "Piso de seguridad")).toBe(1200);
    expect(t.warnings.some((w) => w.includes("25 %"))).toBe(true);
    // El tope por peso no es el que manda: no se avisa dos veces.
    expect(t.warnings.some((w) => w.includes("Limitamos tu ritmo"))).toBe(false);
    expect(t.warnings.some((w) => w.includes("mínimo seguro de 1200 kcal"))).toBe(true);
  });

  it("piso de 1500 kcal en hombres", () => {
    const t = computeTargets({
      sex: "male",
      ageYears: 60,
      heightCm: 160,
      weightKg: 58,
      activityLevel: "sedentary",
      goal: "lose_fat",
      weeklyRateKg: 0.5,
    });
    // TMB 580 + 1000 − 300 + 5 = 1285 → 1290; gasto 1548 → 1550; −25 % → 1160 < 1500
    expect(t.energyKcal).toBe(1500);
    expect(t.floorApplied).toBe(true);
  });

  it("el piso nunca baja del metabolismo basal", () => {
    const t = computeTargets({
      sex: "female",
      ageYears: 25,
      heightCm: 180,
      weightKg: 110,
      activityLevel: "sedentary",
      goal: "lose_fat",
      weeklyRateKg: 1,
    });
    // TMB 1100 + 1125 − 125 − 161 = 1939 → 1940; gasto 2328 → 2330; −25 % → 1747.5 < TMB
    expect(t.energyKcal).toBe(1940);
    expect(t.floorApplied).toBe(true);
    expect(t.steps.find((s) => s.label === "Piso de seguridad")!.formula).toBe("máx(1200 kcal; TMB 1940 kcal)");
  });

  it("si el piso supera el gasto, la meta queda en mantenimiento", () => {
    const t = computeTargets({
      sex: "female",
      ageYears: 80,
      heightCm: 145,
      weightKg: 45,
      activityLevel: "sedentary",
      goal: "lose_fat",
      weeklyRateKg: 0.25,
    });
    expect(t.tdee).toBe(960);
    expect(t.energyKcal).toBe(960);
    expect(t.goalAdjustmentKcal).toBe(0);
    expect(t.expectedWeeklyChangeKg).toBe(0);
    expect(t.floorApplied).toBe(true);
    expect(t.warnings.some((w) => w.includes("por debajo de 1200 kcal"))).toBe(true);
    expect(t.warnings.some((w) => w.includes("19 a 78 años"))).toBe(true);
  });

  it("limita el ritmo al 1 % del peso cuando ese tope es el que manda", () => {
    const t = computeTargets({
      sex: "male",
      ageYears: 25,
      heightCm: 175,
      weightKg: 60,
      activityLevel: "very_active",
      goal: "lose_fat",
      weeklyRateKg: 1,
    });
    // gasto 1570 × 1.9 = 2983 → 2980; tope 0.6 kg → 660 kcal (< 25 % = 745)
    expect(t.goalAdjustmentKcal).toBe(-660);
    expect(t.capApplied).toBe(true);
    expect(t.warnings[0]).toBe("Limitamos tu ritmo a 0.6 kg por semana (1 % de tu peso) para cuidar tu masa muscular y tu salud.");
  });

  it("sube el ritmo al mínimo de 0.25 % del peso", () => {
    const t = computeTargets({ ...male, weeklyRateKg: 0.1 });
    // mínimo 0.2 kg → 220 kcal
    expect(t.goalAdjustmentKcal).toBe(-220);
    expect(t.assumptions.some((a) => a.includes("ritmo mínimo"))).toBe(true);
    expect(computeTargets({ ...male, weeklyRateKg: 0 }).goalAdjustmentKcal).toBe(-220);
  });

  it("sin ritmo indicado usa 0.5 kg/sem y lo declara", () => {
    const t = computeTargets({ ...male, weeklyRateKg: undefined });
    expect(t.goalAdjustmentKcal).toBe(-550);
    expect(t.assumptions.some((a) => a.includes("No indicaste un ritmo"))).toBe(true);
    expect(computeTargets({ ...male, weeklyRateKg: null }).goalAdjustmentKcal).toBe(-550);
  });

  it("con precaución (65+) el ritmo máximo baja a 0.5 % del peso", () => {
    const t = computeTargets({ ...male, ageYears: 70, weeklyRateKg: 1 });
    expect(t.risk.level).toBe("caution");
    // 0.4 kg → 440 kcal
    expect(t.goalAdjustmentKcal).toBe(-440);
    expect(t.warnings.some((w) => w.includes("0.5 % de tu peso"))).toBe(true);
  });

  it("usa la aproximación declarada de 7700 kcal/kg", () => {
    expect(KCAL_PER_KG_APPROX).toBe(7700);
  });
});

describe("computeTargets — bloqueos por riesgo", () => {
  it.each([
    ["embarazo", { sex: "female" as const, healthFlags: ["pregnant" as const] }],
    ["menor de 18", { ageYears: 16 }],
    ["antecedente de TCA", { healthFlags: ["eating_disorder_history" as const] }],
    ["IMC bajo", { weightKg: 52, heightCm: 175 }],
  ])("%s: sin déficit, meta de mantenimiento", (_name, patch) => {
    const t = computeTargets({ ...male, ...patch, weeklyRateKg: 1 });
    expect(t.risk.blocks.calorieDeficit).toBe(true);
    expect(t.energyKcal).toBe(t.tdee);
    expect(t.goalAdjustmentKcal).toBe(0);
    expect(t.floorApplied).toBe(false);
    expect(t.capApplied).toBe(false);
    expect(t.steps.find((s) => s.label === "Ajuste por objetivo")!.formula).toContain("mantenimiento por tu perfil de salud");
    expect(t.warnings).toContain("Por tu perfil de salud no aplicamos déficit: tu meta de calorías es de mantenimiento.");
    expect(t.warnings.some((w) => w.includes("Limitamos"))).toBe(false);
    expect(t.assumptions.some((a) => a.includes("7700"))).toBe(false);
  });

  it("recomposición también queda en mantenimiento si el déficit está bloqueado", () => {
    const t = computeTargets({ ...male, goal: "recomposition", ageYears: 17 });
    expect(t.goalAdjustmentKcal).toBe(0);
    expect(t.warnings.some((w) => w.includes("menores de 18"))).toBe(true);
  });

  it("los mensajes del cribado viajan en risk.messages", () => {
    const t = computeTargets({ ...male, sex: "female", healthFlags: ["pregnant"] });
    expect(t.risk.level).toBe("professional");
    expect(t.risk.messages.length).toBeGreaterThan(0);
    expect(t.waterMl).toBe(2300);
  });

  it("enfermedad renal: proteína de referencia 0.8 g/kg y aviso", () => {
    const t = computeTargets({ ...male, goal: "maintain", healthFlags: ["kidney_disease"] });
    expect(t.proteinG).toBe(64);
    expect(t.warnings.some((w) => w.includes("enfermedad renal"))).toBe(true);
    expect(t.assumptions.some((a) => a.includes("ISSN"))).toBe(false);
  });
});

describe("computeTargets — otros objetivos", () => {
  it("recomposición: −10 % del gasto y proteína 2.2 g/kg", () => {
    const t = computeTargets({ ...male, goal: "recomposition" });
    expect(t.goalAdjustmentKcal).toBe(-270); // −271 → −270
    expect(t.energyKcal).toBe(2440);
    expect(t.proteinG).toBe(176);
    expect(t.expectedWeeklyChangeKg).toBe(-0.25);
  });

  it.each([
    ["beginner", 450, 3420],
    ["intermediate", 300, 3270],
    ["advanced", 150, 3120],
    [null, 300, 3270],
  ] as const)("ganar músculo (%s): superávit según experiencia", (experience, adj, energy) => {
    const t = computeTargets({
      sex: "male",
      ageYears: 22,
      heightCm: 180,
      weightKg: 70,
      activityLevel: "active",
      goal: "gain_muscle",
      experience,
    });
    expect(t.tdee).toBe(2970);
    expect(t.goalAdjustmentKcal).toBe(adj);
    expect(t.energyKcal).toBe(energy);
    expect(t.proteinG).toBe(126); // 1.8 g/kg
    expect(t.expectedWeeklyChangeKg).toBeNull();
    expect(t.floorApplied).toBe(false);
  });

  it("ganar músculo con precaución limita el superávit al 10 %", () => {
    const t = computeTargets({ ...male, ageYears: 68, goal: "gain_muscle", experience: "beginner" });
    expect(t.capApplied).toBe(true);
    expect(t.goalAdjustmentKcal).toBe(t.energyKcal - t.tdee);
    expect(t.warnings).toContain("Por tu perfil limitamos el superávit al 10 % de tu gasto.");
  });

  it.each(["maintain", "improve_habits"] as const)("%s: sin ajuste y grasa 30 %", (goal) => {
    const t = computeTargets({ ...male, goal });
    expect(t.goalAdjustmentKcal).toBe(0);
    expect(t.energyKcal).toBe(2710);
    expect(t.proteinG).toBe(128); // 1.6 g/kg
    expect(t.fatG).toBe(90); // 2710 × 0.3 / 9 = 90.3
    expect(t.steps.find((s) => s.label === "Calorías objetivo")!.formula).toBe("2710 kcal (mantenimiento)");
  });
});

describe("computeTargets — peso de referencia con IMC ≥ 30", () => {
  it("usa el peso con IMC 25 a su talla para proteína y grasa mínima", () => {
    const t = computeTargets({
      sex: "female",
      ageYears: 35,
      heightCm: 160,
      weightKg: 95,
      activityLevel: "light",
      goal: "lose_fat",
      weeklyRateKg: 0.8,
    });
    expect(t.bmi).toBe(37.1);
    expect(t.referenceWeightKg).toBe(64);
    expect(t.proteinG).toBe(128);
    expect(stepValue(t, "Peso de referencia (IMC 25)")).toBe(64);
    expect(t.steps.find((s) => s.label === "Peso de referencia (IMC 25)")!.formula).toBe("25 × (1.6 m)²");
    expect(t.assumptions.some((a) => a.includes("IMC de 25"))).toBe(true);
  });

  it("con IMC < 30 usa el peso actual", () => {
    expect(computeTargets({ ...male, weightKg: 91 }).referenceWeightKg).toBe(91); // IMC 29.7
  });
});

describe("computeTargets — validación", () => {
  it("rechaza datos fuera de rango o inválidos", () => {
    // @ts-expect-error: valor inválido a propósito
    expect(() => computeTargets({ ...male, goal: "bulk" })).toThrow("El objetivo no es válido.");
    expect(() => computeTargets({ ...male, weeklyRateKg: 3 })).toThrow("El ritmo semanal debe estar entre 0 y 2 kg.");
    // @ts-expect-error: valor inválido a propósito
    expect(() => computeTargets({ ...male, experience: "expert" })).toThrow("La experiencia indicada no es válida.");
    // @ts-expect-error: valor inválido a propósito
    expect(() => computeTargets({ ...male, activityLevel: "x" })).toThrow(NutritionInputError);
    expect(() => computeTargets({ ...male, ageYears: 10 })).toThrow(NutritionInputError);
    expect(() => computeTargets({ ...male, weightKg: 500 })).toThrow(NutritionInputError);
  });
});

describe("computeMacros", () => {
  it("reparto normal", () => {
    const m = computeMacros({ energyKcal: 2000, referenceWeightKg: 70, proteinGPerKg: 2, minProteinGPerKg: 1.6, fatFraction: 0.25 });
    expect(m).toMatchObject({ proteinG: 140, fatG: 56, carbsG: 234, proteinGPerKgUsed: 2, warnings: [] });
    expect(m.steps[1]!.formula).toBe("máx(25 % × 2000 kcal ÷ 9 = 56 g; 0.6 g/kg × 70 kg = 42 g)");
  });

  it("aplica la grasa mínima de 0.6 g/kg", () => {
    const m = computeMacros({ energyKcal: 1200, referenceWeightKg: 80, proteinGPerKg: 1.6, minProteinGPerKg: 1.6, fatFraction: 0.25 });
    expect(m.fatG).toBe(48); // 0.6 × 80 > 33
  });

  it("si los carbohidratos quedarían negativos, baja primero la grasa a su mínimo", () => {
    const m = computeMacros({ energyKcal: 1500, referenceWeightKg: 60, proteinGPerKg: 2.2, minProteinGPerKg: 1.6, fatFraction: 0.7 });
    expect(m.fatG).toBe(36);
    expect(m.proteinG).toBe(132);
    expect(m.carbsG).toBe(162);
    expect(m.steps[1]!.formula).toContain("mínimo");
    expect(m.warnings).toEqual([]);
  });

  it("luego baja la proteína al mínimo del rango", () => {
    const m = computeMacros({ energyKcal: 950, referenceWeightKg: 70, proteinGPerKg: 2.2, minProteinGPerKg: 1.6, fatFraction: 0.25 });
    expect(m.proteinG).toBe(112);
    expect(m.proteinGPerKgUsed).toBe(1.6);
    expect(m.carbsG).toBe(31); // (950 − 448 − 378) / 4
    expect(m.warnings[0]).toContain("1.6 g/kg");
  });

  it("si aún no alcanza, deja carbohidratos en 0 y avisa (nunca negativos)", () => {
    const m = computeMacros({ energyKcal: 1000, referenceWeightKg: 100, proteinGPerKg: 2, minProteinGPerKg: 1.6, fatFraction: 0.3 });
    expect(m.carbsG).toBe(0);
    expect(m.warnings).toHaveLength(2);
    expect(m.warnings[1]).toContain("quedan en 0");
  });

  it("valida la energía y el peso de referencia", () => {
    expect(() => computeMacros({ energyKcal: 0, referenceWeightKg: 70, proteinGPerKg: 2, minProteinGPerKg: 1.6, fatFraction: 0.25 })).toThrow(
      NutritionInputError,
    );
    expect(() => computeMacros({ energyKcal: 2000, referenceWeightKg: -1, proteinGPerKg: 2, minProteinGPerKg: 1.6, fatFraction: 0.25 })).toThrow(
      NutritionInputError,
    );
  });
});
