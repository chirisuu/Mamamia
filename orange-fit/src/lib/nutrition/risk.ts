/**
 * Cribado de riesgo. No diagnostica: decide qué funciones se bloquean o piden acompañamiento
 * profesional y redacta mensajes prudentes. Las banderas declaradas siempre se respetan,
 * sin importar el sexo registrado para el cálculo.
 */
import { roundDecimals } from "./math";
import type { Goal, HealthFlag, Sex } from "./types";

export type RiskLevel = "ok" | "caution" | "professional";

export type RiskFlag =
  | "minor"
  | "pregnant"
  | "lactating"
  | "underweight"
  | "eating_disorder_history"
  | "diabetes_medication"
  | "kidney_disease"
  | "older_adult"
  | "severe_obesity"
  | "other_condition";

export interface RiskBlocks {
  /** No se calcula déficit: la meta queda en mantenimiento. */
  calorieDeficit: boolean;
  /** No se puede iniciar un ayuno desde la app. */
  fasting: boolean;
  /** Ritmos agresivos limitados (pérdida máx. 0.5 % del peso/semana, superávit máx. 10 %). */
  aggressiveGoals: boolean;
  /** Los planes de comida automáticos requieren revisión profesional. */
  autoPlans: boolean;
}

export interface RiskScreening {
  level: RiskLevel;
  flags: RiskFlag[];
  blocks: RiskBlocks;
  messages: string[];
}

export interface RiskInput {
  ageYears: number;
  sex: Sex;
  /** IMC (se compara redondeado a 1 decimal) o `null` si aún no se conoce. */
  bmi: number | null;
  healthFlags: readonly HealthFlag[];
  goal: Goal;
}

export const OLDER_ADULT_AGE = 65;
export const UNDERWEIGHT_BMI = 18.5;
export const SEVERE_OBESITY_BMI = 40;

interface RuleEffect {
  level: Exclude<RiskLevel, "ok">;
  blocksDeficit: boolean;
  blocksFasting: boolean;
  message: string;
}

const RULES: Record<RiskFlag, RuleEffect> = {
  minor: {
    level: "professional",
    blocksDeficit: true,
    blocksFasting: true,
    message:
      "Como tienes menos de 18 años, no calculamos déficit de calorías ni habilitamos el ayuno: tu cuerpo aún está creciendo. Revisa tu alimentación con tu familia y un profesional de salud.",
  },
  pregnant: {
    level: "professional",
    blocksDeficit: true,
    blocksFasting: true,
    message:
      "Durante el embarazo no aplicamos déficit de calorías ni ayuno. Sigue las indicaciones de tu médico o nutricionista para definir tus metas.",
  },
  lactating: {
    level: "professional",
    blocksDeficit: true,
    blocksFasting: true,
    message:
      "Durante la lactancia no aplicamos déficit de calorías ni ayuno. Tu profesional de salud puede ajustar tus metas si lo necesitas.",
  },
  underweight: {
    level: "professional",
    blocksDeficit: true,
    blocksFasting: true,
    message:
      "Tu IMC está por debajo de 18.5, así que no aplicamos déficit ni ayuno. Te recomendamos conversarlo con un profesional de salud.",
  },
  eating_disorder_history: {
    level: "professional",
    blocksDeficit: true,
    blocksFasting: true,
    message:
      "Como mencionaste antecedentes de un trastorno de la conducta alimentaria, no aplicamos déficit ni ayuno. Te sugerimos usar la app junto con tu profesional de salud.",
  },
  diabetes_medication: {
    level: "professional",
    blocksDeficit: false,
    blocksFasting: true,
    message:
      "Si usas medicación para la diabetes, el ayuno y los cambios bruscos en tu alimentación pueden requerir ajustes. No habilitamos el ayuno; consulta con tu médico antes de hacer cambios.",
  },
  kidney_disease: {
    level: "professional",
    blocksDeficit: false,
    blocksFasting: true,
    message:
      "Con una enfermedad renal, la proteína y los líquidos deben definirse con tu médico o nutricionista. No habilitamos el ayuno y tus metas son solo referenciales.",
  },
  older_adult: {
    level: "caution",
    blocksDeficit: false,
    blocksFasting: false,
    message:
      "Desde los 65 años conviene cuidar la proteína y la fuerza muscular y evitar bajar de peso rápido. Mantendremos un ritmo prudente; consulta con tu profesional de salud si tienes dudas.",
  },
  severe_obesity: {
    level: "caution",
    blocksDeficit: false,
    blocksFasting: false,
    message:
      "Con un IMC de 40 o más, el acompañamiento de un profesional de salud puede ayudarte a avanzar con seguridad. Mantendremos un ritmo prudente.",
  },
  other_condition: {
    level: "caution",
    blocksDeficit: false,
    blocksFasting: false,
    message:
      "Indicaste otra condición de salud. Tus metas son referenciales: confírmalas con tu profesional de salud.",
  },
};

/** Orden estable de las banderas (las de mayor prioridad primero). */
const FLAG_ORDER: RiskFlag[] = [
  "minor",
  "pregnant",
  "lactating",
  "eating_disorder_history",
  "underweight",
  "diabetes_medication",
  "kidney_disease",
  "severe_obesity",
  "older_adult",
  "other_condition",
];

export function screenRisk(input: RiskInput): RiskScreening {
  const found = new Set<RiskFlag>();
  const declared = new Set(input.healthFlags);

  if (Number.isFinite(input.ageYears) && input.ageYears < 18) found.add("minor");
  if (Number.isFinite(input.ageYears) && input.ageYears >= OLDER_ADULT_AGE) found.add("older_adult");
  if (input.bmi !== null && Number.isFinite(input.bmi)) {
    // Mismo redondeo que la clasificación OMS (1 decimal) para que el mensaje y la categoría coincidan.
    const bmi = roundDecimals(input.bmi, 1);
    if (bmi < UNDERWEIGHT_BMI) found.add("underweight");
    if (bmi >= SEVERE_OBESITY_BMI) found.add("severe_obesity");
  }
  for (const flag of ["pregnant", "lactating", "eating_disorder_history", "diabetes_medication", "kidney_disease", "other_condition"] as const) {
    if (declared.has(flag)) found.add(flag);
  }

  const flags = FLAG_ORDER.filter((f) => found.has(f));
  const effects = flags.map((f) => RULES[f]);
  const level: RiskLevel = effects.some((e) => e.level === "professional")
    ? "professional"
    : effects.length > 0
      ? "caution"
      : "ok";

  const blocks: RiskBlocks = {
    calorieDeficit: effects.some((e) => e.blocksDeficit),
    fasting: effects.some((e) => e.blocksFasting),
    aggressiveGoals: level !== "ok",
    autoPlans: level === "professional",
  };

  const messages = effects.map((e) => e.message);
  if (blocks.calorieDeficit && (input.goal === "lose_fat" || input.goal === "recomposition")) {
    messages.push("Por eso tu meta de calorías se calcula en mantenimiento, sin déficit.");
  }
  if (blocks.autoPlans) {
    messages.push("Los planes de comida automáticos quedan sujetos a revisión de un profesional de salud.");
  }

  return { level, flags, blocks, messages };
}

export const RISK_FLAG_LABELS: Record<RiskFlag, string> = {
  minor: "Menor de 18 años",
  pregnant: "Embarazo",
  lactating: "Lactancia",
  underweight: "IMC menor de 18.5",
  eating_disorder_history: "Antecedente de trastorno de la conducta alimentaria",
  diabetes_medication: "Diabetes con medicación",
  kidney_disease: "Enfermedad renal",
  older_adult: "65 años o más",
  severe_obesity: "IMC de 40 o más",
  other_condition: "Otra condición de salud",
};
