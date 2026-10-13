/**
 * Actividad física con METs del Compendium of Physical Activities (adultos).
 *
 *   kcal brutas = MET × peso(kg) × horas
 *   kcal netas  = (MET − 1) × peso(kg) × horas
 *
 * 1 MET ≈ 1 kcal/kg/h (gasto en reposo). Las netas restan ese reposo, que ya está dentro
 * del gasto diario de la meta: por eso el presupuesto usa solo las netas.
 *
 * IMPORTANTE: ningún valor del catálogo está verificado contra la tabla oficial (`verified: false`).
 * Ver `docs/NUTRITION_ENGINE.md` para el estado de cada código.
 */
import { NutritionInputError } from "./errors";
import { assertInRange, fmt, normalizeKey, roundDecimals } from "./math";
import { assertWeightKg } from "./bmi";

export type ExerciseCategory = "walking" | "running" | "cycling" | "water" | "gym" | "mind_body" | "sports" | "dance" | "home";

export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  walking: "Caminar y escaleras",
  running: "Correr",
  cycling: "Ciclismo",
  water: "Natación y agua",
  gym: "Gimnasio y fuerza",
  mind_body: "Yoga y pilates",
  sports: "Deportes",
  dance: "Baile y aeróbicos",
  home: "Casa y jardín",
};

export type ExerciseIntensity = "light" | "moderate" | "vigorous";

export const EXERCISE_INTENSITY_LABELS: Record<ExerciseIntensity, string> = {
  light: "Ligera",
  moderate: "Moderada",
  vigorous: "Vigorosa",
};

export interface ExerciseActivity {
  /** Código de 5 dígitos del Compendium (texto: conserva el cero inicial). */
  code: string;
  met: number;
  nameEs: string;
  category: ExerciseCategory;
  /** Descripción original (inglés) a la que corresponde el código. */
  compendiumDescription: string;
  /** false mientras no se coteje con la tabla oficial en pacompendium.com. */
  verified: boolean;
}

export const EXERCISE_CATALOG_SOURCE = {
  name: "2024 Adult Compendium of Physical Activities (Herrmann et al., J Sport Health Sci 2024)",
  url: "https://pacompendium.com",
  verified: false,
  note: "Valores transcritos sin acceso directo a la tabla oficial: pendientes de cotejo código por código antes de producción.",
} as const;

const a = (
  code: string,
  met: number,
  category: ExerciseCategory,
  nameEs: string,
  compendiumDescription: string,
): ExerciseActivity => ({ code, met, category, nameEs, compendiumDescription, verified: false });

export const EXERCISE_CATALOG: readonly ExerciseActivity[] = [
  // Caminar y escaleras
  a("17152", 2.8, "walking", "Caminar lento (3.2–3.9 km/h)", "Walking, 2.0 to 2.4 mph, level, slow pace, firm surface"),
  a("17170", 3.0, "walking", "Caminar a paso de paseo (unos 4 km/h)", "Walking, 2.5 mph, firm, level surface"),
  a("17190", 3.5, "walking", "Caminar a ritmo moderado (4.5–5.5 km/h)", "Walking, 2.8 to 3.4 mph, level, moderate pace, firm surface"),
  a("17200", 4.8, "walking", "Caminar rápido (5.6–6.3 km/h)", "Walking, 3.5 to 3.9 mph, level, brisk, firm surface"),
  a("17220", 5.5, "walking", "Caminar muy rápido (6.4–7.0 km/h)", "Walking, 4.0 to 4.4 mph, level, firm surface, very brisk pace"),
  a("17230", 7.0, "walking", "Caminar a paso muy, muy rápido (7.2–7.9 km/h)", "Walking, 4.5 to 4.9 mph, level, firm surface, very, very brisk"),
  a("17080", 6.0, "walking", "Caminata de montaña (trekking)", "Hiking, cross country"),
  a("17133", 4.5, "walking", "Subir escaleras a ritmo lento", "Stair climbing, slow pace"),
  a("17134", 9.3, "walking", "Subir escaleras a ritmo rápido", "Stair climbing, fast pace"),
  // Correr
  a("12010", 6.0, "running", "Trotar y caminar alternando", "Jog/walk combination"),
  a("12020", 7.5, "running", "Trotar a ritmo propio", "Jogging, general, self-selected pace"),
  a("12030", 8.5, "running", "Correr a 8.0–8.4 km/h", "Running, 5.0 to 5.2 mph (12 min/mile)"),
  a("12050", 9.3, "running", "Correr a 9.7–10.1 km/h", "Running, 6 to 6.3 mph (10 min/mile)"),
  a("12080", 11.8, "running", "Correr a unos 12 km/h", "Running, 7.5 mph (8 min/mile)"),
  // Ciclismo
  a("01010", 4.0, "cycling", "Bicicleta recreativa (menos de 16 km/h)", "Bicycling, <10 mph, leisure, to work or for pleasure"),
  a("01020", 6.8, "cycling", "Bicicleta a 16–19 km/h (esfuerzo ligero)", "Bicycling, 10-11.9 mph, leisure, slow, light effort"),
  a("01030", 8.0, "cycling", "Bicicleta a 19–22 km/h (esfuerzo moderado)", "Bicycling, 12-13.9 mph, leisure, moderate effort"),
  a("01305", 8.8, "cycling", "Bicicleta: intervalos de alta intensidad (HIIT)", "Bicycling, high intensity interval training"),
  a("02014", 6.8, "cycling", "Bicicleta estática (esfuerzo moderado)", "Bicycling, stationary, moderate effort"),
  // Natación y agua
  a("18310", 9.8, "water", "Natación estilo libre, ritmo rápido", "Swimming laps, freestyle, fast, vigorous effort"),
  a("18320", 5.8, "water", "Natación estilo libre, ritmo suave", "Swimming laps, freestyle, slow, moderate or light effort"),
  a("18350", 6.0, "water", "Nadar recreativo (sin series)", "Swimming, leisurely, not lap swimming, general"),
  a("18355", 5.3, "water", "Aquaeróbicos", "Water aerobics, water calisthenics"),
  // Gimnasio y fuerza
  a("02050", 6.0, "gym", "Pesas intensas (powerlifting o culturismo)", "Resistance training, power lifting or body building, vigorous effort"),
  a("02052", 5.0, "gym", "Pesas: sentadillas o peso muerto", "Resistance (weight) training, squats, deadlift, slow or explosive effort"),
  a("02054", 3.5, "gym", "Pesas: rutina de varios ejercicios (8–15 repeticiones)", "Resistance (weight) training, multiple exercises, 8-15 reps at varied resistance"),
  a("02020", 7.5, "gym", "Calistenia intensa (burpees, saltos, dominadas)", "Calisthenics, vigorous effort"),
  a("02032", 6.0, "gym", "Circuito con peso corporal", "Circuit training, body weight"),
  a("02040", 7.0, "gym", "Circuito intenso (incluye kettlebells)", "Circuit training, including kettlebells, vigorous effort"),
  a("02048", 5.0, "gym", "Elíptica (esfuerzo moderado)", "Elliptical trainer, moderate effort"),
  a("02049", 9.0, "gym", "Elíptica (esfuerzo vigoroso)", "Elliptical trainer, vigorous effort"),
  a("02071", 5.0, "gym", "Remo en máquina (moderado, menos de 100 W)", "Rowing, stationary ergometer, <100 watts, moderate effort"),
  a("02072", 7.5, "gym", "Remo en máquina (vigoroso, 100–149 W)", "Rowing, stationary ergometer, 100-149 watts, vigorous effort"),
  // Yoga y pilates
  a("02150", 2.3, "mind_body", "Yoga (hatha)", "Yoga, Hatha"),
  a("02103", 1.8, "mind_body", "Pilates en colchoneta", "Pilates, traditional mat"),
  // Deportes
  a("15610", 7.0, "sports", "Fútbol recreativo (pichanga)", "Soccer, casual, general"),
  a("15605", 9.5, "sports", "Fútbol competitivo", "Soccer, competitive"),
  a("15710", 4.0, "sports", "Vóley recreativo", "Volleyball, general"),
  a("15725", 8.0, "sports", "Vóley de playa", "Volleyball, beach, in sand"),
  a("15055", 6.5, "sports", "Básquet", "Basketball, general"),
  a("15675", 7.3, "sports", "Tenis", "Tennis, general"),
  a("15551", 11.8, "sports", "Saltar soga (ritmo moderado)", "Rope jumping, moderate pace, general"),
  a("15430", 10.3, "sports", "Artes marciales (ritmo moderado)", "Martial arts, different types, moderate pace"),
  // Baile y aeróbicos
  a("03015", 7.3, "dance", "Aeróbicos (clase general)", "Aerobic, general"),
  a("03025", 7.8, "dance", "Baile movido (folclore, discoteca, en línea)", "General dancing (e.g., disco, folk, line dancing)"),
  // Casa y jardín
  a("05010", 3.3, "home", "Barrer o limpiar pisos", "Cleaning, sweeping carpet or floors, general"),
  a("05021", 3.5, "home", "Trapear", "Cleaning, mopping, standing, moderate effort"),
  a("08245", 3.8, "home", "Jardinería", "Gardening, general, moderate effort"),
];

const BY_CODE = new Map(EXERCISE_CATALOG.map((act) => [act.code, act]));

export function findActivity(code: string): ExerciseActivity | null {
  return BY_CODE.get(code.trim()) ?? null;
}

/** Búsqueda sin tildes por nombre o código. Consulta vacía = todo (o la categoría). */
export function searchActivities(query: string, options: { category?: ExerciseCategory } = {}): ExerciseActivity[] {
  const q = normalizeKey(query);
  return EXERCISE_CATALOG.filter(
    (act) =>
      (!options.category || act.category === options.category) &&
      (q === "" || normalizeKey(act.nameEs).includes(q) || act.code.startsWith(q)),
  );
}

/** Clasificación habitual: ligera < 3 MET, moderada 3–5.9, vigorosa ≥ 6. */
export function intensityFromMet(met: number): ExerciseIntensity {
  if (met < 3) return "light";
  if (met < 6) return "moderate";
  return "vigorous";
}

export const MET_LIMITS = { min: 1, max: 25 } as const;
export const DURATION_LIMITS_MIN = { min: 1, max: 600 } as const;

function validate(met: number, weightKg: number, durationMin: number): void {
  assertInRange(met, MET_LIMITS.min, MET_LIMITS.max, "met", "El MET");
  assertWeightKg(weightKg);
  assertInRange(durationMin, DURATION_LIMITS_MIN.min, DURATION_LIMITS_MIN.max, "durationMin", "La duración", "min");
}

/** kcal brutas (incluyen el gasto en reposo). Sin redondear. */
export function grossExerciseKcal(met: number, weightKg: number, durationMin: number): number {
  validate(met, weightKg, durationMin);
  return met * weightKg * (durationMin / 60);
}

/** kcal netas (sin el gasto en reposo). Sin redondear. */
export function netExerciseKcal(met: number, weightKg: number, durationMin: number): number {
  validate(met, weightKg, durationMin);
  return (met - 1) * weightKg * (durationMin / 60);
}

export interface ExerciseEstimate {
  code: string;
  nameEs: string;
  met: number;
  intensity: ExerciseIntensity;
  durationMin: number;
  /** kcal brutas, 1 decimal. */
  grossKcal: number;
  /** kcal netas, 1 decimal: es lo que suma al presupuesto si el usuario lo activa. */
  netKcal: number;
  grossFormula: string;
  netFormula: string;
  explanation: string;
  verified: boolean;
}

/**
 * Estima el gasto de una sesión. Con `code` usa el catálogo; con `met` (actividad propia) usa ese valor.
 */
export function estimateExercise(input: {
  code?: string;
  met?: number;
  nameEs?: string;
  weightKg: number;
  durationMin: number;
}): ExerciseEstimate {
  let met: number;
  let code: string;
  let nameEs: string;
  let verified = false;
  if (input.code !== undefined) {
    const act = findActivity(input.code);
    if (!act) throw new NutritionInputError("invalid_value", "code", "No encontramos esa actividad en el catálogo.");
    met = act.met;
    code = act.code;
    nameEs = act.nameEs;
    verified = act.verified;
  } else if (input.met !== undefined) {
    met = input.met;
    code = "custom";
    nameEs = input.nameEs?.trim() || "Actividad personalizada";
  } else {
    throw new NutritionInputError("invalid_value", "code", "Elige una actividad o indica su MET.");
  }
  const gross = grossExerciseKcal(met, input.weightKg, input.durationMin);
  const net = netExerciseKcal(met, input.weightKg, input.durationMin);
  const h = `${fmt(input.durationMin, 0)} min ÷ 60`;
  return {
    code,
    nameEs,
    met,
    intensity: intensityFromMet(met),
    durationMin: input.durationMin,
    grossKcal: roundDecimals(gross, 1),
    netKcal: roundDecimals(net, 1),
    grossFormula: `${fmt(met, 1)} MET × ${fmt(input.weightKg, 1)} kg × ${h}`,
    netFormula: `(${fmt(met, 1)} − 1) MET × ${fmt(input.weightKg, 1)} kg × ${h}`,
    explanation:
      "Usamos las calorías netas (restando lo que gastarías en reposo), porque el reposo ya está incluido en tu gasto diario. Es una estimación: el gasto real varía según tu técnica, el terreno y tu condición física.",
    verified,
  };
}
