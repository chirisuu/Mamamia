"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { getProfile, requireUser } from "@/lib/auth/session";
import { DEFAULT_TIMEZONE, todayInTz } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mealLabel } from "./lib/day-totals";
import { isAllowedDiaryDate } from "./lib/meal-time";
import {
  applyTemplateSchema,
  copyMealSchema,
  createCustomMealSchema,
  favoriteFoodSchema,
  itemIdSchema,
  logFoodSchema,
  logManualSchema,
  mealLogIdSchema,
  moveItemSchema,
  ownFoodIdSchema,
  ownFoodSchema,
  saveTemplateSchema,
  templateIdSchema,
  updateItemQuantitySchema,
  type ApplyTemplateInput,
  type CopyMealInput,
  type CreateCustomMealInput,
  type FavoriteFoodInput,
  type LogFoodInput,
  type LogManualInput,
  type MoveItemInput,
  type OwnFoodInput,
  type SaveTemplateInput,
  type UpdateItemQuantityInput,
} from "./schemas";
import { addItemsToMeal, LogItemsError } from "./server/log-items";
import {
  applyTemplate,
  clearMeal,
  copyMealToDate,
  createCustomMeal,
  deleteCustomMeal,
  deleteItem,
  deleteTemplate,
  DiaryOpError,
  duplicateItem,
  moveItem,
  saveMealAsTemplate,
  setFavoriteFood,
  updateItemQuantity,
} from "./server/diary-ops";
import { createOwnFood, deleteOwnFood, OwnFoodError, updateOwnFood } from "./server/own-foods";

/**
 * Server Actions del diario. Cada una: sesión (requireUser) → Zod → escritura con el cliente
 * del usuario (RLS) → revalidatePath → ActionResult. El user_id sale de la sesión, nunca del cliente.
 */

function revalidateApp() {
  // Inicio, diario, búsqueda y alimentos dependen de los mismos registros.
  revalidatePath("/app", "layout");
}

function toFailure(error: unknown, action: string): ActionResult<never> {
  if (error instanceof OwnFoodError) {
    return fail(error.code, error.message, error.field ? { [error.field]: [error.message] } : undefined);
  }
  if (error instanceof DiaryOpError || error instanceof LogItemsError) return fail(error.code, error.message);
  // Sin datos de salud en los logs: solo la acción y el tipo de error.
  console.error(`[diary] ${action} falló`, error instanceof Error ? error.name : typeof error);
  return fail("UNEXPECTED", "Algo salió mal. Inténtalo de nuevo.");
}

async function context() {
  const user = await requireUser();
  const [supabase, profile] = await Promise.all([createSupabaseServerClient(), getProfile()]);
  const today = todayInTz(profile?.timezone ?? DEFAULT_TIMEZONE);
  return { user, supabase, today };
}

function parse<S extends z.ZodType>(schema: S, input: unknown): { ok: true; data: z.output<S> } | { ok: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, result: invalid(parsed.error) };
  return { ok: true, data: parsed.data };
}

const DATE_NOT_ALLOWED = "Puedes registrar días pasados y hasta mañana, no más adelante.";

/* -------------------------------------------------------------------------- */
/* Registrar                                                                    */
/* -------------------------------------------------------------------------- */

export async function logFoodAction(input: LogFoodInput): Promise<ActionResult<{ itemIds: string[]; mealLabel: string; localDate: string }>> {
  const parsed = parse(logFoodSchema, input);
  if (!parsed.ok) return parsed.result;
  const { user, supabase, today } = await context();
  const d = parsed.data;
  if (!isAllowedDiaryDate(d.localDate, today)) return fail("VALIDATION", DATE_NOT_ALLOWED);
  if (d.mealType === "custom" && !d.customName) return fail("VALIDATION", "Elige la comida de destino.");
  try {
    const res = await addItemsToMeal(supabase, user.id, {
      localDate: d.localDate,
      mealType: d.mealType,
      customName: d.mealType === "custom" ? d.customName : null,
      items: [{ kind: "food", foodId: d.foodId, grams: d.grams, quantity: d.quantity, unit: d.unit, source: d.source }],
    });
    revalidateApp();
    return ok({ itemIds: res.itemIds, mealLabel: mealLabel(d.mealType, d.customName ?? null), localDate: d.localDate });
  } catch (e) {
    return toFailure(e, "logFood");
  }
}

export async function logManualAction(input: LogManualInput): Promise<ActionResult<{ mealLabel: string; localDate: string }>> {
  const parsed = parse(logManualSchema, input);
  if (!parsed.ok) return parsed.result;
  const { user, supabase, today } = await context();
  const d = parsed.data;
  if (!isAllowedDiaryDate(d.localDate, today)) return fail("VALIDATION", DATE_NOT_ALLOWED);
  if (d.mealType === "custom" && !d.customName) return fail("VALIDATION", "Elige la comida de destino.");
  try {
    await addItemsToMeal(supabase, user.id, {
      localDate: d.localDate,
      mealType: d.mealType,
      customName: d.mealType === "custom" ? d.customName : null,
      items: [{ kind: "manual", name: d.name, energyKcal: d.energyKcal, proteinG: d.proteinG, carbsG: d.carbsG, fatG: d.fatG, source: "manual" }],
    });
    revalidateApp();
    return ok({ mealLabel: mealLabel(d.mealType, d.customName ?? null), localDate: d.localDate });
  } catch (e) {
    return toFailure(e, "logManual");
  }
}

/* -------------------------------------------------------------------------- */
/* Ítems                                                                        */
/* -------------------------------------------------------------------------- */

export async function updateItemQuantityAction(input: UpdateItemQuantityInput): Promise<ActionResult<{ id: string }>> {
  const parsed = parse(updateItemQuantitySchema, input);
  if (!parsed.ok) return parsed.result;
  const { user, supabase } = await context();
  try {
    const res = await updateItemQuantity(supabase, user.id, parsed.data);
    revalidateApp();
    return ok(res);
  } catch (e) {
    return toFailure(e, "updateItemQuantity");
  }
}

export async function deleteItemAction(input: { itemId: string }): Promise<ActionResult<null>> {
  const parsed = parse(itemIdSchema, input);
  if (!parsed.ok) return parsed.result;
  const { user, supabase } = await context();
  try {
    await deleteItem(supabase, user.id, parsed.data.itemId);
    revalidateApp();
    return ok(null);
  } catch (e) {
    return toFailure(e, "deleteItem");
  }
}

export async function moveItemAction(input: MoveItemInput): Promise<ActionResult<{ mealLabel: string }>> {
  const parsed = parse(moveItemSchema, input);
  if (!parsed.ok) return parsed.result;
  const { user, supabase } = await context();
  const d = parsed.data;
  try {
    await moveItem(supabase, user.id, { itemId: d.itemId, mealType: d.mealType, customName: d.customName ?? null });
    revalidateApp();
    return ok({ mealLabel: mealLabel(d.mealType, d.customName ?? null) });
  } catch (e) {
    return toFailure(e, "moveItem");
  }
}

export async function duplicateItemAction(input: { itemId: string }): Promise<ActionResult<{ copied: number }>> {
  const parsed = parse(itemIdSchema, input);
  if (!parsed.ok) return parsed.result;
  const { user, supabase } = await context();
  try {
    const res = await duplicateItem(supabase, user.id, parsed.data.itemId);
    revalidateApp();
    return ok({ copied: res.copied });
  } catch (e) {
    return toFailure(e, "duplicateItem");
  }
}

export async function setFavoriteFoodAction(input: FavoriteFoodInput): Promise<ActionResult<{ favorite: boolean }>> {
  const parsed = parse(favoriteFoodSchema, input);
  if (!parsed.ok) return parsed.result;
  const { user, supabase } = await context();
  try {
    const res = await setFavoriteFood(supabase, user.id, parsed.data);
    revalidateApp();
    return ok(res);
  } catch (e) {
    return toFailure(e, "setFavoriteFood");
  }
}

/* -------------------------------------------------------------------------- */
/* Comidas                                                                      */
/* -------------------------------------------------------------------------- */

export async function copyMealAction(input: CopyMealInput): Promise<ActionResult<{ copied: number; targetDate: string }>> {
  const parsed = parse(copyMealSchema, input);
  if (!parsed.ok) return parsed.result;
  const { user, supabase, today } = await context();
  if (!isAllowedDiaryDate(parsed.data.targetDate, today)) return fail("VALIDATION", DATE_NOT_ALLOWED);
  try {
    // Copiar al mismo día duplica la comida: es válido (la UI muestra el conteo).
    const res = await copyMealToDate(supabase, user.id, parsed.data);
    revalidateApp();
    return ok({ copied: res.copied, targetDate: parsed.data.targetDate });
  } catch (e) {
    return toFailure(e, "copyMeal");
  }
}

export async function clearMealAction(input: { mealLogId: string }): Promise<ActionResult<{ removed: number }>> {
  const parsed = parse(mealLogIdSchema, input);
  if (!parsed.ok) return parsed.result;
  const { user, supabase } = await context();
  try {
    const res = await clearMeal(supabase, user.id, parsed.data.mealLogId);
    revalidateApp();
    return ok({ removed: res.removed });
  } catch (e) {
    return toFailure(e, "clearMeal");
  }
}

export async function createCustomMealAction(input: CreateCustomMealInput): Promise<ActionResult<{ id: string }>> {
  const parsed = parse(createCustomMealSchema, input);
  if (!parsed.ok) return parsed.result;
  const { user, supabase, today } = await context();
  if (!isAllowedDiaryDate(parsed.data.localDate, today)) return fail("VALIDATION", DATE_NOT_ALLOWED);
  try {
    const res = await createCustomMeal(supabase, user.id, parsed.data);
    revalidateApp();
    return ok(res);
  } catch (e) {
    return toFailure(e, "createCustomMeal");
  }
}

export async function deleteCustomMealAction(input: { mealLogId: string }): Promise<ActionResult<null>> {
  const parsed = parse(mealLogIdSchema, input);
  if (!parsed.ok) return parsed.result;
  const { user, supabase } = await context();
  try {
    await deleteCustomMeal(supabase, user.id, parsed.data.mealLogId);
    revalidateApp();
    return ok(null);
  } catch (e) {
    return toFailure(e, "deleteCustomMeal");
  }
}

/* -------------------------------------------------------------------------- */
/* Plantillas                                                                   */
/* -------------------------------------------------------------------------- */

export async function saveTemplateAction(input: SaveTemplateInput): Promise<ActionResult<{ saved: number; skipped: number }>> {
  const parsed = parse(saveTemplateSchema, input);
  if (!parsed.ok) return parsed.result;
  const { user, supabase } = await context();
  try {
    const res = await saveMealAsTemplate(supabase, user.id, parsed.data);
    revalidateApp();
    return ok({ saved: res.saved, skipped: res.skipped });
  } catch (e) {
    return toFailure(e, "saveTemplate");
  }
}

export async function applyTemplateAction(input: ApplyTemplateInput): Promise<ActionResult<{ added: number; skipped: number }>> {
  const parsed = parse(applyTemplateSchema, input);
  if (!parsed.ok) return parsed.result;
  const { user, supabase, today } = await context();
  const d = parsed.data;
  if (!isAllowedDiaryDate(d.localDate, today)) return fail("VALIDATION", DATE_NOT_ALLOWED);
  if (d.mealType === "custom" && !d.customName) return fail("VALIDATION", "Elige la comida de destino.");
  try {
    const res = await applyTemplate(supabase, user.id, {
      templateId: d.templateId,
      localDate: d.localDate,
      mealType: d.mealType,
      customName: d.mealType === "custom" ? (d.customName ?? null) : null,
    });
    revalidateApp();
    return ok(res);
  } catch (e) {
    return toFailure(e, "applyTemplate");
  }
}

export async function deleteTemplateAction(input: { templateId: string }): Promise<ActionResult<null>> {
  const parsed = parse(templateIdSchema, input);
  if (!parsed.ok) return parsed.result;
  const { user, supabase } = await context();
  try {
    await deleteTemplate(supabase, user.id, parsed.data.templateId);
    revalidateApp();
    return ok(null);
  } catch (e) {
    return toFailure(e, "deleteTemplate");
  }
}

/* -------------------------------------------------------------------------- */
/* Alimentos propios                                                            */
/* -------------------------------------------------------------------------- */

export async function createOwnFoodAction(input: OwnFoodInput): Promise<ActionResult<{ id: string }>> {
  const parsed = parse(ownFoodSchema, input);
  if (!parsed.ok) return parsed.result;
  const { user, supabase } = await context();
  try {
    const res = await createOwnFood(supabase, user.id, parsed.data);
    revalidateApp();
    return ok(res);
  } catch (e) {
    return toFailure(e, "createOwnFood");
  }
}

export async function updateOwnFoodAction(foodId: string, input: OwnFoodInput): Promise<ActionResult<{ id: string }>> {
  const id = parse(ownFoodIdSchema, { foodId });
  if (!id.ok) return id.result;
  const parsed = parse(ownFoodSchema, input);
  if (!parsed.ok) return parsed.result;
  const { user, supabase } = await context();
  try {
    const res = await updateOwnFood(supabase, user.id, id.data.foodId, parsed.data);
    revalidateApp();
    return ok(res);
  } catch (e) {
    return toFailure(e, "updateOwnFood");
  }
}

export async function deleteOwnFoodAction(input: { foodId: string }): Promise<ActionResult<null>> {
  const parsed = parse(ownFoodIdSchema, input);
  if (!parsed.ok) return parsed.result;
  const { user, supabase } = await context();
  try {
    await deleteOwnFood(supabase, user.id, parsed.data.foodId);
    revalidateApp();
    return ok(null);
  } catch (e) {
    return toFailure(e, "deleteOwnFood");
  }
}
