"use server";

import { revalidatePath } from "next/cache";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/billing/entitlements";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  addManualItemSchema,
  generateListSchema,
  itemIdSchema,
  listIdSchema,
  toggleItemSchema,
  updateItemSchema,
  updateListSchema,
  type AddManualItemInput,
  type UpdateItemInput,
  type UpdateListInput,
} from "./schemas";
import { addManualItem, deleteItem, deleteList, generateListFromPlan, ShoppingOpError, toggleItem, updateItem, updateList } from "./server/shopping";

/**
 * Server Actions de la lista de compras (Premium `shopping_list`, verificado en el servidor).
 * Marcar, editar y borrar listas ya creadas no exige Premium: son datos de la persona.
 */

function toFailure(error: unknown, action: string): ActionResult<never> {
  if (error instanceof ShoppingOpError) return fail(error.code, error.message);
  console.error(`[shopping] ${action} falló`, error instanceof Error ? error.name : typeof error);
  return fail("UNEXPECTED", "Algo salió mal. Inténtalo de nuevo.");
}

async function context() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  return { user, supabase };
}

function revalidateList(listId?: string) {
  revalidatePath("/app/compras");
  if (listId) revalidatePath(`/app/compras/${listId}`);
}

export async function generateShoppingListAction(input: { planId: string }): Promise<
  ActionResult<{ id: string; itemsCount: number; unpriced: number; missingRecipes: number }>
> {
  const { user, supabase } = await context();
  const parsed = generateListSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!(await hasFeature("shopping_list"))) return fail("PREMIUM_REQUIRED", "La lista de compras es parte de Premium.");
  try {
    const res = await generateListFromPlan(supabase, user.id, parsed.data.planId);
    revalidateList(res.id);
    return ok(res);
  } catch (error) {
    return toFailure(error, "generateList");
  }
}

export async function toggleShoppingItemAction(input: { itemId: string; checked: boolean }): Promise<ActionResult<null>> {
  const { user, supabase } = await context();
  const parsed = toggleItemSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { listId } = await toggleItem(supabase, user.id, parsed.data);
    revalidateList(listId);
    return ok(null);
  } catch (error) {
    return toFailure(error, "toggleItem");
  }
}

export async function updateShoppingItemAction(input: UpdateItemInput): Promise<ActionResult<null>> {
  const { user, supabase } = await context();
  const parsed = updateItemSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { listId } = await updateItem(supabase, user.id, parsed.data);
    revalidateList(listId);
    return ok(null);
  } catch (error) {
    return toFailure(error, "updateItem");
  }
}

export async function addManualShoppingItemAction(input: AddManualItemInput): Promise<ActionResult<{ id: string }>> {
  const { user, supabase } = await context();
  const parsed = addManualItemSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const res = await addManualItem(supabase, user.id, parsed.data);
    revalidateList(res.listId);
    return ok({ id: res.id });
  } catch (error) {
    return toFailure(error, "addManualItem");
  }
}

export async function deleteShoppingItemAction(input: { itemId: string }): Promise<ActionResult<null>> {
  const { user, supabase } = await context();
  const parsed = itemIdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    const { listId } = await deleteItem(supabase, user.id, parsed.data.itemId);
    revalidateList(listId);
    return ok(null);
  } catch (error) {
    return toFailure(error, "deleteItem");
  }
}

export async function updateShoppingListAction(input: UpdateListInput): Promise<ActionResult<null>> {
  const { user, supabase } = await context();
  const parsed = updateListSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await updateList(supabase, user.id, parsed.data);
    revalidateList(parsed.data.listId);
    return ok(null);
  } catch (error) {
    return toFailure(error, "updateList");
  }
}

export async function deleteShoppingListAction(input: { listId: string }): Promise<ActionResult<null>> {
  const { user, supabase } = await context();
  const parsed = listIdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await deleteList(supabase, user.id, parsed.data.listId);
    revalidateList();
    return ok(null);
  } catch (error) {
    return toFailure(error, "deleteList");
  }
}
