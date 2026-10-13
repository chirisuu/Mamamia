"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { CONSENT_VERSION } from "@/features/auth/consents";
import { mealLabel } from "@/features/diary/lib/day-totals";
import { isAllowedDiaryDate } from "@/features/diary/lib/meal-time";
import { addItemsToMeal, LogItemsError } from "@/features/diary/server/log-items";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { getProfile, requireUser } from "@/lib/auth/session";
import { DEFAULT_TIMEZONE, todayInTz } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { confirmAiItemsSchema, SOURCE_KIND, type ConfirmAiItemsInput } from "./schemas";
import { syncAchievementsSafely } from "@/features/gamification/server/sync";

/**
 * Registra en el diario lo que la persona CONFIRMÓ tras un análisis con IA. Es el único camino
 * de la IA al diario: valida que la solicitud sea suya, haya terminado bien y no se haya
 * registrado antes, y escribe con `addItemsToMeal` (nutrientes desde la base, con procedencia).
 */
export async function confirmAiItemsAction(
  values: ConfirmAiItemsInput,
): Promise<ActionResult<{ localDate: string; mealLabel: string; count: number }>> {
  const user = await requireUser();
  const parsed = confirmAiItemsSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;

  const [supabase, profile] = await Promise.all([createSupabaseServerClient(), getProfile()]);
  const today = todayInTz(profile?.timezone ?? DEFAULT_TIMEZONE);
  if (!isAllowedDiaryDate(input.localDate, today)) return fail("VALIDATION", "Elige una fecha de hoy hacia atrás (o mañana).");

  const { data: request, error } = await supabase
    .from("ai_analysis_requests")
    .select("id, kind, status")
    .eq("id", input.requestId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return fail("DB_ERROR", "No pudimos verificar el análisis. Inténtalo de nuevo.");
  if (!request) return fail("NOT_FOUND", "No encontramos este análisis. Vuelve a intentarlo.");
  if (request.status !== "succeeded") return fail("AI_REQUEST_NOT_READY", "Este análisis no terminó bien; vuelve a analizar.");
  if (request.kind !== SOURCE_KIND[input.source]) return fail("VALIDATION", "El análisis no corresponde a este método de registro.");

  const { count: already, error: countError } = await supabase
    .from("meal_log_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("ai_request_id", input.requestId);
  if (countError) return fail("DB_ERROR", "No pudimos verificar el análisis. Inténtalo de nuevo.");
  if ((already ?? 0) > 0) return fail("ALREADY_LOGGED", "Ya registraste este análisis. Revisa tu diario.");

  // Foto: los gramos son una estimación visual. Texto/voz: la cantidad la dijo la persona y la
  // conversión sale de las porciones de la base; igual se guarda el vínculo con la IA.
  const isPhoto = input.source === "photo_ai";
  const customName = input.mealType === "custom" ? (input.customName ?? null) : null;
  try {
    const res = await addItemsToMeal(supabase, user.id, {
      localDate: input.localDate,
      mealType: input.mealType,
      customName,
      items: input.items.map((item) => ({
        kind: "food" as const,
        foodId: item.foodId,
        grams: item.grams,
        quantity: item.quantity,
        unit: item.unit,
        source: input.source,
        aiRequestId: input.requestId,
        confidence: isPhoto && item.origin === "ai" && item.confidence != null ? item.confidence : undefined,
        isEstimate: isPhoto && item.origin === "ai",
      })),
    });
    revalidatePath("/app", "layout");
    after(() => syncAchievementsSafely(supabase, user.id, today));
    return ok({ localDate: input.localDate, mealLabel: mealLabel(input.mealType, customName), count: res.itemIds.length });
  } catch (e) {
    if (e instanceof LogItemsError) return fail(e.code, e.message);
    console.error("[ai] confirmAiItems falló", e instanceof Error ? e.name : typeof e);
    return fail("UNEXPECTED", "Algo salió mal. No se registró nada; inténtalo de nuevo.");
  }
}

/**
 * Otorga el consentimiento de IA desde las pantallas de registro o el asistente (mismo historial
 * que Privacidad: nueva fila en `consents`). Se puede retirar en /app/perfil/privacidad.
 */
export async function grantAiConsentAction(): Promise<ActionResult<null>> {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("consents").insert({
    user_id: user.id,
    consent_type: "ai_processing",
    version: CONSENT_VERSION,
    granted: true,
    granted_at: new Date().toISOString(),
    revoked_at: null,
  });
  if (error) return fail("DB_ERROR", "No pudimos guardar tu autorización. Inténtalo de nuevo.");
  revalidatePath("/app/agregar", "layout");
  revalidatePath("/app/asistente");
  revalidatePath("/app/perfil/privacidad");
  return ok(null);
}
