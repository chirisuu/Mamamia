import { foodSearchQuerySchema } from "@/features/foods/schemas";
import { apiError, apiOk, enforceRateLimit, FOOD_RATE_LIMITS, requireApiUser } from "@/features/foods/server/http";
import type { FoodSearchResponse } from "@/lib/foods/api-types";
import { withPortions } from "@/lib/foods/details";
import { searchFoods } from "@/lib/foods/search";

export const dynamic = "force-dynamic";

/**
 * CONTRATO 1. GET /api/foods/search?q=texto&limit=20 → { foods: FoodSummary & { portions } }.
 * Públicos + propios (RLS), sin tildes y tolerante a errores de tipeo (`search_foods`).
 */
export async function GET(request: Request) {
  const auth = await requireApiUser("Inicia sesión para buscar alimentos.");
  if (!auth.ok) return auth.response;

  const params = new URL(request.url).searchParams;
  const parsed = foodSearchQuerySchema.safeParse({
    q: params.get("q") ?? undefined,
    limit: params.get("limit") ?? undefined,
  });
  if (!parsed.success) return apiError(400, "VALIDATION", parsed.error.issues[0]?.message ?? "Consulta inválida.");
  // Con una sola letra no se busca (ni se gasta cupo): la UI pide al menos 2.
  if (parsed.data.q.length < 2) return apiOk<FoodSearchResponse>({ foods: [] });

  const { bucket, max, window } = FOOD_RATE_LIMITS.search;
  const limited = await enforceRateLimit(auth.supabase, bucket, max, window);
  if (limited) return limited;

  try {
    const foods = await searchFoods(auth.supabase, parsed.data.q, parsed.data.limit);
    return apiOk<FoodSearchResponse>({ foods: await withPortions(auth.supabase, foods) });
  } catch (error) {
    console.error("foods_search_failed", { reason: error instanceof Error ? error.message : "unknown" });
    return apiError(500, "SEARCH_FAILED", "No pudimos buscar alimentos. Inténtalo de nuevo.");
  }
}
