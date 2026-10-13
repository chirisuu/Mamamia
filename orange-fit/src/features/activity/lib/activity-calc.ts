/**
 * Actividad física (puro): peso a usar, fila a guardar y resúmenes. Las fórmulas MET viven en
 * `src/lib/nutrition/exercise.ts`; aquí se decide QUÉ se guarda: siempre kcal NETAS (sin el gasto
 * en reposo), que es lo que suma al presupuesto del día si la persona lo activa.
 */
import { addDays, startOfWeek } from "@/lib/dates";
import { estimateExercise, intensityFromMet, type ExerciseEstimate, type ExerciseIntensity } from "@/lib/nutrition";

export type WeightSource = "log" | "goal";

/** Peso para estimar: el último pesaje (hasta esa fecha) o, si no hay, el del objetivo. */
export function resolveExerciseWeight(latestLogKg: number | null, goalKg: number | null): { weightKg: number; source: WeightSource } | null {
  if (latestLogKg != null && Number.isFinite(latestLogKg) && latestLogKg >= 20 && latestLogKg <= 400) return { weightKg: latestLogKg, source: "log" };
  if (goalKg != null && Number.isFinite(goalKg) && goalKg >= 20 && goalKg <= 400) return { weightKg: goalKg, source: "goal" };
  return null;
}

export type ExerciseInsert = {
  activity_code: string;
  activity_name: string;
  met: number | null;
  duration_min: number;
  intensity: ExerciseIntensity;
  energy_kcal: number;
  energy_source: "met_estimate" | "manual";
};

/** Del catálogo: kcal netas estimadas con MET × peso × horas (menos el reposo). */
export function catalogExerciseRow(code: string, durationMin: number, weightKg: number): { row: ExerciseInsert; estimate: ExerciseEstimate } {
  const estimate = estimateExercise({ code, weightKg, durationMin });
  return {
    estimate,
    row: {
      activity_code: estimate.code,
      activity_name: estimate.nameEs,
      met: estimate.met,
      duration_min: durationMin,
      intensity: estimate.intensity,
      energy_kcal: Math.max(0, estimate.netKcal),
      energy_source: "met_estimate",
    },
  };
}

/** Manual: la persona copia las calorías de su reloj o app; se guardan tal cual, marcadas como «manual». */
export function manualExerciseRow(input: { name: string; durationMin: number; intensity: ExerciseIntensity; energyKcal: number }): ExerciseInsert {
  return {
    activity_code: "manual",
    activity_name: input.name.trim(),
    met: null,
    duration_min: input.durationMin,
    intensity: input.intensity,
    energy_kcal: Math.round(input.energyKcal * 10) / 10,
    energy_source: "manual",
  };
}

export { intensityFromMet };

export type ExerciseLogLite = { local_date: string; duration_min: number; energy_kcal: number };

export type ActivitySummary = { sessions: number; minutes: number; kcal: number };

export function summarize(logs: readonly ExerciseLogLite[], from: string, to: string): ActivitySummary {
  const inRange = logs.filter((l) => l.local_date >= from && l.local_date <= to);
  return {
    sessions: inRange.length,
    minutes: inRange.reduce((s, l) => s + Number(l.duration_min), 0),
    kcal: Math.round(inRange.reduce((s, l) => s + Number(l.energy_kcal), 0)),
  };
}

/** Semana actual (lunes a hoy) y hoy. */
export function activityOverview(logs: readonly ExerciseLogLite[], today: string): { today: ActivitySummary; week: ActivitySummary; last30: ActivitySummary } {
  return {
    today: summarize(logs, today, today),
    week: summarize(logs, startOfWeek(today), today),
    last30: summarize(logs, addDays(today, -29), today),
  };
}
