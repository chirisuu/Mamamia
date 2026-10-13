"use server";

import { revalidatePath } from "next/cache";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { getProfile, requireUser } from "@/lib/auth/session";
import { hasFeature } from "@/lib/billing/entitlements";
import { addDays, DEFAULT_TIMEZONE, todayInTz } from "@/lib/dates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LogItemsError } from "@/features/diary/server/log-items";
import { getPlannerContext } from "./queries";
import {
  addRecipeToPlanSchema,
  logPlanItemSchema,
  planIdSchema,
  planStatusSchema,
  savePlanSchema,
  sharePlanSchema,
  type AddRecipeToPlanInput,
  type LogPlanItemInput,
  type PlanStatusInput,
  type SavePlanInput,
} from "./schemas";
import { addRecipeToPlan, deletePlan, logPlanItem, PlanOpError, revokeShare, savePlan, setPlanStatus, sharePlan } from "./server/plans";

/**
 * Server Actions del planificador. Además de sesión + Zod + RLS, verifican en el servidor que el
 * plan de la persona incluya la función Premium (no basta con ocultar la UI).
 */

const PREMIUM_REQUIRED = fail("PREMIUM_REQUIRED", "Los planes de comidas son parte de Premium.");

function toFailure(error: unknown, action: string): ActionResult<never> {
  if (error instanceof PlanOpError || error instanceof LogItemsError) return fail(error.code, error.message);
  console.error(`[planner] ${action} falló`, error instanceof Error ? error.name : typeof error);
  return fail("UNEXPECTED", "Algo salió mal. Inténtalo de nuevo.");
}

async function context() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  return { user, supabase };
}

function revalidatePlans(planId?: string) {
  revalidatePath("/app/plan");
  if (planId) revalidatePath(`/app/plan/${planId}`);
}

export async function savePlanAction(input: SavePlanInput): Promise<ActionResult<{ id: string; itemsCount: number }>> {
  const { user, supabase } = await context();
  const parsed = savePlanSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, "Revisa los datos del plan.");
  if (!(await hasFeature("meal_plans"))) return PREMIUM_REQUIRED;
  try {
    const profile = await getProfile();
    const today = todayInTz(profile?.timezone ?? DEFAULT_TIMEZONE);
    const ctx = await getPlannerContext(supabase, user.id, today);
    const saved = await savePlan(supabase, user.id, parsed.data, { autoPlansBlocked: ctx.autoPlansBlocked });
    revalidatePlans(saved.id);
    revalidatePath("/app/compras", "layout");
    return ok(saved);
  } catch (error) {
    return toFailure(error, "savePlan");
  }
}

export async function setPlanStatusAction(input: PlanStatusInput): Promise<ActionResult<{ archivedOthers: number }>> {
  const { user, supabase } = await context();
  const parsed = planStatusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!(await hasFeature("meal_plans"))) return PREMIUM_REQUIRED;
  try {
    const res = await setPlanStatus(supabase, user.id, parsed.data.planId, parsed.data.status);
    revalidatePlans(parsed.data.planId);
    return ok(res);
  } catch (error) {
    return toFailure(error, "setPlanStatus");
  }
}

/** Borrar un plan propio no exige Premium: la persona siempre puede borrar sus datos. */
export async function deletePlanAction(input: { planId: string }): Promise<ActionResult<null>> {
  const { user, supabase } = await context();
  const parsed = planIdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await deletePlan(supabase, user.id, parsed.data.planId);
    revalidatePlans();
    revalidatePath("/app/compras", "layout");
    return ok(null);
  } catch (error) {
    return toFailure(error, "deletePlan");
  }
}

export async function sharePlanAction(input: { planId: string; consent: boolean }): Promise<ActionResult<{ token: string }>> {
  const { user, supabase } = await context();
  const parsed = sharePlanSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error, "Confirma que entiendes quién podrá ver el plan.");
  if (!(await hasFeature("meal_plans"))) return PREMIUM_REQUIRED;
  try {
    const res = await sharePlan(supabase, user.id, parsed.data.planId);
    revalidatePlans(parsed.data.planId);
    return ok(res);
  } catch (error) {
    return toFailure(error, "sharePlan");
  }
}

/** Revocar siempre está permitido (aunque ya no tenga Premium). */
export async function revokeShareAction(input: { planId: string }): Promise<ActionResult<null>> {
  const { user, supabase } = await context();
  const parsed = planIdSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await revokeShare(supabase, user.id, parsed.data.planId);
    revalidatePlans(parsed.data.planId);
    return ok(null);
  } catch (error) {
    return toFailure(error, "revokeShare");
  }
}

export async function addRecipeToPlanAction(input: AddRecipeToPlanInput): Promise<ActionResult<{ planId: string }>> {
  const { user, supabase } = await context();
  const parsed = addRecipeToPlanSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!(await hasFeature("meal_plans"))) return PREMIUM_REQUIRED;
  try {
    const res = await addRecipeToPlan(supabase, user.id, parsed.data);
    revalidatePlans(res.planId);
    return ok(res);
  } catch (error) {
    return toFailure(error, "addRecipeToPlan");
  }
}

/** Registrar una comida del plan en el diario (registrar es gratis; el plan ya existe). */
export async function logPlanItemAction(input: LogPlanItemInput): Promise<ActionResult<{ localDate: string }>> {
  const { user, supabase } = await context();
  const parsed = logPlanItemSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const profile = await getProfile();
  const today = todayInTz(profile?.timezone ?? DEFAULT_TIMEZONE);
  if (parsed.data.localDate > addDays(today, 1)) {
    return fail("VALIDATION", "Solo puedes registrar hasta mañana.", { localDate: ["Elige una fecha hasta mañana."] });
  }
  try {
    await logPlanItem(supabase, user.id, parsed.data);
    revalidatePath("/app", "layout");
    return ok({ localDate: parsed.data.localDate });
  } catch (error) {
    return toFailure(error, "logPlanItem");
  }
}
