import "server-only";
import sharp from "sharp";
import type { z } from "zod";
import type { Tables, TablesUpdate } from "@/lib/db/database.types";
import { randomSuffix, slugify } from "@/features/recipes/lib/slug";
import { RECIPE_IMAGES_BUCKET } from "@/features/recipes/lib/image";
import { RECIPE_IMAGE_HEIGHT, RECIPE_IMAGE_WIDTH, type OfficialRecipeData, type recipeReviewSchema } from "../schemas";
import { AdminOpError, dbError, logAdminAction, type Db } from "./db";

export const RECIPES_PER_PAGE = 30;

type RecipeRow = Tables<"recipes">;
type RecipeStatus = RecipeRow["status"];

/** `review_note` viene de la migración 20261013100801 (los tipos generados aún no la tienen). */
export type AdminRecipeRow = RecipeRow & { review_note?: string | null };

export type AdminRecipeListItem = Pick<RecipeRow, "id" | "title" | "slug" | "status" | "is_public" | "updated_at" | "image_path"> & {
  isOfficial: boolean;
};

export async function listAdminRecipes(
  supabase: Db,
  opts: { status?: RecipeStatus | null; origin?: "official" | "users" | null; q?: string | null; page: number },
): Promise<{ rows: AdminRecipeListItem[]; total: number }> {
  const from = (opts.page - 1) * RECIPES_PER_PAGE;
  let query = supabase
    .from("recipes")
    .select("id, title, slug, status, is_public, updated_at, image_path, owner_id", { count: "exact" })
    .order("updated_at", { ascending: opts.status === "pending_review" })
    .range(from, from + RECIPES_PER_PAGE - 1);
  if (opts.status) query = query.eq("status", opts.status);
  if (opts.origin === "official") query = query.is("owner_id", null);
  // Recetas de usuarios: solo las que el autor envió (o ya revisadas). Sus borradores son privados.
  if (opts.origin === "users") query = query.not("owner_id", "is", null).neq("status", "draft");
  if (!opts.origin) query = query.or("owner_id.is.null,status.neq.draft");
  const term = opts.q?.replace(/[%_,()*]/g, " ").trim();
  if (term) query = query.or(`title.ilike.%${term}%,slug.ilike.%${term}%`);
  const { data, count, error } = await query;
  if (error) throw dbError(error, "No se pudieron leer las recetas.");
  return {
    rows: (data ?? []).map(({ owner_id, ...r }) => ({ ...r, isOfficial: owner_id == null })),
    total: count ?? 0,
  };
}

export async function countPendingRecipes(supabase: Db): Promise<number> {
  const { count } = await supabase.from("recipes").select("id", { count: "exact", head: true }).eq("status", "pending_review");
  return count ?? 0;
}

export type AdminIngredient = {
  id: string;
  foodId: string;
  foodName: string;
  brandName: string | null;
  foodIsPublic: boolean;
  foodStatus: Tables<"foods">["verification_status"];
  /** Por 100 g (para la vista previa de nutrición del editor). */
  per100g: { energyKcal: number; proteinG: number; carbsG: number; fatG: number } | null;
  grams: number;
  displayQuantity: number | null;
  displayUnit: string | null;
  note: string | null;
  position: number;
};

export type AdminRecipeDetail = {
  recipe: AdminRecipeRow;
  isOfficial: boolean;
  ingredients: AdminIngredient[];
  nutrition: Tables<"recipe_nutrition"> | null;
};

export async function getAdminRecipe(supabase: Db, id: string): Promise<AdminRecipeDetail | null> {
  const { data: recipe, error } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
  if (error) throw dbError(error, "No se pudo leer la receta.");
  // Un borrador de un usuario es privado: el staff solo ve lo que se envió a revisión o ya se revisó.
  if (!recipe || (recipe.owner_id && recipe.status === "draft")) return null;
  const [{ data: ings, error: iErr }, { data: nutrition, error: nErr }] = await Promise.all([
    supabase
      .from("recipe_ingredients")
      .select("id, food_id, grams, display_quantity, display_unit, note, position, foods(name, is_public, verification_status, energy_kcal, protein_g, carbs_g, fat_g, brands(name))")
      .eq("recipe_id", id)
      .order("position"),
    supabase.from("recipe_nutrition").select("*").eq("recipe_id", id).maybeSingle(),
  ]);
  if (iErr || nErr) throw dbError(iErr ?? nErr, "No se pudieron leer los ingredientes.");
  type IngRow = {
    id: string;
    food_id: string;
    grams: number;
    display_quantity: number | null;
    display_unit: string | null;
    note: string | null;
    position: number;
    foods: {
      name: string;
      is_public: boolean;
      verification_status: Tables<"foods">["verification_status"];
      energy_kcal: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
      brands: { name: string } | null;
    } | null;
  };
  return {
    recipe: recipe as AdminRecipeRow,
    isOfficial: recipe.owner_id == null,
    ingredients: ((ings ?? []) as unknown as IngRow[]).map((r) => ({
      id: r.id,
      foodId: r.food_id,
      foodName: r.foods?.name ?? "Alimento no disponible",
      brandName: r.foods?.brands?.name ?? null,
      foodIsPublic: Boolean(r.foods?.is_public),
      foodStatus: r.foods?.verification_status ?? "unverified",
      per100g: r.foods
        ? { energyKcal: Number(r.foods.energy_kcal), proteinG: Number(r.foods.protein_g), carbsG: Number(r.foods.carbs_g), fatG: Number(r.foods.fat_g) }
        : null,
      grams: Number(r.grams),
      displayQuantity: r.display_quantity == null ? null : Number(r.display_quantity),
      displayUnit: r.display_unit,
      note: r.note,
      position: r.position,
    })),
    nutrition: nutrition ?? null,
  };
}

/** Publicar o rechazar una receta enviada por un usuario. El autor recibe el aviso (trigger). */
export async function reviewRecipe(supabase: Db, actorId: string, data: z.output<typeof recipeReviewSchema>): Promise<{ status: RecipeStatus }> {
  const detail = await getAdminRecipe(supabase, data.recipeId);
  if (!detail) throw new AdminOpError("NOT_FOUND", "La receta no existe.");
  if (detail.recipe.status !== "pending_review") {
    throw new AdminOpError("INVALID_STATE", "Solo se modera una receta en revisión. Puede que alguien ya la haya revisado.");
  }
  if (data.decision === "publish") {
    const privateFoods = detail.ingredients.filter((i) => !i.foodIsPublic);
    if (privateFoods.length) {
      throw new AdminOpError(
        "PRIVATE_FOODS",
        `Usa ${privateFoods.length} alimento(s) que no son del catálogo público. Recházala pidiendo cambiarlos por alimentos públicos.`,
      );
    }
    if (detail.ingredients.length === 0) throw new AdminOpError("NO_INGREDIENTS", "La receta no tiene ingredientes.");
  }
  const status: RecipeStatus = data.decision === "publish" ? "published" : "rejected";
  const patch = {
    status,
    is_public: data.decision === "publish" ? true : detail.recipe.is_public,
    reviewed_by: actorId,
    reviewed_at: new Date().toISOString(),
    review_note: data.note,
  } as TablesUpdate<"recipes">;
  const { data: saved, error } = await supabase.from("recipes").update(patch).eq("id", data.recipeId).eq("status", "pending_review").select("id");
  if (error) throw dbError(error, "No se pudo guardar la revisión.");
  if (!saved?.length) throw new AdminOpError("INVALID_STATE", "La receta cambió mientras la revisabas. Recarga la página.");
  await logAdminAction(supabase, {
    action: data.decision === "publish" ? "recipe.publish" : "recipe.reject",
    targetTable: "recipes",
    targetId: data.recipeId,
    metadata: { origin: detail.isOfficial ? "official" : "user", with_note: Boolean(data.note) },
  });
  return { status };
}

async function uniqueSlug(supabase: Db, title: string): Promise<string> {
  const base = slugify(title, 80);
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomSuffix(4)}`;
    const { data, error } = await supabase.from("recipes").select("id").eq("slug", slug).limit(1);
    if (error) throw dbError(error, "No se pudo revisar el slug.");
    if (!data?.length && !["nueva", "editar"].includes(slug)) return slug;
  }
  throw new AdminOpError("CONFLICT", "No se pudo generar una dirección única para la receta. Cambia el título.");
}

/**
 * Crea o actualiza una receta oficial (owner_id null). Solo alimentos públicos: las oficiales son
 * públicas y su nutrición se calcula desde los ingredientes para cualquier visitante.
 */
export async function saveOfficialRecipe(supabase: Db, actorId: string, data: OfficialRecipeData): Promise<{ id: string; slug: string }> {
  const foodIds = [...new Set(data.ingredients.map((i) => i.foodId))];
  const { data: foods, error: fErr } = await supabase.from("foods").select("id, is_public").in("id", foodIds);
  if (fErr) throw dbError(fErr, "No se pudieron revisar los alimentos.");
  const publicIds = new Set((foods ?? []).filter((f) => f.is_public).map((f) => f.id));
  const missing = foodIds.filter((fid) => !publicIds.has(fid));
  if (missing.length) {
    throw new AdminOpError("PRIVATE_FOODS", `${missing.length} ingrediente(s) no son del catálogo público. Elige alimentos públicos.`);
  }

  let existing: AdminRecipeRow | null = null;
  if (data.recipeId) {
    const { data: row, error } = await supabase.from("recipes").select("*").eq("id", data.recipeId).maybeSingle();
    if (error) throw dbError(error, "No se pudo leer la receta.");
    if (!row || row.owner_id) throw new AdminOpError("NOT_FOUND", "La receta oficial no existe.");
    existing = row;
  }

  const publishing = data.status === "published" && existing?.status !== "published";
  const tags = [...new Set(data.tags.map((t) => t.toLowerCase()))];
  const values = {
    title: data.title,
    description: data.description,
    servings: data.servings,
    prep_minutes: data.prepMinutes,
    cook_minutes: data.cookMinutes,
    difficulty: data.difficulty,
    steps: data.steps,
    tags,
    diet_tags: [...new Set(data.dietTags)],
    allergens: [...new Set(data.allergens)],
    meal_types: [...new Set(data.mealTypes)],
    estimated_cost: data.estimatedCost,
    cost_currency: data.estimatedCost == null ? null : data.costCurrency,
    status: data.status,
    is_public: true,
    ...(publishing ? { reviewed_by: actorId, reviewed_at: new Date().toISOString() } : {}),
  };

  let id: string;
  let slug: string;
  if (existing) {
    // Si está publicada, primero se agregan los ingredientes nuevos y luego se quitan los anteriores
    // (la receta nunca queda vacía para quien la mire en ese momento).
    const { data: saved, error } = await supabase.from("recipes").update(values).eq("id", existing.id).is("owner_id", null).select("id, slug");
    if (error) throw dbError(error, "No se pudo guardar la receta.");
    if (!saved?.length) throw new AdminOpError("FORBIDDEN", "No tienes permiso para editar recetas oficiales.");
    id = saved[0].id;
    slug = saved[0].slug;
  } else {
    slug = await uniqueSlug(supabase, data.title);
    const { data: saved, error } = await supabase
      .from("recipes")
      .insert({ ...values, slug, owner_id: null, country_code: "PE" })
      .select("id, slug")
      .single();
    if (error) {
      if (error.code === "23505") throw new AdminOpError("CONFLICT", "Ya existe una receta con ese título. Cambia el título.");
      throw dbError(error, "No se pudo crear la receta.");
    }
    id = saved.id;
    slug = saved.slug;
  }

  const { data: oldIngredients, error: oErr } = await supabase.from("recipe_ingredients").select("id").eq("recipe_id", id);
  if (oErr) throw dbError(oErr, "No se pudieron leer los ingredientes.");
  const { error: insError } = await supabase.from("recipe_ingredients").insert(
    data.ingredients.map((ing, position) => ({
      recipe_id: id,
      food_id: ing.foodId,
      grams: ing.grams,
      display_quantity: ing.displayQuantity,
      display_unit: ing.displayUnit,
      note: ing.note,
      position,
    })),
  );
  if (insError) throw dbError(insError, "No se pudieron guardar los ingredientes.");
  const oldIds = (oldIngredients ?? []).map((r) => r.id);
  if (oldIds.length) {
    const { error: delError } = await supabase.from("recipe_ingredients").delete().in("id", oldIds);
    if (delError) throw dbError(delError, "No se pudieron reemplazar los ingredientes.");
  }

  await logAdminAction(supabase, {
    action: existing ? "recipe.update" : "recipe.create",
    targetTable: "recipes",
    targetId: id,
    metadata: { status: data.status, ingredients: data.ingredients.length },
  });
  return { id, slug };
}

/* -------------------------------------------------------------------------- */
/* Imagen                                                                       */
/* -------------------------------------------------------------------------- */

/** Ruta de la imagen oficial dentro del bucket (docs/IMAGE_PROMPTS.md). */
export function officialImagePath(slug: string): string {
  return `official/${slug}.webp`;
}

/** Normaliza cualquier imagen a WebP 1200×900 (recorte centrado), sin metadatos (EXIF/GPS). */
export async function toRecipeWebp(input: Buffer): Promise<Buffer> {
  try {
    return await sharp(input, { failOn: "error", limitInputPixels: 60_000_000 })
      .rotate()
      .resize(RECIPE_IMAGE_WIDTH, RECIPE_IMAGE_HEIGHT, { fit: "cover", position: "centre" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new AdminOpError("INVALID_IMAGE", "No pudimos leer la imagen. Usa un JPG, PNG o WebP válido.");
  }
}

export async function uploadRecipeImage(supabase: Db, recipeId: string, input: Buffer): Promise<{ imagePath: string; bytes: number }> {
  const { data: recipe, error } = await supabase.from("recipes").select("id, slug, owner_id").eq("id", recipeId).maybeSingle();
  if (error) throw dbError(error, "No se pudo leer la receta.");
  if (!recipe || recipe.owner_id) throw new AdminOpError("NOT_FOUND", "Solo las recetas oficiales llevan imagen del panel.");
  const webp = await toRecipeWebp(input);
  const imagePath = officialImagePath(recipe.slug);
  const { error: upError } = await supabase.storage.from(RECIPE_IMAGES_BUCKET).upload(imagePath, webp, {
    contentType: "image/webp",
    upsert: true,
    cacheControl: "3600",
  });
  if (upError) {
    console.error("[admin] subida de imagen falló", { status: (upError as { statusCode?: string }).statusCode });
    throw new AdminOpError("STORAGE_ERROR", "No se pudo subir la imagen al almacenamiento.");
  }
  // updated_at cambia con el trigger: sirve de versión para evitar la caché del navegador.
  const { error: rErr } = await supabase.from("recipes").update({ image_path: imagePath }).eq("id", recipeId);
  if (rErr) throw dbError(rErr, "La imagen se subió, pero no se pudo guardar en la receta.");
  await logAdminAction(supabase, { action: "recipe.image_upload", targetTable: "recipes", targetId: recipeId, metadata: { bytes: webp.length } });
  return { imagePath, bytes: webp.length };
}

export async function removeRecipeImage(supabase: Db, recipeId: string): Promise<void> {
  const { data: recipe, error } = await supabase.from("recipes").select("id, owner_id, image_path").eq("id", recipeId).maybeSingle();
  if (error) throw dbError(error, "No se pudo leer la receta.");
  if (!recipe || recipe.owner_id) throw new AdminOpError("NOT_FOUND", "La receta oficial no existe.");
  if (!recipe.image_path) return;
  const { error: rErr } = await supabase.from("recipes").update({ image_path: null }).eq("id", recipeId);
  if (rErr) throw dbError(rErr, "No se pudo quitar la imagen.");
  if (recipe.image_path.startsWith("official/")) {
    const { error: delError } = await supabase.storage.from(RECIPE_IMAGES_BUCKET).remove([recipe.image_path]);
    if (delError) console.error("[admin] no se pudo borrar el archivo de imagen", { recipeId });
  }
  await logAdminAction(supabase, { action: "recipe.image_remove", targetTable: "recipes", targetId: recipeId });
}
