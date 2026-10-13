/**
 * Diagnóstico del plan en edición: kcal y proteína por día contra la meta (desviación y ±10 %),
 * huecos vacíos, costo referencial contra el presupuesto proporcional a los días. Mensajes
 * neutros: informan, no regañan. Puro.
 */
import { addDays } from "@/lib/dates";
import { formatShortDate } from "@/lib/format";
import { PLAN_KCAL_TOLERANCE_PCT, roundDecimals } from "@/lib/nutrition";
import { planSlots } from "./plan";
import type { PlanDraft } from "./types";

const PROTEIN_OK_PCT = 90;

export interface DraftDayDiagnostics {
  dayIndex: number;
  date: string;
  label: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  targetKcal: number | null;
  deviationPct: number | null;
  withinTolerance: boolean | null;
  proteinTargetG: number | null;
  proteinPct: number | null;
  emptySlots: string[];
  itemsCount: number;
}

export interface DraftDiagnostics {
  tolerancePct: number;
  days: DraftDayDiagnostics[];
  allWithinTolerance: boolean | null;
  avgKcal: number;
  avgProteinG: number;
  estimatedCost: number | null;
  costIsPartial: boolean;
  budget: number | null;
  overBudget: boolean | null;
  currency: string | null;
  warnings: string[];
}

export function dayLabelFor(startDate: string, dayIndex: number): string {
  return `Día ${dayIndex + 1} · ${formatShortDate(addDays(startDate, dayIndex))}`;
}

export function computeDraftDiagnostics(draft: PlanDraft): DraftDiagnostics {
  const slots = planSlots(draft.params.mealsPerDay);
  const target = draft.params.targetKcal;
  const proteinTarget = draft.params.proteinG && draft.params.proteinG > 0 ? draft.params.proteinG : null;
  const days: DraftDayDiagnostics[] = [];
  for (let dayIndex = 0; dayIndex < draft.days; dayIndex++) {
    const items = draft.items.filter((it) => it.dayIndex === dayIndex);
    const kcal = items.reduce((s, it) => s + it.kcal, 0);
    const protein = items.reduce((s, it) => s + it.proteinG, 0);
    const deviationPct = target ? roundDecimals(((kcal - target) / target) * 100, 1) : null;
    days.push({
      dayIndex,
      date: addDays(draft.startDate, dayIndex),
      label: dayLabelFor(draft.startDate, dayIndex),
      kcal: roundDecimals(kcal, 0),
      proteinG: roundDecimals(protein, 1),
      carbsG: roundDecimals(items.reduce((s, it) => s + it.carbsG, 0), 1),
      fatG: roundDecimals(items.reduce((s, it) => s + it.fatG, 0), 1),
      targetKcal: target,
      deviationPct,
      withinTolerance: deviationPct == null ? null : Math.abs(deviationPct) <= PLAN_KCAL_TOLERANCE_PCT,
      proteinTargetG: proteinTarget,
      proteinPct: proteinTarget ? roundDecimals((protein / proteinTarget) * 100, 1) : null,
      emptySlots: slots.filter((s) => !items.some((it) => it.slotIndex === s.index)).map((s) => s.label),
      itemsCount: items.length,
    });
  }

  const recipeItems = draft.items.filter((it) => it.kind === "recipe");
  const priced = draft.items.filter((it) => it.cost != null);
  const costIsPartial = priced.length < draft.items.length;
  const estimatedCost = priced.length ? roundDecimals(priced.reduce((s, it) => s + (it.cost ?? 0), 0), 2) : null;
  const weekly = draft.params.weeklyBudget;
  const budget = weekly != null ? roundDecimals((weekly * draft.days) / 7, 2) : null;
  let overBudget: boolean | null = null;
  if (budget != null) {
    if (estimatedCost != null && estimatedCost > budget) overBudget = true;
    else if (!costIsPartial && draft.items.length > 0) overBudget = false;
  }

  const warnings: string[] = [];
  const offDays = days.filter((d) => d.withinTolerance === false && d.itemsCount > 0);
  if (offDays.length) {
    warnings.push(
      `${offDays.length === 1 ? "Un día queda" : `${offDays.length} días quedan`} fuera de ±${PLAN_KCAL_TOLERANCE_PCT} % de tu meta de calorías. Puedes ajustar porciones o cambiar recetas.`,
    );
  }
  const lowProtein = days.filter((d) => d.proteinPct != null && d.proteinPct < PROTEIN_OK_PCT && d.itemsCount > 0);
  if (lowProtein.length) {
    warnings.push(`En ${lowProtein.length === 1 ? "un día" : `${lowProtein.length} días`} la proteína queda por debajo del 90 % de tu meta.`);
  }
  const withEmpty = days.filter((d) => d.emptySlots.length > 0);
  if (withEmpty.length) warnings.push(`Hay comidas sin asignar en ${withEmpty.length === 1 ? "un día" : `${withEmpty.length} días`}.`);
  if (target == null) warnings.push("Aún no tienes una meta de calorías: el plan no se puede comparar contra ella.");
  if (budget != null && costIsPartial && draft.items.length > 0) {
    warnings.push(
      recipeItems.length < draft.items.length
        ? "Los alimentos sueltos y algunas recetas no tienen costo referencial: el costo es parcial."
        : "Algunas recetas no tienen costo referencial: el costo es parcial.",
    );
  }
  if (overBudget) warnings.push("El costo referencial supera tu presupuesto para estos días.");

  const filled = days.filter((d) => d.itemsCount > 0);
  return {
    tolerancePct: PLAN_KCAL_TOLERANCE_PCT,
    days,
    allWithinTolerance: target == null ? null : days.every((d) => d.withinTolerance === true),
    avgKcal: filled.length ? roundDecimals(filled.reduce((s, d) => s + d.kcal, 0) / filled.length, 0) : 0,
    avgProteinG: filled.length ? roundDecimals(filled.reduce((s, d) => s + d.proteinG, 0) / filled.length, 1) : 0,
    estimatedCost,
    costIsPartial,
    budget,
    overBudget,
    currency: draft.params.currency,
    warnings,
  };
}
