/**
 * Presupuesto calórico del día: meta base + ejercicio (solo si el usuario lo activa) + ajustes.
 *
 * El factor de actividad de la meta ya cuenta el ejercicio habitual; sumar además las calorías
 * de cada sesión lo contaría dos veces. Por eso el ejercicio suma solo con `countExercise`
 * (perfil `count_exercise_calories`, falso por defecto) y usando kcal NETAS (ver exercise.ts).
 */
import { assertFiniteNumber, assertNonNegative, assertPositive, roundTo } from "./math";

export interface DailyBudgetInput {
  targetKcal: number;
  /** kcal netas de ejercicio registradas hoy. */
  exerciseKcal?: number;
  countExercise: boolean;
  /** Ajuste manual del día (positivo o negativo). */
  manualAdjustmentKcal?: number;
  /** kcal ya consumidas hoy. */
  consumedKcal?: number | null;
  /** Piso opcional: el total nunca baja de aquí (p. ej. el mínimo seguro de la meta). */
  minimumKcal?: number | null;
}

export interface DailyBudget {
  base: number;
  exercise: number;
  /** kcal de ejercicio registradas (sumen o no). */
  exerciseLogged: number;
  adjustments: number;
  total: number;
  minimumApplied: boolean;
  consumed?: number;
  /** total − consumido. Puede ser negativo: es información, no un castigo. */
  remaining: number;
  explanation: string[];
}

export function dailyBudget(input: DailyBudgetInput): DailyBudget {
  const base = roundTo(assertPositive(input.targetKcal, "targetKcal", "La meta de calorías"));
  const exerciseLogged = roundTo(assertNonNegative(input.exerciseKcal ?? 0, "exerciseKcal", "Las calorías de ejercicio"));
  const manual = input.manualAdjustmentKcal ?? 0;
  assertFiniteNumber(manual, "manualAdjustmentKcal", "El ajuste manual");
  const adjustments = roundTo(manual);
  const exercise = input.countExercise ? exerciseLogged : 0;

  const explanation = [`Base: tu meta diaria de ${base} kcal.`];
  if (input.countExercise) {
    explanation.push(
      exercise > 0
        ? `Ejercicio: +${exercise} kcal netas, porque activaste sumar el ejercicio. Si tu nivel de actividad ya lo considera, podrías estar contándolo dos veces.`
        : "Ejercicio: activaste sumarlo, pero hoy no hay ejercicio registrado.",
    );
  } else if (exerciseLogged > 0) {
    explanation.push(
      `Ejercicio: registraste ${exerciseLogged} kcal, pero no se suman porque tu nivel de actividad ya incluye tu ejercicio habitual (así no se cuenta dos veces). Puedes activarlo en tu perfil.`,
    );
  }
  if (adjustments !== 0) {
    explanation.push(`Ajustes: ${adjustments > 0 ? "+" : "−"}${Math.abs(adjustments)} kcal.`);
  }

  let total = base + exercise + adjustments;
  let minimumApplied = false;
  if (input.minimumKcal != null) {
    const minimum = roundTo(assertNonNegative(input.minimumKcal, "minimumKcal", "El mínimo de calorías"));
    if (total < minimum) {
      total = minimum;
      minimumApplied = true;
      explanation.push(`El total no baja de ${minimum} kcal, tu mínimo seguro.`);
    }
  }

  const result: DailyBudget = {
    base,
    exercise,
    exerciseLogged,
    adjustments,
    total,
    minimumApplied,
    remaining: total,
    explanation,
  };
  if (input.consumedKcal != null) {
    const consumed = roundTo(assertNonNegative(input.consumedKcal, "consumedKcal", "Las calorías consumidas"));
    result.consumed = consumed;
    result.remaining = total - consumed;
  }
  return result;
}
