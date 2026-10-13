/**
 * Meta vigente por fecha a partir del historial de `nutrition_targets` (puro).
 * Vigente = mayor effective_from ≤ fecha; desempate por created_at (igual que getActiveTargets).
 */
export type TargetRowLite = {
  effective_from: string;
  created_at: string;
  energy_kcal: number | null;
  protein_g: number | null;
  water_ml: number | null;
};

export function sortTargets<T extends TargetRowLite>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) =>
    a.effective_from === b.effective_from ? a.created_at.localeCompare(b.created_at) : a.effective_from.localeCompare(b.effective_from),
  );
}

/** `sorted` debe venir de `sortTargets` (ascendente). */
export function targetForDate<T extends TargetRowLite>(sorted: readonly T[], date: string): T | null {
  let found: T | null = null;
  for (const row of sorted) {
    if (row.effective_from <= date) found = row;
    else break;
  }
  return found;
}
