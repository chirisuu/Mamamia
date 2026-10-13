/**
 * Cliente del contrato `GET /api/foods/search?q=&limit=` (módulo alimentos). Sin datos inventados:
 * cada error HTTP se traduce a un mensaje real para la UI.
 */
import type { FoodSummary } from "@/lib/foods/types";

export interface FoodPortion {
  id: string;
  label: string;
  quantity: number;
  unit: string;
  gramWeight: number;
  isDefault: boolean;
}

export type FoodSearchResult = FoodSummary & { portions: FoodPortion[] };

export class FoodApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function foodApiErrorMessage(status: number): string {
  if (status === 401) return "Tu sesión expiró. Vuelve a ingresar para buscar alimentos.";
  if (status === 429) return "Hiciste muchas búsquedas seguidas. Espera unos segundos y vuelve a intentar.";
  if (status === 503) return "La búsqueda de alimentos no está disponible en este momento.";
  return "No pudimos buscar alimentos. Revisa tu conexión e inténtalo de nuevo.";
}

export async function searchFoodsApi(q: string, signal?: AbortSignal, limit = 20): Promise<FoodSearchResult[]> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  let res: Response;
  try {
    res = await fetch(`/api/foods/search?${params}`, { signal, headers: { accept: "application/json" } });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new FoodApiError(0, foodApiErrorMessage(0));
  }
  if (!res.ok) throw new FoodApiError(res.status, foodApiErrorMessage(res.status));
  const body = (await res.json()) as { foods?: FoodSearchResult[] };
  return (body.foods ?? []).map((f) => ({ ...f, portions: Array.isArray(f.portions) ? f.portions : [] }));
}
