import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { serverEnv } from "@/lib/server-env";
import { importUsdaFoodsWithKey, type UsdaImportResult } from "./usda-core";

export {
  UsdaError,
  USDA_LICENSE,
  mapUsdaFood,
  type UsdaErrorCode,
  type UsdaImportResult,
  type UsdaMappedFood,
} from "./usda-core";

/**
 * CONTRATO 3. Importa alimentos de USDA FoodData Central al catálogo público (source 'usda',
 * 'verified', licencia de dominio público), con upsert por `source_ref = 'fdc:{fdcId}'`.
 * Requiere el cliente admin (service role) ya autorizado por quien llama. Sin `FDC_API_KEY`
 * lanza un `UsdaError` con `code = 'USDA_NOT_CONFIGURED'`.
 */
export async function importUsdaFoods(
  admin: SupabaseClient<Database>,
  opts: { query?: string; fdcIds?: number[]; limit?: number },
): Promise<UsdaImportResult> {
  return importUsdaFoodsWithKey(admin, opts, { apiKey: serverEnv().FDC_API_KEY });
}
