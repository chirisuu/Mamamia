"use server";

import type { ActionResult } from "@/lib/action-result";
import { importUsdaFoods } from "@/lib/foods/usda";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  foodSchema,
  foodVerificationSchema,
  idSchema,
  mergeFoodsSchema,
  referencePriceSchema,
  usdaImportSchema,
  type FoodInput,
  type FoodVerificationInput,
  type ReferencePriceInput,
  type UsdaImportInput,
} from "../schemas";
import { runAdminAction } from "../server/action";
import { AdminOpError } from "../server/db";
import { deleteReferencePrice, mergeFoods, runUsdaImport, saveFood, saveReferencePrice, setFoodVerification, type MergeResult } from "../server/foods";

// El catálogo se usa en búsquedas, recetas y el diario de todos: se revalida lo del panel y las recetas.
const REVALIDATE = ["/admin/alimentos", "/admin/alimentos/verificacion", "/admin/alimentos/duplicados"];

export async function saveFoodAction(input: FoodInput): Promise<ActionResult<{ id: string }>> {
  return runAdminAction("editor", foodSchema, input, ({ supabase, user, data }) => saveFood(supabase, user.id, data), REVALIDATE);
}

export async function setFoodVerificationAction(input: FoodVerificationInput): Promise<ActionResult<null>> {
  return runAdminAction(
    "editor",
    foodVerificationSchema,
    input,
    async ({ supabase, user, data }) => {
      await setFoodVerification(supabase, user.id, data);
      return null;
    },
    REVALIDATE,
  );
}

export async function mergeFoodsAction(input: { keepId: string; dropId: string }): Promise<ActionResult<MergeResult>> {
  return runAdminAction("editor", mergeFoodsSchema, input, ({ supabase, data }) => mergeFoods(supabase, data), [...REVALIDATE, "/app/recetas"]);
}

const USDA_MESSAGES: Record<string, string> = {
  USDA_NOT_CONFIGURED: "Importación desde USDA pendiente de configurar: falta FDC_API_KEY en el servidor.",
  USDA_INVALID_INPUT: "Revisa la búsqueda o los FDC ID.",
  USDA_HTTP_ERROR: "USDA respondió con un error. Revisa la clave FDC_API_KEY o inténtalo más tarde.",
  USDA_TIMEOUT: "USDA no respondió a tiempo. Inténtalo de nuevo.",
  USDA_BAD_RESPONSE: "USDA devolvió una respuesta inesperada.",
};

export async function importUsdaAction(
  input: UsdaImportInput,
): Promise<ActionResult<{ inserted: number; updated: number; skipped: number; errors: string[] }>> {
  return runAdminAction(
    "editor",
    usdaImportSchema,
    input,
    async ({ supabase, data }) => {
      // El cliente admin se crea recién aquí: después de requireRole y de validar la entrada.
      let admin: ReturnType<typeof createSupabaseAdminClient>;
      try {
        admin = createSupabaseAdminClient();
      } catch {
        throw new AdminOpError("NOT_CONFIGURED", "Importación pendiente de configurar: falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
      }
      try {
        return await runUsdaImport(supabase, (opts) => importUsdaFoods(admin, opts), data);
      } catch (error) {
        if (error instanceof AdminOpError) throw error;
        const code = (error as { code?: unknown } | null)?.code;
        if (typeof code === "string" && USDA_MESSAGES[code]) throw new AdminOpError(code, USDA_MESSAGES[code]);
        throw error;
      }
    },
    REVALIDATE,
  );
}

export async function saveReferencePriceAction(input: ReferencePriceInput): Promise<ActionResult<{ id: string }>> {
  return runAdminAction("editor", referencePriceSchema, input, ({ supabase, data }) => saveReferencePrice(supabase, data), ["/admin/alimentos/precios"]);
}

export async function deleteReferencePriceAction(input: { id: string }): Promise<ActionResult<null>> {
  return runAdminAction(
    "editor",
    idSchema,
    input,
    async ({ supabase, data }) => {
      await deleteReferencePrice(supabase, data.id);
      return null;
    },
    ["/admin/alimentos/precios"],
  );
}
