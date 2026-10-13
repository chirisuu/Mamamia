import "server-only";
import type { z } from "zod";
import type { Tables, TablesInsert } from "@/lib/db/database.types";
import { normalizeText } from "@/lib/foods/dedup";
import type { FoodData, foodVerificationSchema, mergeFoodsSchema, referencePriceSchema, usdaImportSchema } from "../schemas";
import { AdminOpError, dbError, logAdminAction, rpcUntyped, type Db } from "./db";

export const FOODS_PER_PAGE = 30;

type FoodRow = Tables<"foods">;
type Source = FoodRow["source"];
type Verification = FoodRow["verification_status"];

export type AdminFoodListItem = Pick<
  FoodRow,
  "id" | "name" | "source" | "verification_status" | "is_public" | "energy_kcal" | "protein_g" | "carbs_g" | "fat_g" | "barcode" | "updated_at" | "source_ref"
> & { brandName: string | null };

export type FoodFilters = {
  q?: string | null;
  source?: Source | null;
  status?: Verification | null;
  visibility?: "public" | "hidden" | null;
  page: number;
};

const LIST_COLUMNS = "id, name, source, verification_status, is_public, energy_kcal, protein_g, carbs_g, fat_g, barcode, updated_at, source_ref, brands(name)";

type ListRow = Omit<AdminFoodListItem, "brandName"> & { brands: { name: string } | null };
const toListItem = ({ brands, ...row }: ListRow): AdminFoodListItem => ({ ...row, brandName: brands?.name ?? null });

/**
 * Catálogo del staff: alimentos públicos y los retirados del catálogo (sin dueño). Los alimentos
 * propios de cada usuario (privados) no se listan: son datos de esa persona.
 */
export async function listFoods(supabase: Db, filters: FoodFilters): Promise<{ rows: AdminFoodListItem[]; total: number }> {
  const from = (filters.page - 1) * FOODS_PER_PAGE;
  let query = supabase
    .from("foods")
    .select(LIST_COLUMNS, { count: "exact" })
    .or("is_public.eq.true,created_by.is.null")
    .order("name_normalized")
    .range(from, from + FOODS_PER_PAGE - 1);
  const q = filters.q?.trim();
  if (q) {
    const digits = q.replace(/[\s-]/g, "");
    if (/^[0-9]{6,14}$/.test(digits)) query = query.eq("barcode", digits);
    else {
      const term = normalizeText(q).replace(/[%_,()*]/g, " ").trim();
      if (term) query = query.ilike("name_normalized", `%${term}%`);
    }
  }
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.status) query = query.eq("verification_status", filters.status);
  if (filters.visibility === "public") query = query.eq("is_public", true);
  if (filters.visibility === "hidden") query = query.eq("is_public", false);
  const { data, count, error } = await query;
  if (error) throw dbError(error, "No se pudo leer el catálogo.");
  return { rows: ((data ?? []) as unknown as ListRow[]).map(toListItem), total: count ?? 0 };
}

export async function listVerificationQueue(supabase: Db, page: number): Promise<{ rows: AdminFoodListItem[]; total: number }> {
  const from = (page - 1) * FOODS_PER_PAGE;
  const { data, count, error } = await supabase
    .from("foods")
    .select(LIST_COLUMNS, { count: "exact" })
    .eq("is_public", true)
    .eq("verification_status", "unverified")
    .order("created_at", { ascending: true })
    .range(from, from + FOODS_PER_PAGE - 1);
  if (error) throw dbError(error, "No se pudo leer la cola de verificación.");
  return { rows: ((data ?? []) as unknown as ListRow[]).map(toListItem), total: count ?? 0 };
}

export type AdminFoodDetail = FoodRow & {
  brandName: string | null;
  portions: Tables<"food_portions">[];
  usedInPublishedRecipes: number;
};

export async function getFoodForEdit(supabase: Db, id: string): Promise<AdminFoodDetail | null> {
  const { data, error } = await supabase.from("foods").select("*, brands(name)").eq("id", id).maybeSingle();
  if (error) throw dbError(error, "No se pudo leer el alimento.");
  if (!data) return null;
  const { brands, ...food } = data as FoodRow & { brands: { name: string } | null };
  // Un alimento propio de un usuario no se edita desde el panel.
  if (!food.is_public && food.created_by) return null;
  const [{ data: portions, error: pErr }, used] = await Promise.all([
    supabase.from("food_portions").select("*").eq("food_id", id).order("is_default", { ascending: false }).order("gram_weight"),
    countPublishedRecipesUsing(supabase, id),
  ]);
  if (pErr) throw dbError(pErr, "No se pudieron leer las porciones.");
  return { ...food, brandName: brands?.name ?? null, portions: portions ?? [], usedInPublishedRecipes: used };
}

async function countPublishedRecipesUsing(supabase: Db, foodId: string): Promise<number> {
  const { data, error } = await supabase.from("recipe_ingredients").select("recipe_id, recipes!inner(status, is_public)").eq("food_id", foodId).eq("recipes.status", "published").eq("recipes.is_public", true);
  if (error) throw dbError(error, "No se pudo revisar el uso del alimento.");
  return new Set((data ?? []).map((r) => r.recipe_id)).size;
}

/** Busca la marca por nombre normalizado (como el trigger de la base) o la crea. */
async function resolveBrand(supabase: Db, brandName: string | null): Promise<string | null> {
  if (!brandName) return null;
  const { data: normalized, error: nErr } = await supabase.rpc("normalize_text", { value: brandName });
  if (nErr) throw dbError(nErr, "No se pudo procesar la marca.");
  const key = typeof normalized === "string" ? normalized : normalizeText(brandName);
  const { data: found, error } = await supabase.from("brands").select("id").eq("name_normalized", key).limit(1);
  if (error) throw dbError(error, "No se pudo leer la marca.");
  if (found?.[0]) return found[0].id;
  const { data: created, error: cErr } = await supabase.from("brands").insert({ name: brandName }).select("id").single();
  if (cErr) {
    if (cErr.code === "23505") {
      const { data: again } = await supabase.from("brands").select("id").eq("name_normalized", key).limit(1);
      if (again?.[0]) return again[0].id;
    }
    throw dbError(cErr, "No se pudo crear la marca.");
  }
  return created.id;
}

/** Crea o actualiza un alimento del catálogo (staff) con sus porciones. */
export async function saveFood(supabase: Db, actorId: string, data: FoodData): Promise<{ id: string }> {
  let previous: Pick<FoodRow, "id" | "is_public" | "created_by" | "verification_status" | "verified_by" | "verified_at"> | null = null;
  if (data.id) {
    const { data: row, error } = await supabase.from("foods").select("id, is_public, created_by, verification_status, verified_by, verified_at").eq("id", data.id).maybeSingle();
    if (error) throw dbError(error, "No se pudo leer el alimento.");
    if (!row || (!row.is_public && row.created_by)) throw new AdminOpError("NOT_FOUND", "El alimento no existe o es propio de un usuario.");
    previous = row;
    if (row.is_public && !data.isPublic) {
      const used = await countPublishedRecipesUsing(supabase, data.id);
      if (used > 0) {
        throw new AdminOpError(
          "IN_USE",
          `Lo usan ${used} receta(s) publicada(s). Fusiónalo con otro alimento o cambia esas recetas antes de despublicarlo.`,
        );
      }
    }
  }

  const brandId = await resolveBrand(supabase, data.brandName);
  const reviewed = data.verificationStatus !== "unverified";
  const statusChanged = !previous || previous.verification_status !== data.verificationStatus;
  const row: TablesInsert<"foods"> = {
    name: data.name,
    brand_id: brandId,
    description: data.description,
    food_type: data.foodType,
    barcode: data.barcode,
    country_codes: data.countryCodes,
    energy_kcal: data.energyKcal,
    protein_g: data.proteinG,
    carbs_g: data.carbsG,
    fat_g: data.fatG,
    fiber_g: data.fiberG,
    sugar_g: data.sugarG,
    saturated_fat_g: data.saturatedFatG,
    sodium_mg: data.sodiumMg,
    density_g_per_ml: data.densityGPerMl,
    source: data.source,
    source_ref: data.sourceRef,
    source_url: data.sourceUrl,
    license: data.license,
    verification_status: data.verificationStatus,
    verified_by: reviewed ? (statusChanged ? actorId : (previous?.verified_by ?? actorId)) : null,
    verified_at: reviewed ? (statusChanged ? new Date().toISOString() : (previous?.verified_at ?? new Date().toISOString())) : null,
    is_public: data.isPublic,
  };

  // Los alimentos del catálogo no tienen dueño: si se despublican, no pasan a ser "propios" de nadie.
  const query = data.id
    ? supabase.from("foods").update(row).eq("id", data.id).select("id")
    : supabase.from("foods").insert({ ...row, created_by: null }).select("id");
  const { data: saved, error } = await query;
  if (error) {
    if (error.code === "23505") throw new AdminOpError("CONFLICT", "Ya hay un alimento público con ese código de barras.");
    throw dbError(error, "No se pudo guardar el alimento.");
  }
  const id = saved?.[0]?.id;
  if (!id) throw new AdminOpError("FORBIDDEN", "No tienes permiso para editar el catálogo.");

  await savePortions(supabase, id, data.portions);
  await logAdminAction(supabase, {
    action: data.id ? "food.update" : "food.create",
    targetTable: "foods",
    targetId: id,
    metadata: { source: data.source, verification_status: data.verificationStatus, is_public: data.isPublic, portions: data.portions.length },
  });
  return { id };
}

async function savePortions(supabase: Db, foodId: string, portions: FoodData["portions"]): Promise<void> {
  const { data: existing, error } = await supabase.from("food_portions").select("id").eq("food_id", foodId);
  if (error) throw dbError(error, "No se pudieron leer las porciones.");
  const keep = new Set(portions.flatMap((p) => (p.id ? [p.id] : [])));
  const toDelete = (existing ?? []).map((p) => p.id).filter((pid) => !keep.has(pid));
  // Primero se quita la marca de predeterminada (índice único parcial por alimento).
  const { error: clearError } = await supabase.from("food_portions").update({ is_default: false }).eq("food_id", foodId).eq("is_default", true);
  if (clearError) throw dbError(clearError, "No se pudieron guardar las porciones.");
  if (toDelete.length) {
    const { error: delError } = await supabase.from("food_portions").delete().in("id", toDelete).eq("food_id", foodId);
    if (delError) throw dbError(delError, "No se pudieron quitar porciones.");
  }
  const existingIds = new Set((existing ?? []).map((p) => p.id));
  for (const p of portions) {
    const values = { label: p.label, quantity: p.quantity, unit: p.unit, gram_weight: p.gramWeight, is_default: p.isDefault };
    if (p.id && existingIds.has(p.id)) {
      const { error: upError } = await supabase.from("food_portions").update(values).eq("id", p.id).eq("food_id", foodId);
      if (upError) throw dbError(upError, "No se pudo guardar una porción.");
    } else {
      const { error: insError } = await supabase.from("food_portions").insert({ ...values, food_id: foodId });
      if (insError) throw dbError(insError, "No se pudo guardar una porción.");
    }
  }
}

export async function setFoodVerification(supabase: Db, actorId: string, data: z.output<typeof foodVerificationSchema>): Promise<void> {
  const { data: saved, error } = await supabase
    .from("foods")
    .update({ verification_status: data.status, verified_by: actorId, verified_at: new Date().toISOString() })
    .eq("id", data.foodId)
    .eq("is_public", true)
    .select("id");
  if (error) throw dbError(error, "No se pudo cambiar la verificación.");
  if (!saved?.length) throw new AdminOpError("NOT_FOUND", "El alimento no existe o no es del catálogo público.");
  await logAdminAction(supabase, { action: "food.verify", targetTable: "foods", targetId: data.foodId, metadata: { status: data.status } });
}

export type MergeResult = {
  recipe_ingredients: number;
  favorites: number;
  favorites_removed: number;
  template_items: number;
  plan_items: number;
  shopping_items: number;
  reference_prices: number;
  barcode_moved: boolean;
};

export async function mergeFoods(supabase: Db, data: z.output<typeof mergeFoodsSchema>): Promise<MergeResult> {
  const { data: result, error } = await rpcUntyped<MergeResult>(supabase, "admin_merge_foods", { keep_id: data.keepId, drop_id: data.dropId });
  if (error) throw dbError(error, "No se pudieron fusionar los alimentos.");
  if (!result) throw new AdminOpError("DB_ERROR", "La fusión no devolvió resultado.");
  await logAdminAction(supabase, {
    action: "food.merge",
    targetTable: "foods",
    targetId: data.keepId,
    metadata: {
      merged_id: data.dropId,
      recipe_ingredients: result.recipe_ingredients,
      favorites: result.favorites,
      plan_items: result.plan_items,
      reference_prices: result.reference_prices,
    },
  });
  return result;
}

/* -------------------------------------------------------------------------- */
/* USDA                                                                         */
/* -------------------------------------------------------------------------- */

export type UsdaRunner = (opts: { query?: string; fdcIds?: number[]; limit?: number }) => Promise<{ inserted: number; updated: number; skipped: number; errors: string[] }>;

/**
 * Importa desde USDA con el runner (importUsdaFoods con el cliente admin) y deja constancia en la
 * auditoría con la sesión del staff. Los errores de configuración los traduce quien llama.
 */
export async function runUsdaImport(supabase: Db, run: UsdaRunner, data: z.output<typeof usdaImportSchema>) {
  const result = await run(data.mode === "ids" ? { fdcIds: data.fdcIds, limit: data.fdcIds.length } : { query: data.query ?? undefined, limit: data.limit });
  await logAdminAction(supabase, {
    action: "food.usda_import",
    targetTable: "foods",
    targetId: null,
    metadata: {
      mode: data.mode,
      query: data.mode === "query" ? data.query : undefined,
      fdc_ids: data.mode === "ids" ? data.fdcIds.length : undefined,
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors.length,
    },
  });
  return { inserted: result.inserted, updated: result.updated, skipped: result.skipped, errors: result.errors.slice(0, 20) };
}

/* -------------------------------------------------------------------------- */
/* Precios referenciales                                                        */
/* -------------------------------------------------------------------------- */

export const PRICES_PER_PAGE = 30;

export type ReferencePriceRow = Tables<"reference_prices"> & { foodName: string | null };

export async function listReferencePrices(
  supabase: Db,
  opts: { q?: string | null; currency?: string | null; page: number },
): Promise<{ rows: ReferencePriceRow[]; total: number }> {
  const from = (opts.page - 1) * PRICES_PER_PAGE;
  let query = supabase
    .from("reference_prices")
    .select("*, foods(name)", { count: "exact" })
    .order("item_name")
    .order("observed_on", { ascending: false })
    .range(from, from + PRICES_PER_PAGE - 1);
  const term = opts.q?.replace(/[%_,()*]/g, " ").trim();
  if (term) query = query.ilike("item_name", `%${term}%`);
  if (opts.currency && /^[A-Z]{3}$/.test(opts.currency)) query = query.eq("currency_code", opts.currency);
  const { data, count, error } = await query;
  if (error) throw dbError(error, "No se pudieron leer los precios.");
  const rows = ((data ?? []) as Array<Tables<"reference_prices"> & { foods: { name: string } | null }>).map(({ foods, ...r }) => ({ ...r, foodName: foods?.name ?? null }));
  return { rows, total: count ?? 0 };
}

export async function saveReferencePrice(supabase: Db, data: z.output<typeof referencePriceSchema>): Promise<{ id: string }> {
  if (data.foodId) {
    const { data: food, error } = await supabase.from("foods").select("id, is_public").eq("id", data.foodId).maybeSingle();
    if (error) throw dbError(error, "No se pudo leer el alimento.");
    if (!food?.is_public) throw new AdminOpError("INVALID", "Vincula solo alimentos del catálogo público.");
  }
  const row = {
    food_id: data.foodId,
    item_name: data.itemName,
    country_code: data.countryCode,
    currency_code: data.currencyCode,
    price: data.price,
    per_quantity: data.perQuantity,
    per_unit: data.perUnit,
    source: data.source,
    observed_on: data.observedOn,
  };
  const query = data.id ? supabase.from("reference_prices").update(row).eq("id", data.id).select("id") : supabase.from("reference_prices").insert(row).select("id");
  const { data: saved, error } = await query;
  if (error) throw dbError(error, "No se pudo guardar el precio.");
  const id = saved?.[0]?.id;
  if (!id) throw new AdminOpError(data.id ? "NOT_FOUND" : "FORBIDDEN", data.id ? "El precio no existe." : "No tienes permiso para crear precios.");
  await logAdminAction(supabase, {
    action: data.id ? "reference_price.update" : "reference_price.create",
    targetTable: "reference_prices",
    targetId: id,
    metadata: { currency: data.currencyCode, food_id: data.foodId ?? undefined },
  });
  return { id };
}

export async function deleteReferencePrice(supabase: Db, id: string): Promise<void> {
  const { data: deleted, error } = await supabase.from("reference_prices").delete().eq("id", id).select("id");
  if (error) throw dbError(error, "No se pudo eliminar el precio.");
  if (!deleted?.length) throw new AdminOpError("NOT_FOUND", "El precio no existe.");
  await logAdminAction(supabase, { action: "reference_price.delete", targetTable: "reference_prices", targetId: id });
}

/** Alimentos públicos sin verificar (badge de la cola). */
export async function countUnverifiedFoods(supabase: Db): Promise<number> {
  const { count, error } = await supabase
    .from("foods")
    .select("id", { count: "exact", head: true })
    .eq("is_public", true)
    .eq("verification_status", "unverified");
  if (error) throw dbError(error, "No se pudo leer la cola de verificación.");
  return count ?? 0;
}
