import type { DietPattern, Goal, HealthFlag, NutritionExperience } from "@/lib/nutrition";
import { GOAL_LABELS } from "@/lib/nutrition";

/**
 * Opciones del onboarding. Los códigos de alérgenos son los mismos que usan las recetas
 * (`recipes.allergens`, ver docs/DATA_SOURCES.md) para que el planificador pueda filtrarlos.
 */
export const ALLERGEN_OPTIONS = [
  { code: "gluten", label: "Gluten" },
  { code: "lactosa", label: "Lactosa" },
  { code: "huevo", label: "Huevo" },
  { code: "pescado", label: "Pescado" },
  { code: "mariscos", label: "Mariscos" },
  { code: "mani", label: "Maní" },
  { code: "frutos_secos", label: "Frutos secos" },
  { code: "soya", label: "Soya" },
  { code: "sesamo", label: "Sésamo" },
] as const;

export const INTOLERANCE_OPTIONS = [
  { code: "lactosa", label: "Lactosa" },
  { code: "gluten", label: "Gluten" },
] as const;

export const ALLERGEN_LABELS: Record<string, string> = Object.fromEntries(
  ALLERGEN_OPTIONS.map((o) => [o.code, o.label]),
);

export function allergenLabel(code: string): string {
  return ALLERGEN_LABELS[code] ?? code;
}

export const RESTRICTION_SUGGESTIONS = [
  "Sin cerdo",
  "Sin carnes rojas",
  "Halal",
  "Kosher",
  "Sin azúcar añadida",
  "Sin alcohol",
  "Sin picante",
] as const;

export const GOAL_OPTIONS: ReadonlyArray<{ value: Goal; label: string; description: string }> = [
  { value: "lose_fat", label: GOAL_LABELS.lose_fat, description: "Bajar grasa con un déficit moderado y proteína alta." },
  { value: "gain_muscle", label: GOAL_LABELS.gain_muscle, description: "Un superávit pequeño para acompañar tu entrenamiento." },
  { value: "maintain", label: GOAL_LABELS.maintain, description: "Comer lo que gastas y sostener tu peso." },
  {
    value: "recomposition",
    label: GOAL_LABELS.recomposition,
    description: "Perder algo de grasa y ganar músculo a la vez, con entrenamiento de fuerza.",
  },
  {
    value: "improve_habits",
    label: GOAL_LABELS.improve_habits,
    description: "Comer mejor y con más regularidad, sin enfocarte en el peso.",
  },
];

export const DIET_PATTERN_OPTIONS: ReadonlyArray<{ value: DietPattern; label: string; description: string }> = [
  { value: "omnivore", label: "Como de todo", description: "Sin un patrón especial." },
  { value: "vegetarian", label: "Vegetariana", description: "Sin carnes, aves, pescados ni mariscos." },
  { value: "vegan", label: "Vegana", description: "Además, sin huevo, lácteos ni miel." },
  { value: "pescatarian", label: "Pescetariana", description: "Vegetariana con pescados y mariscos." },
  { value: "keto", label: "Keto", description: "Muy baja en carbohidratos." },
  { value: "low_carb", label: "Baja en carbohidratos", description: "Menos carbohidratos, sin llegar a keto." },
  { value: "high_protein", label: "Alta en proteína", description: "Prioriza comidas con más proteína." },
  { value: "mediterranean", label: "Mediterránea", description: "Verduras, legumbres, pescado y aceite de oliva." },
];

export const DIET_PATTERN_LABELS = Object.fromEntries(DIET_PATTERN_OPTIONS.map((o) => [o.value, o.label])) as Record<
  DietPattern,
  string
>;

export const EXPERIENCE_OPTIONS: ReadonlyArray<{ value: NutritionExperience; label: string; description: string }> = [
  { value: "beginner", label: "Recién empiezo", description: "Es la primera vez que cuido mi alimentación o entreno con un plan." },
  { value: "intermediate", label: "Algo de experiencia", description: "Ya conté calorías o entrené con constancia antes." },
  { value: "advanced", label: "Bastante experiencia", description: "Llevo años entrenando y cuidando lo que como." },
];

export const EXPERIENCE_LABELS = Object.fromEntries(EXPERIENCE_OPTIONS.map((o) => [o.value, o.label])) as Record<
  NutritionExperience,
  string
>;

export const HEALTH_FLAG_OPTIONS: ReadonlyArray<{ value: HealthFlag; label: string; description: string }> = [
  { value: "pregnant", label: "Estoy embarazada", description: "Cuidamos que no haya déficit ni ayuno." },
  { value: "lactating", label: "Estoy dando de lactar", description: "Tu cuerpo necesita energía extra en esta etapa." },
  {
    value: "eating_disorder_history",
    label: "Tengo o tuve un trastorno de la conducta alimentaria",
    description: "Anorexia, bulimia, atracones u otro. No contaremos déficit y te sugeriremos acompañamiento.",
  },
  {
    value: "diabetes_medication",
    label: "Tengo diabetes y uso medicación",
    description: "Insulina u otros medicamentos que pueden requerir ajustes si cambias tu alimentación.",
  },
  { value: "kidney_disease", label: "Tengo una enfermedad renal", description: "La proteína y los líquidos los define tu médico." },
  {
    value: "other_condition",
    label: "Otra condición que afecta mi alimentación",
    description: "Por ejemplo, una enfermedad digestiva o cardiovascular.",
  },
];

export const HEALTH_FLAG_LABELS = Object.fromEntries(HEALTH_FLAG_OPTIONS.map((o) => [o.value, o.label])) as Record<
  HealthFlag,
  string
>;

export const COUNTRY_OPTIONS = [
  { code: "PE", label: "Perú", currency: "PEN" },
  { code: "MX", label: "México", currency: "MXN" },
  { code: "CO", label: "Colombia", currency: "COP" },
  { code: "CL", label: "Chile", currency: "CLP" },
  { code: "AR", label: "Argentina", currency: "ARS" },
  { code: "EC", label: "Ecuador", currency: "USD" },
  { code: "BO", label: "Bolivia", currency: "BOB" },
  { code: "UY", label: "Uruguay", currency: "UYU" },
  { code: "PY", label: "Paraguay", currency: "PYG" },
  { code: "VE", label: "Venezuela", currency: "USD" },
  { code: "CR", label: "Costa Rica", currency: "CRC" },
  { code: "PA", label: "Panamá", currency: "USD" },
  { code: "GT", label: "Guatemala", currency: "GTQ" },
  { code: "DO", label: "República Dominicana", currency: "DOP" },
  { code: "US", label: "Estados Unidos", currency: "USD" },
  { code: "ES", label: "España", currency: "EUR" },
] as const;

export const CURRENCY_OPTIONS = [
  { code: "PEN", label: "Sol peruano (S/)" },
  { code: "USD", label: "Dólar estadounidense (US$)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "MXN", label: "Peso mexicano" },
  { code: "COP", label: "Peso colombiano" },
  { code: "CLP", label: "Peso chileno" },
  { code: "ARS", label: "Peso argentino" },
  { code: "BOB", label: "Boliviano" },
  { code: "UYU", label: "Peso uruguayo" },
  { code: "PYG", label: "Guaraní" },
  { code: "CRC", label: "Colón costarricense" },
  { code: "GTQ", label: "Quetzal" },
  { code: "DOP", label: "Peso dominicano" },
] as const;

export const COUNTRY_CODES = COUNTRY_OPTIONS.map((c) => c.code) as unknown as readonly [string, ...string[]];
export const CURRENCY_CODES = CURRENCY_OPTIONS.map((c) => c.code) as unknown as readonly [string, ...string[]];

export function defaultCurrencyFor(countryCode: string): string {
  return COUNTRY_OPTIONS.find((c) => c.code === countryCode)?.currency ?? "USD";
}

export function countryLabel(code: string): string {
  return COUNTRY_OPTIONS.find((c) => c.code === code)?.label ?? code;
}

/** Zonas horarias frecuentes para el selector del perfil (la del navegador se agrega si falta). */
export const COMMON_TIMEZONES = [
  { value: "America/Lima", label: "Lima (GMT−5)" },
  { value: "America/Bogota", label: "Bogotá (GMT−5)" },
  { value: "America/Guayaquil", label: "Guayaquil (GMT−5)" },
  { value: "America/Panama", label: "Panamá (GMT−5)" },
  { value: "America/Mexico_City", label: "Ciudad de México" },
  { value: "America/Guatemala", label: "Guatemala (GMT−6)" },
  { value: "America/Costa_Rica", label: "Costa Rica (GMT−6)" },
  { value: "America/La_Paz", label: "La Paz (GMT−4)" },
  { value: "America/Caracas", label: "Caracas (GMT−4)" },
  { value: "America/Santo_Domingo", label: "Santo Domingo (GMT−4)" },
  { value: "America/Santiago", label: "Santiago de Chile" },
  { value: "America/Asuncion", label: "Asunción" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (GMT−3)" },
  { value: "America/Montevideo", label: "Montevideo (GMT−3)" },
  { value: "America/New_York", label: "Nueva York" },
  { value: "America/Los_Angeles", label: "Los Ángeles" },
  { value: "Europe/Madrid", label: "Madrid" },
] as const;
