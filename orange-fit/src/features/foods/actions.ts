"use server";

import { revalidatePath } from "next/cache";
import { addItemsToMeal, LogItemsError } from "@/features/diary/server/log-items";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { getProfile, requireUser } from "@/lib/auth/session";
import { DEFAULT_TIMEZONE, todayInTz } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLoggableDate, mealDisplayName } from "./lib/meals";
import { logBarcodeFoodSchema, type LogBarcodeFoodInput } from "./schemas";

/**
 * Registra en el diario un alimento encontrado por código de barras (source 'barcode').
 * El cliente solo manda qué alimento y cuántos gramos: `addItemsToMeal` calcula los nutrientes
 * desde la base y guarda su procedencia.
 */
export async function logBarcodeFoodAction(
  input: LogBarcodeFoodInput,
): Promise<ActionResult<{ itemIds: string[]; localDate: string; mealLabel: string }>> {
  const user = await requireUser("/app/agregar/codigo");
  const parsed = logBarcodeFoodSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;

  const profile = await getProfile();
  const today = todayInTz(profile?.timezone ?? DEFAULT_TIMEZONE);
  if (!isLoggableDate(v.localDate, today)) {
    return fail("INVALID_DATE", "Puedes registrar días pasados, hoy o mañana.");
  }
  const customName = v.mealType === "custom" ? (v.customName ?? null) : null;

  try {
    const supabase = await createSupabaseServerClient();
    const { itemIds } = await addItemsToMeal(supabase, user.id, {
      localDate: v.localDate,
      mealType: v.mealType,
      customName,
      items: [{ kind: "food", foodId: v.foodId, grams: v.grams, quantity: v.quantity, unit: v.unit, source: "barcode" }],
    });
    revalidatePath(`/app/diario/${v.localDate}`);
    revalidatePath("/app/diario");
    revalidatePath("/app");
    return ok({ itemIds, localDate: v.localDate, mealLabel: mealDisplayName(v.mealType, customName) });
  } catch (error) {
    if (error instanceof LogItemsError) {
      if (error.code === "NOT_FOUND") return fail("NOT_FOUND", "Este producto ya no está disponible. Vuelve a escanearlo.");
      if (error.code === "VALIDATION") return fail("VALIDATION", "Revisa la cantidad y la comida elegidas.");
      return fail("DB_ERROR", "No pudimos guardar el registro. Inténtalo de nuevo.");
    }
    console.error("barcode_log_failed", { reason: error instanceof Error ? error.message : "unknown" });
    return fail("UNKNOWN", "No pudimos guardar el registro. Inténtalo de nuevo.");
  }
}
