/**
 * Pasos del asistente (una pregunta por pantalla), su visibilidad y su validación. Puro.
 */
import { computeBmi, isNutritionInputError, type Sex } from "@/lib/nutrition";
import { ageGate, goalNeedsRate, preliminaryRisk } from "./plan";
import { answerFieldSchemas, type AnswerKey, type DraftAnswers } from "./schemas";

export const STEP_IDS = [
  "intro",
  "name",
  "birthDate",
  "sex",
  "height",
  "weight",
  "targetWeight",
  "activity",
  "training",
  "goal",
  "rate",
  "diet",
  "allergies",
  "restrictions",
  "location",
  "budget",
  "meals",
  "experience",
  "health",
  "result",
  "consents",
] as const;
export type StepId = (typeof STEP_IDS)[number];

export function isStepId(value: unknown): value is StepId {
  return typeof value === "string" && (STEP_IDS as readonly string[]).includes(value);
}

/** Pasos visibles según las respuestas (el ritmo solo aplica al bajar grasa o ganar músculo). */
export function visibleSteps(answers: DraftAnswers): StepId[] {
  return STEP_IDS.filter((id) => id !== "rate" || goalNeedsRate(answers.goal));
}

/** Campos que responde cada paso. */
export const STEP_FIELDS: Record<StepId, readonly AnswerKey[]> = {
  intro: [],
  name: ["displayName"],
  birthDate: ["birthDate"],
  sex: ["sex"],
  height: ["heightCm"],
  weight: ["weightKg"],
  targetWeight: ["targetWeightKg"],
  activity: ["activityLevel"],
  training: ["trainingDaysPerWeek"],
  goal: ["goal"],
  rate: ["weeklyRateKg"],
  diet: ["dietPattern"],
  allergies: ["allergies", "intolerances"],
  restrictions: ["restrictions", "dislikedFoods"],
  location: ["countryCode", "currencyCode"],
  budget: ["weeklyBudget"],
  meals: ["mealsPerDay"],
  experience: ["experience"],
  health: ["healthFlags"],
  result: [],
  consents: [],
};

const DEFAULT_HEIGHT: Record<Sex, number> = { female: 158, male: 170 };
const DEFAULT_WEIGHT: Record<Sex, number> = { female: 62, male: 75 };

/**
 * Valores iniciales al entrar a un paso (para que los botones −/+ partan de algo razonable).
 * Solo completa lo que falta; nunca pisa una respuesta.
 */
export function defaultsForStep(id: StepId, answers: DraftAnswers): DraftAnswers {
  const sex = answers.sex ?? "female";
  switch (id) {
    case "height":
      return answers.heightCm === undefined ? { heightCm: DEFAULT_HEIGHT[sex] } : {};
    case "weight":
      return answers.weightKg === undefined ? { weightKg: DEFAULT_WEIGHT[sex] } : {};
    case "targetWeight":
      return answers.targetWeightKg === undefined && answers.weightKg !== undefined ? { targetWeightKg: answers.weightKg } : {};
    case "training":
      return answers.trainingDaysPerWeek === undefined ? { trainingDaysPerWeek: 0 } : {};
    case "allergies":
      return {
        ...(answers.allergies === undefined ? { allergies: [] } : {}),
        ...(answers.intolerances === undefined ? { intolerances: [] } : {}),
      };
    case "restrictions":
      return {
        ...(answers.restrictions === undefined ? { restrictions: [] } : {}),
        ...(answers.dislikedFoods === undefined ? { dislikedFoods: [] } : {}),
      };
    case "location":
      return {
        ...(answers.countryCode === undefined ? { countryCode: "PE" } : {}),
        ...(answers.currencyCode === undefined ? { currencyCode: "PEN" } : {}),
      };
    case "health":
      return answers.healthFlags === undefined ? { healthFlags: [] } : {};
    default:
      return {};
  }
}

/** ¿El déficit ya se sabe bloqueado (edad o IMC) antes de preguntar por la salud? */
export function deficitKnownBlocked(answers: DraftAnswers, today: string): boolean {
  const { birthDate, sex, heightCm, weightKg, goal } = answers;
  if (!birthDate || !sex || heightCm == null || weightKg == null || !goal) return false;
  try {
    return preliminaryRisk({ birthDate, sex, heightCm, weightKg, goal }, today).blocks.calorieDeficit;
  } catch (error) {
    if (isNutritionInputError(error)) return false;
    throw error;
  }
}

/** Mensaje de error del paso o null si se puede continuar. */
export function validateStep(id: StepId, answers: DraftAnswers, today: string): string | null {
  if (id === "rate") {
    // Sin ritmo que elegir (otro objetivo o déficit ya bloqueado por edad/IMC) se puede seguir.
    if (!goalNeedsRate(answers.goal)) return null;
    if (answers.goal === "lose_fat" && deficitKnownBlocked(answers, today)) return null;
    const parsed = answers.weeklyRateKg == null ? null : answerFieldSchemas.weeklyRateKg.safeParse(answers.weeklyRateKg);
    return parsed?.success && answers.weeklyRateKg! > 0 ? null : "Elige un ritmo.";
  }
  for (const field of STEP_FIELDS[id]) {
    const value = answers[field];
    if (value === undefined) {
      return MISSING[field];
    }
    const parsed = answerFieldSchemas[field].safeParse(value);
    if (!parsed.success) return parsed.error.issues[0]?.message ?? "Revisa este dato.";
  }
  switch (id) {
    case "birthDate": {
      const { gate } = ageGate(answers.birthDate, today);
      if (gate === "invalid") return "Elige una fecha válida (no puede ser futura).";
      if (gate === "too_young") return "Esta app es para personas de 13 años o más.";
      if (gate === "too_old") return "Revisa la fecha: calculamos metas para personas de hasta 100 años.";
      return null;
    }
    default:
      return null;
  }
}

const MISSING: Record<AnswerKey, string> = {
  displayName: "Escribe tu nombre.",
  birthDate: "Indica tu fecha de nacimiento.",
  sex: "Elige una opción.",
  heightCm: "Indica tu estatura.",
  weightKg: "Indica tu peso.",
  targetWeightKg: "Indica un peso objetivo o elige «No tengo uno».",
  activityLevel: "Elige tu nivel de actividad.",
  trainingDaysPerWeek: "Indica cuántas veces entrenas.",
  goal: "Elige tu objetivo.",
  weeklyRateKg: "Elige un ritmo.",
  dietPattern: "Elige una opción.",
  allergies: "Marca tus alergias o continúa sin marcar.",
  intolerances: "Marca tus intolerancias o continúa sin marcar.",
  restrictions: "Continúa cuando estés listo.",
  dislikedFoods: "Continúa cuando estés listo.",
  countryCode: "Elige tu país.",
  currencyCode: "Elige tu moneda.",
  weeklyBudget: "Indica un monto o elige «Prefiero no indicarlo».",
  mealsPerDay: "Elige cuántas comidas haces al día.",
  experience: "Elige una opción.",
  healthFlags: "Marca lo que aplique o elige «Ninguna».",
};

/** Primer paso visible con datos faltantes o inválidos (para retomar un borrador). */
export function firstIncompleteStep(answers: DraftAnswers, today: string): StepId {
  for (const id of visibleSteps(answers)) {
    if (id === "intro" || id === "result" || id === "consents") continue;
    if (validateStep(id, answers, today)) return id;
  }
  return "result";
}

/** IMC del peso objetivo, si se puede calcular (para un aviso amable bajo 18.5). */
export function targetBmi(answers: DraftAnswers): number | null {
  if (answers.targetWeightKg == null || answers.heightCm == null) return null;
  try {
    return computeBmi(answers.targetWeightKg, answers.heightCm);
  } catch {
    return null;
  }
}
