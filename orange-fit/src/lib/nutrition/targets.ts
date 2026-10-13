/**
 * Metas diarias: energía, macronutrientes, fibra y agua, con cada paso justificado.
 * Ver `docs/NUTRITION_ENGINE.md` para fórmulas y referencias.
 */
import { ACTIVITY_LEVELS, assertActivityLevel } from "./activity";
import { computeBmi, weightForBmi } from "./bmi";
import { bmrWarnings, mifflinFormula, mifflinStJeor, validateBmrInput } from "./bmr";
import { NutritionInputError } from "./errors";
import { assertInRange, assertPositive, fmt, fmtPct, roundDecimals, roundGrams, roundKcal } from "./math";
import type { RiskScreening } from "./risk";
import { screenRisk } from "./risk";
import type { ActivityLevel, Goal, HealthFlag, NutritionExperience, Sex } from "./types";
import { isGoal, NUTRITION_EXPERIENCES } from "./types";
import { waterTarget } from "./water";

/** Aproximación clásica de energía por kg de peso perdido (ver limitaciones en Hall, 2008). */
export const KCAL_PER_KG_APPROX = 7700;
/** Mínimos de guías clínicas (NHLBI) para planes de pérdida de peso sin supervisión. */
export const MIN_ENERGY_KCAL: Record<Sex, number> = { female: 1200, male: 1500 };
export const WEEKLY_LOSS_LIMITS = {
  minFractionOfWeight: 0.0025,
  maxFractionOfWeight: 0.01,
  /** Tope cuando el cribado pide prudencia (`blocks.aggressiveGoals`). */
  cautiousMaxFractionOfWeight: 0.005,
} as const;
export const MAX_DEFICIT_FRACTION_OF_TDEE = 0.25;
export const DEFAULT_WEEKLY_LOSS_KG = 0.5;
export const RECOMPOSITION_FRACTION = -0.1;
export const GAIN_SURPLUS_FRACTION: Record<NutritionExperience, number> = {
  beginner: 0.15,
  intermediate: 0.1,
  advanced: 0.05,
};
export const DEFAULT_GAIN_SURPLUS_FRACTION = 0.1;
export const CAUTIOUS_MAX_SURPLUS_FRACTION = 0.1;

/**
 * g de proteína por kg de referencia. ISSN 2017 recomienda 1.4–2.0 g/kg para la mayoría de personas
 * que entrenan y más en déficit; aquí se usa 1.6–2.2 según el objetivo.
 */
export const PROTEIN_G_PER_KG: Record<Goal, number> = {
  lose_fat: 2.0,
  recomposition: 2.2,
  gain_muscle: 1.8,
  maintain: 1.6,
  improve_habits: 1.6,
};
export const PROTEIN_MIN_G_PER_KG = 1.6;
/** Con enfermedad renal no se aplica proteína alta: referencia general (IDR) a confirmar con su profesional. */
export const KIDNEY_PROTEIN_G_PER_KG = 0.8;
export const FAT_FRACTION: Record<Goal, number> = {
  lose_fat: 0.25,
  recomposition: 0.25,
  gain_muscle: 0.25,
  maintain: 0.3,
  improve_habits: 0.3,
};
export const FAT_MIN_G_PER_KG = 0.6;
export const FIBER_G_PER_1000_KCAL = 14;
export const REFERENCE_BMI = 25;
export const REFERENCE_WEIGHT_FROM_BMI = 30;

export interface TargetsInput {
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  /** Magnitud del cambio semanal deseado (kg, ≥ 0). Solo se usa para `lose_fat`. */
  weeklyRateKg?: number | null;
  experience?: NutritionExperience | null;
  healthFlags?: readonly HealthFlag[];
}

export interface TargetStep {
  label: string;
  formula: string;
  value: number;
  unit: "kcal" | "g" | "kg" | "ml";
}

export interface NutritionTargets {
  method: "mifflin_st_jeor";
  bmr: number;
  tdee: number;
  /** Ajuste efectivo: energyKcal − tdee (tras topes, bloqueos y piso). */
  goalAdjustmentKcal: number;
  /**
   * Cambio de peso semanal esperado al inicio con la aproximación de 7700 kcal/kg (negativo = bajar).
   * 0 en mantenimiento; null con superávit (el costo energético de ganar músculo no se estima así).
   */
  expectedWeeklyChangeKg: number | null;
  energyKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  fiberG: number;
  waterMl: number;
  floorApplied: boolean;
  capApplied: boolean;
  /** IMC con 1 decimal. */
  bmi: number;
  referenceWeightKg: number;
  risk: RiskScreening;
  steps: TargetStep[];
  assumptions: string[];
  warnings: string[];
}

export interface MacroInput {
  energyKcal: number;
  referenceWeightKg: number;
  proteinGPerKg: number;
  /** Hasta dónde se puede bajar la proteína si los carbohidratos quedarían negativos. */
  minProteinGPerKg: number;
  fatFraction: number;
}

export interface MacroSplit {
  proteinG: number;
  fatG: number;
  carbsG: number;
  proteinGPerKgUsed: number;
  steps: TargetStep[];
  warnings: string[];
}

/**
 * Reparte la energía: proteína por kg de referencia, grasa por % (con mínimo por kg) y
 * carbohidratos con el resto. Si el resto fuera negativo, baja primero la grasa a su mínimo,
 * luego la proteína al mínimo del rango y, si aún no alcanza, deja los carbohidratos en 0.
 */
export function computeMacros(input: MacroInput): MacroSplit {
  const energy = assertPositive(input.energyKcal, "energyKcal", "La energía");
  const ref = assertPositive(input.referenceWeightKg, "referenceWeightKg", "El peso de referencia");
  const warnings: string[] = [];

  let perKg = input.proteinGPerKg;
  let proteinG = roundGrams(perKg * ref);
  const fatByPct = roundGrams((input.fatFraction * energy) / 9);
  const fatMin = roundGrams(FAT_MIN_G_PER_KG * ref);
  let fatG = Math.max(fatByPct, fatMin);
  let fatFormula = `máx(${fmtPct(input.fatFraction)} × ${fmt(energy)} kcal ÷ 9 = ${fatByPct} g; ${FAT_MIN_G_PER_KG} g/kg × ${fmt(ref, 1)} kg = ${fatMin} g)`;
  let carbsKcal = energy - 4 * proteinG - 9 * fatG;

  if (carbsKcal < 0 && fatG > fatMin) {
    fatG = fatMin;
    fatFormula = `${FAT_MIN_G_PER_KG} g/kg × ${fmt(ref, 1)} kg (mínimo, para que los carbohidratos no queden negativos)`;
    carbsKcal = energy - 4 * proteinG - 9 * fatG;
  }
  if (carbsKcal < 0 && perKg > input.minProteinGPerKg) {
    perKg = input.minProteinGPerKg;
    proteinG = roundGrams(perKg * ref);
    carbsKcal = energy - 4 * proteinG - 9 * fatG;
    warnings.push(`Bajamos la proteína a ${fmt(perKg)} g/kg para que tus calorías alcancen para todos los macronutrientes.`);
  }
  if (carbsKcal < 0) {
    warnings.push(
      "Con esta meta de calorías, la proteína y la grasa mínimas ya la superan: los carbohidratos quedan en 0. Revisa tu meta con un profesional de salud.",
    );
    carbsKcal = 0;
  }
  const carbsG = roundGrams(carbsKcal / 4);

  const steps: TargetStep[] = [
    { label: "Proteína", formula: `${fmt(perKg)} g/kg × ${fmt(ref, 1)} kg`, value: proteinG, unit: "g" },
    { label: "Grasa", formula: fatFormula, value: fatG, unit: "g" },
    {
      label: "Carbohidratos",
      formula: `(${fmt(energy)} kcal − 4 × ${proteinG} g − 9 × ${fatG} g) ÷ 4`,
      value: carbsG,
      unit: "g",
    },
  ];
  return { proteinG, fatG, carbsG, proteinGPerKgUsed: perKg, steps, warnings };
}

function validateTargetsInput(input: TargetsInput): void {
  validateBmrInput(input);
  assertActivityLevel(input.activityLevel);
  if (typeof input.goal !== "string" || !isGoal(input.goal)) {
    throw new NutritionInputError("invalid_value", "goal", "El objetivo no es válido.");
  }
  if (input.weeklyRateKg != null) {
    assertInRange(input.weeklyRateKg, 0, 2, "weeklyRateKg", "El ritmo semanal", "kg");
  }
  if (input.experience != null && !(NUTRITION_EXPERIENCES as readonly string[]).includes(input.experience)) {
    throw new NutritionInputError("invalid_value", "experience", "La experiencia indicada no es válida.");
  }
}

export function computeTargets(input: TargetsInput): NutritionTargets {
  validateTargetsInput(input);
  const { sex, ageYears, heightCm, weightKg, goal } = input;
  const healthFlags = input.healthFlags ?? [];
  const bmiRaw = computeBmi(weightKg, heightCm);
  const bmi = roundDecimals(bmiRaw, 1);
  const risk = screenRisk({ ageYears, sex, bmi: bmiRaw, healthFlags, goal });

  const steps: TargetStep[] = [];
  const assumptions: string[] = [
    "El metabolismo basal se estima con la ecuación de Mifflin-St Jeor (1990); en una persona concreta puede variar alrededor de ±10 %.",
    "El factor de actividad ya incluye tu ejercicio habitual; por eso las calorías del ejercicio no se suman por defecto.",
  ];
  const warnings: string[] = [...bmrWarnings({ ageYears })];

  // 1–2. Gasto: cada paso usa el valor redondeado del anterior para que la explicación cuadre.
  const bmr = roundKcal(mifflinStJeor(input));
  steps.push({ label: "Metabolismo basal (Mifflin-St Jeor)", formula: mifflinFormula(input), value: bmr, unit: "kcal" });
  const activity = ACTIVITY_LEVELS[input.activityLevel];
  const tdee = roundKcal(bmr * activity.factor);
  steps.push({
    label: "Gasto energético total diario",
    formula: `${bmr} kcal × ${activity.factor} (${activity.label})`,
    value: tdee,
    unit: "kcal",
  });

  // 3. Ajuste por objetivo (o bloqueo del déficit por el cribado de riesgo).
  let adjustment = 0;
  let capApplied = false;
  let adjustmentFormula = "0 kcal (mantenimiento)";
  const deficitGoal = goal === "lose_fat" || goal === "recomposition";
  if (deficitGoal && risk.blocks.calorieDeficit) {
    adjustmentFormula = "Objetivo con déficit → 0 kcal (mantenimiento por tu perfil de salud)";
    warnings.push("Por tu perfil de salud no aplicamos déficit: tu meta de calorías es de mantenimiento.");
  } else {
    switch (goal) {
      case "lose_fat": {
        const requested = input.weeklyRateKg ?? null;
        let rate = requested ?? DEFAULT_WEEKLY_LOSS_KG;
        if (requested === null) {
          assumptions.push(`No indicaste un ritmo semanal: usamos ${fmt(DEFAULT_WEEKLY_LOSS_KG)} kg por semana como punto de partida.`);
        }
        const maxFraction = risk.blocks.aggressiveGoals
          ? WEEKLY_LOSS_LIMITS.cautiousMaxFractionOfWeight
          : WEEKLY_LOSS_LIMITS.maxFractionOfWeight;
        const minRate = weightKg * WEEKLY_LOSS_LIMITS.minFractionOfWeight;
        const maxRate = weightKg * maxFraction;
        let rateCapped = false;
        if (rate > maxRate) {
          rate = maxRate;
          rateCapped = true;
        } else if (rate < minRate) {
          rate = minRate;
          assumptions.push(
            `El ritmo mínimo que usamos es ${fmt(minRate)} kg por semana (${fmtPct(WEEKLY_LOSS_LIMITS.minFractionOfWeight)} de tu peso); por debajo, el cambio es difícil de distinguir de las variaciones diarias.`,
          );
        }
        let deficit = (rate * KCAL_PER_KG_APPROX) / 7;
        adjustmentFormula = `−(${fmt(rate)} kg/semana × ${KCAL_PER_KG_APPROX} kcal/kg ÷ 7 días)`;
        const maxDeficit = tdee * MAX_DEFICIT_FRACTION_OF_TDEE;
        if (deficit > maxDeficit) {
          // El tope del 25 % es el que manda: no hace falta avisar también del tope por peso.
          deficit = maxDeficit;
          capApplied = true;
          adjustmentFormula = `−25 % × ${tdee} kcal (tope del déficit)`;
          warnings.push("Limitamos el déficit al 25 % de tu gasto diario para que sea sostenible.");
        } else if (rateCapped) {
          capApplied = true;
          warnings.push(
            `Limitamos tu ritmo a ${fmt(maxRate)} kg por semana (${fmtPct(maxFraction)} de tu peso) para cuidar tu masa muscular y tu salud.`,
          );
        }
        adjustment = -deficit;
        assumptions.push(
          `Usamos la aproximación de ${KCAL_PER_KG_APPROX} kcal por kg: en la práctica la pérdida se desacelera con el tiempo porque el cuerpo se adapta (Hall, 2008). Ajustaremos según tu tendencia real de peso.`,
          `El ritmo se limita entre 0.25 % y ${fmtPct(maxFraction)} de tu peso por semana y el déficit a un máximo de 25 % de tu gasto.`,
        );
        break;
      }
      case "recomposition":
        adjustment = RECOMPOSITION_FRACTION * tdee;
        adjustmentFormula = `−10 % × ${tdee} kcal`;
        assumptions.push("Recomposición: déficit moderado del 10 % con proteína alta, acompañado de entrenamiento de fuerza.");
        break;
      case "gain_muscle": {
        let fraction = input.experience ? GAIN_SURPLUS_FRACTION[input.experience] : DEFAULT_GAIN_SURPLUS_FRACTION;
        if (risk.blocks.aggressiveGoals && fraction > CAUTIOUS_MAX_SURPLUS_FRACTION) {
          fraction = CAUTIOUS_MAX_SURPLUS_FRACTION;
          capApplied = true;
          warnings.push("Por tu perfil limitamos el superávit al 10 % de tu gasto.");
        }
        adjustment = fraction * tdee;
        const exp = input.experience
          ? { beginner: "principiante", intermediate: "intermedio", advanced: "avanzado" }[input.experience]
          : "sin dato de experiencia";
        adjustmentFormula = `+${fmtPct(fraction)} × ${tdee} kcal (${exp})`;
        assumptions.push(
          "El superávit va de 5 % a 15 % según tu experiencia: quien empieza puede ganar músculo más rápido; con más experiencia, un superávit menor limita la ganancia de grasa.",
        );
        break;
      }
      case "maintain":
        assumptions.push("Mantener: la meta es tu gasto estimado, sin déficit ni superávit.");
        break;
      case "improve_habits":
        assumptions.push("Mejorar hábitos: la meta es tu gasto estimado; el foco está en la calidad y la regularidad, no en restringir.");
        break;
    }
  }
  const adjustmentRounded = roundKcal(adjustment);
  steps.push({ label: "Ajuste por objetivo", formula: adjustmentFormula, value: adjustmentRounded, unit: "kcal" });

  // 4. Piso de seguridad (solo aplica cuando hay déficit).
  let energy = tdee + adjustmentRounded;
  let floorApplied = false;
  const minKcal = MIN_ENERGY_KCAL[sex];
  if (adjustmentRounded < 0) {
    const floor = Math.max(minKcal, bmr);
    if (energy < floor) {
      floorApplied = true;
      if (floor >= tdee) {
        energy = tdee;
        steps.push({
          label: "Piso de seguridad",
          formula: `máx(${minKcal} kcal; TMB ${bmr} kcal) = ${floor} kcal ≥ gasto ${tdee} kcal → mantenimiento`,
          value: energy,
          unit: "kcal",
        });
        warnings.push("Tu gasto diario estimado está muy cerca del mínimo seguro, así que por ahora tu meta es de mantenimiento.");
      } else {
        energy = floor;
        steps.push({ label: "Piso de seguridad", formula: `máx(${minKcal} kcal; TMB ${bmr} kcal)`, value: energy, unit: "kcal" });
        warnings.push(`Subimos tu meta al mínimo seguro de ${floor} kcal: no bajamos de ese piso ni de tu metabolismo basal.`);
      }
    }
  }
  const energyKcal = roundKcal(energy);
  const goalAdjustmentKcal = energyKcal - tdee;
  steps.push({
    label: "Calorías objetivo",
    formula:
      goalAdjustmentKcal === 0
        ? `${tdee} kcal (mantenimiento)`
        : `${tdee} kcal ${goalAdjustmentKcal < 0 ? "−" : "+"} ${Math.abs(goalAdjustmentKcal)} kcal`,
    value: energyKcal,
    unit: "kcal",
  });
  const expectedWeeklyChangeKg =
    goalAdjustmentKcal < 0
      ? roundDecimals((goalAdjustmentKcal * 7) / KCAL_PER_KG_APPROX, 2)
      : goalAdjustmentKcal === 0
        ? 0
        : null;
  if (expectedWeeklyChangeKg !== null && expectedWeeklyChangeKg < 0) {
    assumptions.push(
      `Con ${Math.abs(goalAdjustmentKcal)} kcal menos al día, el ritmo esperado al inicio es de unos ${fmt(Math.abs(expectedWeeklyChangeKg))} kg por semana.`,
    );
  }
  if (energyKcal < minKcal) {
    warnings.push(
      `Tu meta queda por debajo de ${minKcal} kcal porque tu gasto estimado es bajo. Consulta con un profesional para asegurarte de cubrir tus nutrientes.`,
    );
  }

  // 5. Macronutrientes.
  const usesReference = bmi >= REFERENCE_WEIGHT_FROM_BMI;
  const referenceWeightKg = usesReference ? roundDecimals(weightForBmi(REFERENCE_BMI, heightCm), 1) : weightKg;
  if (usesReference) {
    steps.push({
      label: "Peso de referencia (IMC 25)",
      formula: `${REFERENCE_BMI} × (${fmt(heightCm / 100, 2)} m)²`,
      value: referenceWeightKg,
      unit: "kg",
    });
    assumptions.push(
      "Como tu IMC es de 30 o más, la proteína y la grasa mínima se calculan con el peso que corresponde a un IMC de 25 a tu talla, para no sobrestimarlas.",
    );
  }
  const kidney = healthFlags.includes("kidney_disease");
  const proteinGPerKg = kidney ? KIDNEY_PROTEIN_G_PER_KG : PROTEIN_G_PER_KG[goal];
  if (kidney) {
    warnings.push(
      `Con enfermedad renal no usamos proteína alta: mostramos ${KIDNEY_PROTEIN_G_PER_KG} g/kg solo como referencia. Tu médico o nutricionista debe definir tu meta de proteína.`,
    );
  } else {
    assumptions.push(
      `Proteína: ${fmt(proteinGPerKg)} g/kg según tu objetivo (rango usado: 1.6–2.2 g/kg; ISSN, 2017).`,
    );
  }
  const macros = computeMacros({
    energyKcal,
    referenceWeightKg,
    proteinGPerKg,
    minProteinGPerKg: kidney ? KIDNEY_PROTEIN_G_PER_KG : PROTEIN_MIN_G_PER_KG,
    fatFraction: FAT_FRACTION[goal],
  });
  steps.push(...macros.steps);
  warnings.push(...macros.warnings);
  assumptions.push(
    `Grasa: ${fmtPct(FAT_FRACTION[goal])} de las calorías, con un mínimo de ${FAT_MIN_G_PER_KG} g/kg. Carbohidratos: el resto de la energía.`,
  );

  // 6. Fibra y agua.
  const fiberG = roundGrams((FIBER_G_PER_1000_KCAL * energyKcal) / 1000);
  steps.push({ label: "Fibra", formula: `${FIBER_G_PER_1000_KCAL} g × ${energyKcal} kcal ÷ 1000`, value: fiberG, unit: "g" });
  assumptions.push("Fibra: 14 g por cada 1000 kcal (Guías Alimentarias para Estadounidenses).");
  const water = waterTarget({ sex, healthFlags });
  steps.push({ label: "Agua", formula: water.formula, value: water.waterMl, unit: "ml" });
  assumptions.push(...water.notes);
  assumptions.push("Calorías redondeadas a 10 kcal y gramos a 1 g.");

  return {
    method: "mifflin_st_jeor",
    bmr,
    tdee,
    goalAdjustmentKcal,
    expectedWeeklyChangeKg,
    energyKcal,
    proteinG: macros.proteinG,
    fatG: macros.fatG,
    carbsG: macros.carbsG,
    fiberG,
    waterMl: water.waterMl,
    floorApplied,
    capApplied,
    bmi,
    referenceWeightKg,
    risk,
    steps,
    assumptions,
    // Los mensajes del cribado viven en `risk.messages` (la UI debe mostrarlos también).
    warnings,
  };
}
