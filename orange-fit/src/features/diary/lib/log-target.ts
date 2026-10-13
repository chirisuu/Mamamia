/**
 * Destino de un registro a partir de la URL (`?fecha=YYYY-MM-DD&comida=lunch|custom&nombre=…`).
 * Lo que no sea válido cae a hoy y a la comida según la hora local. Puro y probado.
 */
import { defaultMealForHour, isAllowedDiaryDate, STANDARD_MEALS } from "./meal-time";
import type { MealType } from "../types";

type SearchParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export type LogTarget = { localDate: string; mealType: MealType; customName: string | null; isToday: boolean };

export function resolveLogTarget(params: SearchParams, today: string, hour: number): LogTarget {
  const fecha = first(params.fecha);
  const localDate = fecha && isAllowedDiaryDate(fecha, today) ? fecha : today;
  const comida = first(params.comida);
  const nombre = first(params.nombre)?.trim().slice(0, 60);
  let mealType: MealType = defaultMealForHour(hour);
  let customName: string | null = null;
  if (comida === "custom" && nombre) {
    mealType = "custom";
    customName = nombre;
  } else if (comida && (STANDARD_MEALS as readonly string[]).includes(comida)) {
    mealType = comida as MealType;
  }
  return { localDate, mealType, customName, isToday: localDate === today };
}

/** Query string para mantener el destino al navegar entre métodos de registro. */
export function logTargetQuery(target: Pick<LogTarget, "localDate" | "mealType" | "customName">, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams({ fecha: target.localDate, comida: target.mealType });
  if (target.mealType === "custom" && target.customName) p.set("nombre", target.customName);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p.toString();
}
