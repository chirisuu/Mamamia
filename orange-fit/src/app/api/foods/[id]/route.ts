import { foodIdSchema } from "@/features/foods/schemas";
import { apiError, apiOk, enforceRateLimit, FOOD_RATE_LIMITS, requireApiUser } from "@/features/foods/server/http";
import type { FoodDetailResponse } from "@/lib/foods/api-types";
import { getFoodDetail } from "@/lib/foods/details";

export const dynamic = "force-dynamic";

const NOT_FOUND = "No encontramos ese alimento.";

/**
 * CONTRATO 2. GET /api/foods/{id} → { food: FoodSummary & { portions, micronutrients } } (más
 * descripción, URL de la fuente y licencia). 404 si no existe o no es visible para el usuario.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser("Inicia sesión para ver este alimento.");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  // Un id mal formado no puede existir: 404, igual que uno que no se ve por RLS.
  if (!foodIdSchema.safeParse(id).success) return apiError(404, "NOT_FOUND", NOT_FOUND);

  const { bucket, max, window } = FOOD_RATE_LIMITS.detail;
  const limited = await enforceRateLimit(auth.supabase, bucket, max, window);
  if (limited) return limited;

  try {
    const food = await getFoodDetail(auth.supabase, id, auth.user.id);
    if (!food) return apiError(404, "NOT_FOUND", NOT_FOUND);
    return apiOk<FoodDetailResponse>({ food });
  } catch (error) {
    console.error("food_detail_failed", { reason: error instanceof Error ? error.message : "unknown" });
    return apiError(500, "DETAIL_FAILED", "No pudimos cargar el alimento. Inténtalo de nuevo.");
  }
}
