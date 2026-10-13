import { lookupBarcode } from "@/features/foods/server/barcode-lookup";
import { apiError, apiOk, enforceRateLimit, FOOD_RATE_LIMITS, requireApiUser } from "@/features/foods/server/http";
import { getAppSettings } from "@/lib/config/app-settings";
import { siteUrl } from "@/lib/env";
import { parseBarcode } from "@/lib/foods/barcode";
import { fetchOffProduct, offUserAgent } from "@/lib/foods/open-food-facts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/foods/barcode/{code} (EAN-8/13, UPC-A/E con dígito verificador).
 * 200 { food, origin: 'database' | 'open_food_facts', barcode } · 400 código inválido · 401 sin sesión ·
 * 404 no existe (o está rechazado) · 422 OFF lo tiene sin datos mínimos · 429 límite ·
 * 502 OFF no respondió · 503 falta service role para guardar lo que trajo OFF.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const auth = await requireApiUser("Inicia sesión para buscar productos.");
  if (!auth.ok) return auth.response;

  const { code } = await params;
  const parsed = parseBarcode(code);
  if (!parsed.ok) return apiError(400, "INVALID_BARCODE", parsed.message, { reason: parsed.error });

  const { bucket, max, window } = FOOD_RATE_LIMITS.barcode;
  const limited = await enforceRateLimit(auth.supabase, bucket, max, window);
  if (limited) return limited;

  try {
    const outcome = await lookupBarcode(parsed, {
      supabase: auth.supabase,
      userId: auth.user.id,
      getAdmin: () => {
        try {
          return createSupabaseAdminClient();
        } catch {
          return null;
        }
      },
      fetchOff: async (offCode) => {
        const settings = await getAppSettings();
        return fetchOffProduct(offCode, { userAgent: offUserAgent(settings.supportEmail ?? siteUrl()) });
      },
    });
    if (outcome.kind === "ok") return apiOk(outcome.body);
    return apiError(outcome.status, outcome.code, outcome.message, outcome.product ? { product: outcome.product } : {});
  } catch (error) {
    console.error("barcode_lookup_failed", { reason: error instanceof Error ? error.message : "unknown" });
    return apiError(500, "LOOKUP_FAILED", "No pudimos buscar el producto. Inténtalo de nuevo.");
  }
}
