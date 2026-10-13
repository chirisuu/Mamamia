import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { BarcodeLookupResponse } from "@/lib/foods/api-types";
import type { ParsedBarcode } from "@/lib/foods/barcode";
import { findFoodByBarcodes, getFoodDetail } from "@/lib/foods/details";
import { OffSaveError, saveOffFood } from "@/lib/foods/off-import";
import { mapOffProduct, OffError, type OffFetchResult } from "@/lib/foods/open-food-facts";

type Client = SupabaseClient<Database>;

export type BarcodeLookupDeps = {
  /** Cliente con la sesión del usuario (RLS). */
  supabase: Client;
  userId: string;
  /** Cliente admin (service role) o null si no está configurado. */
  getAdmin: () => Client | null;
  /** Consulta a Open Food Facts (inyectada para poder probarla sin red). */
  fetchOff: (code: string) => Promise<OffFetchResult>;
};

export type BarcodeLookupOutcome =
  | { kind: "ok"; body: BarcodeLookupResponse }
  | {
      kind: "error";
      status: number;
      code: string;
      message: string;
      product?: { name: string | null; brandName: string | null };
    };

type ValidBarcode = Extract<ParsedBarcode, { ok: true }>;

const error = (status: number, code: string, message: string, product?: { name: string | null; brandName: string | null }): BarcodeLookupOutcome => ({
  kind: "error",
  status,
  code,
  message,
  ...(product ? { product } : {}),
});

/** Límite global de consultas a OFF desde este servidor (OFF pide no pasar de ~100/min por IP). */
const OFF_GLOBAL_LIMIT = { bucket: "off_api:global", max: 90, window: 60 };

/**
 * Busca un código en la base (todas sus variantes) y, si no está, en Open Food Facts. Si OFF lo
 * tiene con datos mínimos válidos, lo guarda como alimento público sin verificar y lo devuelve.
 * Nunca inventa un producto: cada falla se informa con su status real.
 */
export async function lookupBarcode(barcode: ValidBarcode, deps: BarcodeLookupDeps): Promise<BarcodeLookupOutcome> {
  const info = { code: barcode.code, format: barcode.format };

  const local = await findFoodByBarcodes(deps.supabase, barcode.lookupCodes, deps.userId);
  if (local.status === "found") return { kind: "ok", body: { food: local.food, origin: "database", barcode: info } };
  if (local.status === "rejected") {
    return error(
      404,
      "REJECTED",
      "Este producto está en nuestra base, pero sus datos se marcaron como incorrectos. Puedes crear tu propio alimento con los valores de la etiqueta.",
    );
  }

  const admin = deps.getAdmin();
  if (admin) {
    const { data: allowed } = await admin.rpc("check_rate_limit", {
      bucket: OFF_GLOBAL_LIMIT.bucket,
      max_hits: OFF_GLOBAL_LIMIT.max,
      window_seconds: OFF_GLOBAL_LIMIT.window,
    });
    if (allowed === false) {
      return error(503, "UPSTREAM_BUSY", "Hay muchas consultas a Open Food Facts en este momento. Inténtalo en un minuto.");
    }
  }

  let off: OffFetchResult;
  try {
    off = await deps.fetchOff(barcode.offCode);
  } catch (e) {
    if (e instanceof OffError) {
      const code = e.code === "OFF_TIMEOUT" ? "UPSTREAM_TIMEOUT" : e.code === "OFF_RATE_LIMITED" ? "UPSTREAM_RATE_LIMITED" : "UPSTREAM_ERROR";
      return error(502, code, `No está en nuestra base y no pudimos consultar Open Food Facts: ${e.message}`);
    }
    throw e;
  }
  if (off.status === "not_found") {
    return error(404, "NOT_FOUND", "No encontramos este producto ni en nuestra base ni en Open Food Facts.");
  }

  const mapped = mapOffProduct(off.product, barcode.offCode);
  if (!mapped.ok) {
    const what =
      mapped.reason === "missing_nutrients"
        ? `le falta ${mapped.missing.join(", ")} por 100 g`
        : mapped.reason === "missing_name"
          ? "no tiene nombre"
          : "sus valores por 100 g no son coherentes";
    return error(422, "INCOMPLETE_DATA", `Open Food Facts tiene este producto, pero ${what}. Puedes crearlo con los datos de la etiqueta.`, {
      name: mapped.name,
      brandName: mapped.brandName,
    });
  }

  if (!admin) {
    return error(
      503,
      "NOT_CONFIGURED",
      `Encontramos «${mapped.food.name}» en Open Food Facts, pero no podemos guardarlo: falta configurar el servidor (SUPABASE_SERVICE_ROLE_KEY).`,
    );
  }

  let saved: { id: string };
  try {
    saved = await saveOffFood(admin, mapped.food);
  } catch (e) {
    if (e instanceof OffSaveError) {
      console.error("off_save_failed", { reason: e.message });
      return error(500, "SAVE_FAILED", "Encontramos el producto, pero no pudimos guardarlo. Inténtalo de nuevo.");
    }
    throw e;
  }

  const food = await getFoodDetail(deps.supabase, saved.id, deps.userId);
  if (!food) return error(500, "SAVE_FAILED", "Encontramos el producto, pero no pudimos leerlo después de guardarlo.");
  return { kind: "ok", body: { food, origin: "open_food_facts", barcode: info } };
}
