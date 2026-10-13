/**
 * Desglose del presupuesto calórico del día para Inicio, sobre `dailyBudget` del motor:
 * meta base + ejercicio (solo si el perfil lo activa) + ajustes − consumido. Así el usuario ve
 * de dónde sale cada número y el ejercicio nunca se cuenta dos veces.
 */
import { dailyBudget, type DailyBudget } from "@/lib/nutrition";

export type BudgetRow = {
  key: "base" | "exercise" | "adjustments" | "consumed" | "remaining";
  label: string;
  /** kcal con signo (+ suma al presupuesto, − resta). */
  value: number;
  sign: "+" | "−" | "=";
  note?: string;
};

export type BudgetBreakdown = {
  budget: DailyBudget;
  rows: BudgetRow[];
  /** ¿El ejercicio del día suma al presupuesto? (perfil count_exercise_calories) */
  countExercise: boolean;
};

export function buildBudgetBreakdown(input: {
  targetKcal: number;
  /** Suma de exercise_logs.energy_kcal del día (kcal NETAS, ver exercise.ts). */
  exerciseKcal: number;
  countExercise: boolean;
  adjustmentsKcal?: number;
  consumedKcal: number;
}): BudgetBreakdown {
  const budget = dailyBudget({
    targetKcal: input.targetKcal,
    exerciseKcal: Math.max(0, input.exerciseKcal),
    countExercise: input.countExercise,
    manualAdjustmentKcal: input.adjustmentsKcal ?? 0,
    consumedKcal: Math.max(0, input.consumedKcal),
  });
  const rows: BudgetRow[] = [{ key: "base", label: "Meta base", value: budget.base, sign: "=" }];
  if (input.countExercise) {
    rows.push({
      key: "exercise",
      label: "Ejercicio",
      value: budget.exercise,
      sign: "+",
      note: budget.exercise > 0 ? "kcal netas registradas hoy" : "Aún no registras ejercicio hoy",
    });
  }
  rows.push({
    key: "adjustments",
    label: "Ajustes",
    value: budget.adjustments,
    sign: budget.adjustments < 0 ? "−" : "+",
    note: budget.adjustments === 0 ? "Sin ajustes para hoy" : undefined,
  });
  rows.push({ key: "consumed", label: "Consumido", value: budget.consumed ?? 0, sign: "−" });
  rows.push({ key: "remaining", label: budget.remaining >= 0 ? "Restante" : "Sobre tu presupuesto", value: Math.abs(budget.remaining), sign: "=" });
  return { budget, rows, countExercise: input.countExercise };
}
