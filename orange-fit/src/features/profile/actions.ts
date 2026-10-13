"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { getRoles, hasRole, requireUser } from "@/lib/auth/session";
import { DEFAULT_TIMEZONE, isValidTimeZone, todayInTz } from "@/lib/dates";
import { serverEnv } from "@/lib/server-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CONSENT_VERSION } from "@/features/auth/consents";
import { ageGate } from "@/features/onboarding/plan";
import { reviewManualTargets } from "./manual-targets";
import {
  accessIdSchema,
  consentToggleSchema,
  grantAccessSchema,
  manualTargetsActionSchema,
  profileFormSchema,
  proposeTargetSchema,
} from "./schemas";
import { findProfessionalByEmail } from "./server/professionals";
import { loadPlanContext, manualContext, previewPlan } from "./server/targets";
import { buildAutoTargetInputs, buildManualTargetInputs } from "./target-inputs";

const DB_ERROR = "No pudimos guardar los cambios. Inténtalo de nuevo en un momento.";

function revalidateProfile() {
  revalidatePath("/app", "layout");
}

/** Datos personales del perfil. */
export async function updateProfile(values: unknown): Promise<ActionResult<null>> {
  const user = await requireUser("/app/perfil/datos");
  const parsed = profileFormSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  if (!isValidTimeZone(v.timezone)) return fail("VALIDATION", "Esa zona horaria no es válida.", { timezone: ["Elige otra zona horaria."] });
  if (v.birthDate) {
    const { gate } = ageGate(v.birthDate, todayInTz(v.timezone));
    if (gate === "too_young") return fail("VALIDATION", "Esta app es para personas de 13 años o más.", { birthDate: ["Revisa la fecha."] });
    if (gate === "invalid" || gate === "too_old") return fail("VALIDATION", "Revisa tu fecha de nacimiento.", { birthDate: ["Revisa la fecha."] });
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: v.displayName,
      birth_date: v.birthDate,
      sex: v.sex,
      height_cm: v.heightCm,
      timezone: v.timezone,
      country_code: v.countryCode,
      currency_code: v.currencyCode,
      count_exercise_calories: v.countExerciseCalories,
    })
    .eq("id", user.id);
  if (error?.code === "22023") return fail("VALIDATION", "Esa zona horaria no es válida.", { timezone: ["Elige otra zona horaria."] });
  if (error) return fail("DB_ERROR", DB_ERROR);
  revalidateProfile();
  return ok(null);
}

/** Nueva meta automática con el peso más reciente (perfil + objetivo activo). */
export async function recalculateTargets(): Promise<ActionResult<{ energyKcal: number }>> {
  const user = await requireUser("/app/perfil/metas");
  const supabase = await createSupabaseServerClient();
  const ctx = await loadPlanContext(supabase, user.id);
  if (!ctx) return fail("NO_PROFILE", "No encontramos tu perfil.");
  const preview = previewPlan(ctx);
  if (!preview.ok) return fail("CANNOT_COMPUTE", preview.reason);
  const t = preview.plan.targets;
  const now = new Date();
  const { error } = await supabase.from("nutrition_targets").insert({
    user_id: user.id,
    effective_from: ctx.today,
    energy_kcal: t.energyKcal,
    protein_g: t.proteinG,
    carbs_g: t.carbsG,
    fat_g: t.fatG,
    fiber_g: t.fiberG,
    water_ml: t.waterMl,
    method: t.method,
    source: "auto",
    created_by: user.id,
    inputs: buildAutoTargetInputs(preview.input, preview.plan, {
      computedAt: now.toISOString(),
      weightSource: preview.weightSource,
      trigger: "recalculation",
    }),
  });
  if (error) return fail("DB_ERROR", DB_ERROR);
  // El objetivo activo guarda el peso de referencia actual.
  if (ctx.goal) {
    await supabase.from("user_goals").update({ current_weight_kg: preview.input.weightKg }).eq("id", ctx.goal.id).eq("user_id", user.id);
  }
  revalidateProfile();
  return ok({ energyKcal: t.energyKcal });
}

/** Meta escrita a mano por la persona: respeta pisos y bloqueos; los avisos se confirman. */
export async function saveManualTargets(values: unknown): Promise<ActionResult<null>> {
  const user = await requireUser("/app/perfil/metas");
  const parsed = manualTargetsActionSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const supabase = await createSupabaseServerClient();
  const ctx = await loadPlanContext(supabase, user.id);
  if (!ctx) return fail("NO_PROFILE", "No encontramos tu perfil.");
  const mctx = manualContext(ctx);
  const review = reviewManualTargets(v, mctx);
  if (review.errors.length > 0) return fail("BLOCKED", review.errors.map((e) => e.message).join(" "));
  if (review.warnings.length > 0 && !v.acknowledgeWarnings) {
    return fail("NEEDS_ACK", "Revisa los avisos y confirma que quieres guardar esta meta.");
  }
  const { error } = await supabase.from("nutrition_targets").insert({
    user_id: user.id,
    effective_from: ctx.today,
    energy_kcal: v.energyKcal,
    protein_g: v.proteinG,
    carbs_g: v.carbsG,
    fat_g: v.fatG,
    fiber_g: v.fiberG,
    water_ml: v.waterMl,
    method: "manual",
    source: "manual",
    created_by: user.id,
    notes: v.notes || null,
    inputs: buildManualTargetInputs({
      kind: "manual",
      computedAt: new Date().toISOString(),
      context: { bmr: mctx.bmr, tdee: mctx.tdee, riskLevel: null },
      warnings: review.warnings.map((w) => w.message),
    }),
  });
  if (error) return fail("DB_ERROR", DB_ERROR);
  revalidateProfile();
  return ok(null);
}

/** Otorga o retira un consentimiento opcional (IA, fotos de progreso, novedades). */
export async function setConsent(values: unknown): Promise<ActionResult<null>> {
  const user = await requireUser("/app/perfil/privacidad");
  const parsed = consentToggleSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();
  const { error } = await supabase.from("consents").insert({
    user_id: user.id,
    consent_type: parsed.data.type,
    version: CONSENT_VERSION,
    granted: parsed.data.granted,
    granted_at: nowIso,
    revoked_at: parsed.data.granted ? null : nowIso,
  });
  if (error) return fail("DB_ERROR", DB_ERROR);
  revalidatePath("/app/perfil/privacidad");
  return ok(null);
}

/**
 * Retira el consentimiento de datos de salud. Sin él la app no puede procesar tus datos de salud:
 * se pausa el acceso (onboarding_completed_at = null) hasta que vuelvas a autorizar en /onboarding.
 * Los datos no se borran: para eso está "Eliminar mi cuenta".
 */
export async function revokeHealthConsent(): Promise<ActionResult<never>> {
  const user = await requireUser("/app/perfil/privacidad");
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();
  const { error } = await supabase.from("consents").insert({
    user_id: user.id,
    consent_type: "health_data",
    version: CONSENT_VERSION,
    granted: false,
    granted_at: nowIso,
    revoked_at: nowIso,
  });
  if (error) return fail("DB_ERROR", DB_ERROR);
  const pause = await supabase.from("profiles").update({ onboarding_completed_at: null }).eq("id", user.id);
  if (pause.error) return fail("DB_ERROR", DB_ERROR);
  revalidateProfile();
  redirect("/onboarding");
}

/** Da acceso a un profesional (cuenta con rol professional) buscándolo por correo. */
export async function grantProfessionalAccess(values: unknown): Promise<ActionResult<{ name: string }>> {
  const user = await requireUser("/app/perfil/profesional");
  const parsed = grantAccessSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.email === user.email?.toLowerCase()) {
    return fail("VALIDATION", "No puedes darte acceso a ti mismo.", { email: ["Usa el correo de tu profesional."] });
  }
  if (!serverEnv().SUPABASE_SERVICE_ROLE_KEY) {
    return fail("NOT_CONFIGURED", "La búsqueda de profesionales está pendiente de configurar en el servidor.");
  }
  const supabase = await createSupabaseServerClient();
  // Límite por persona: evita usar el formulario para averiguar qué correos son de profesionales.
  const { data: allowed, error: rateError } = await supabase.rpc("check_rate_limit", {
    bucket: "pro_access_lookup",
    max_hits: 10,
    window_seconds: 3600,
  });
  if (rateError) return fail("DB_ERROR", DB_ERROR);
  if (!allowed) return fail("RATE_LIMITED", "Hiciste muchas búsquedas en la última hora. Espera un poco e inténtalo de nuevo.");

  let pro;
  try {
    pro = await findProfessionalByEmail(createSupabaseAdminClient(), parsed.data.email);
  } catch {
    return fail("LOOKUP_FAILED", "No pudimos buscar al profesional. Inténtalo de nuevo.");
  }
  if (!pro) {
    return fail("NOT_FOUND", "No encontramos un profesional registrado con ese correo. Pídele que confirme el correo de su cuenta.", {
      email: ["Revisa el correo."],
    });
  }
  const { error } = await supabase
    .from("professional_access")
    .insert({ professional_id: pro.id, user_id: user.id, scope: parsed.data.scope });
  if (error?.code === "23505") return fail("ALREADY_GRANTED", "Esa persona ya tiene acceso. Si quieres cambiar el permiso, revócalo y vuelve a darlo.");
  if (error?.code === "23514") return fail("NOT_PROFESSIONAL", "Esa cuenta ya no tiene rol de profesional.");
  if (error) return fail("DB_ERROR", DB_ERROR);
  revalidatePath("/app/perfil/profesional");
  return ok({ name: pro.displayName ?? pro.email ?? "tu profesional" });
}

export async function revokeProfessionalAccess(values: unknown): Promise<ActionResult<null>> {
  const user = await requireUser("/app/perfil/profesional");
  const parsed = accessIdSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("professional_access")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .select("id");
  if (error) return fail("DB_ERROR", DB_ERROR);
  if (!data || data.length === 0) return fail("NOT_FOUND", "Ese acceso ya no estaba vigente.");
  revalidatePath("/app/perfil/profesional");
  return ok(null);
}

/** El profesional fija una meta (source 'professional') para una persona que le dio acceso de escritura. */
export async function proposeProfessionalTarget(values: unknown): Promise<ActionResult<null>> {
  const user = await requireUser("/app/perfil/profesional");
  const parsed = proposeTargetSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  if (!hasRole(await getRoles(), "professional")) return fail("FORBIDDEN", "Solo los profesionales pueden fijar metas a otras personas.");
  const supabase = await createSupabaseServerClient();
  const { data: access } = await supabase
    .from("professional_access")
    .select("scope")
    .eq("professional_id", user.id)
    .eq("user_id", v.patientId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!access) return fail("FORBIDDEN", "Ya no tienes acceso a esta persona.");
  if (access.scope !== "read_logs_write_targets") return fail("FORBIDDEN", "Esta persona te dio acceso solo para ver.");

  const ctx = await loadPlanContext(supabase, v.patientId);
  const today = ctx?.today ?? todayInTz(DEFAULT_TIMEZONE);
  if (v.effectiveFrom < today) return fail("VALIDATION", "La fecha de inicio no puede ser pasada.", { effectiveFrom: ["Elige hoy o una fecha futura."] });
  const mctx = ctx ? manualContext(ctx) : { sex: null, bmr: null, tdee: null, deficitBlocked: false, cautious: false };
  const review = reviewManualTargets(v, mctx, { byProfessional: true });
  if (review.warnings.length > 0 && !v.acknowledgeWarnings) {
    return fail("NEEDS_ACK", "Revisa los avisos y confirma que quieres fijar esta meta.");
  }
  const { error } = await supabase.from("nutrition_targets").insert({
    user_id: v.patientId,
    effective_from: v.effectiveFrom,
    energy_kcal: v.energyKcal,
    protein_g: v.proteinG,
    carbs_g: v.carbsG,
    fat_g: v.fatG,
    fiber_g: v.fiberG,
    water_ml: v.waterMl,
    method: "professional",
    source: "professional",
    created_by: user.id,
    notes: v.notes || null,
    inputs: buildManualTargetInputs({
      kind: "professional",
      computedAt: new Date().toISOString(),
      context: { bmr: mctx.bmr, tdee: mctx.tdee, riskLevel: null },
      warnings: review.warnings.map((w) => w.message),
    }),
  });
  if (error) return fail("DB_ERROR", "No pudimos guardar la meta. Revisa que sigas teniendo acceso.");
  revalidatePath(`/app/perfil/profesional/pacientes/${v.patientId}`);
  return ok(null);
}
