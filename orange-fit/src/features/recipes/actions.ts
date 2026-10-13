"use server";

import { revalidatePath } from "next/cache";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { getProfile, requireUser } from "@/lib/auth/session";
import { addDays, DEFAULT_TIMEZONE, todayInTz } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LogItemsError } from "@/features/diary/server/log-items";
import {
  favoriteRecipeSchema,
  logRecipeSchema,
  recipeIdSchema,
  saveRecipeSchema,
  type FavoriteRecipeInput,
  type LogRecipeInput,
  type SaveRecipeInput,
} from "./schemas";
import { deleteRecipe, logRecipe, RecipeOpError, saveRecipe, setFavoriteRecipe } from "./server/recipes";

/**
 * Server Actions de recetas: sesión → Zod → escritura con el cliente del usuario (RLS) →
 * revalidatePath → ActionResult. El user_id sale siempre de la sesión.
 */

function toFailure(error: unknown, action: string): ActionResult<never> {
  if (error instanceof RecipeOpError || error instanceof LogItemsError) return fail(error.code, error.message);
  console.error(`[recipes] ${action} falló`, error instanceof Error ? error.name : typeof error);
  return fail("UNEXPECTED", "Algo salió mal. Inténtalo de nuevo.");
}

export async function saveRecipeAction(input: SaveRecipeInput): Promise<ActionResult<{ id: string; slug: string; status: string }>> {
  const user = await requireUser();
  const parsed = saveRecipeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    const saved = await saveRecipe(supabase, user.id, parsed.data);
    revalidatePath("/app/recetas", "layout");
    return ok(saved);
  } catch (error) {
    return toFailure(error, "saveRecipe");
  }
}

export async function deleteRecipeAction(input: { recipeId: string }): Promise<ActionResult<null>> {
  const user = await requireUser();
  const parsed = recipeIdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    await deleteRecipe(supabase, user.id, parsed.data.recipeId);
    revalidatePath("/app/recetas", "layout");
    return ok(null);
  } catch (error) {
    return toFailure(error, "deleteRecipe");
  }
}

export async function setFavoriteRecipeAction(input: FavoriteRecipeInput): Promise<ActionResult<{ favorite: boolean }>> {
  const user = await requireUser();
  const parsed = favoriteRecipeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const supabase = await createSupabaseServerClient();
    const favorite = await setFavoriteRecipe(supabase, user.id, parsed.data);
    revalidatePath("/app/recetas", "layout");
    revalidatePath("/app/alimentos");
    return ok({ favorite });
  } catch (error) {
    return toFailure(error, "setFavoriteRecipe");
  }
}

export async function logRecipeAction(input: LogRecipeInput): Promise<ActionResult<{ localDate: string }>> {
  const user = await requireUser();
  const parsed = logRecipeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const profile = await getProfile();
  const today = todayInTz(profile?.timezone ?? DEFAULT_TIMEZONE);
  // Igual que el diario: el pasado y hasta mañana.
  if (parsed.data.localDate > addDays(today, 1)) {
    return fail("VALIDATION", "Solo puedes registrar hasta mañana.", { localDate: ["Elige una fecha hasta mañana."] });
  }
  try {
    const supabase = await createSupabaseServerClient();
    await logRecipe(supabase, user.id, parsed.data);
    revalidatePath("/app", "layout");
    return ok({ localDate: parsed.data.localDate });
  } catch (error) {
    return toFailure(error, "logRecipe");
  }
}
