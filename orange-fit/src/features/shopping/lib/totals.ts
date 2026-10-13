import { roundDecimals } from "@/lib/nutrition";

/** Totales de la lista: suma de ítems con precio; parcial si alguno no tiene. Puro. */
export function listTotals(items: ReadonlyArray<{ estimatedPrice: number | null }>, budget: number | null) {
  const priced = items.filter((i) => i.estimatedPrice != null);
  const total = priced.length ? roundDecimals(priced.reduce((s, i) => s + (i.estimatedPrice ?? 0), 0), 2) : null;
  const unpricedCount = items.length - priced.length;
  let overBudget: boolean | null = null;
  if (budget != null) {
    if (total != null && total > budget) overBudget = true;
    else if (unpricedCount === 0 && items.length > 0) overBudget = false;
  }
  return { total, unpricedCount, overBudget };
}
