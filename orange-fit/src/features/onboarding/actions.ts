"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { OnboardingSubmission } from "./schemas";
import { restoreHealthConsent, saveOnboarding } from "./server/save";

/**
 * Guarda el onboarding (perfil, objetivo, meta, consentimientos y peso inicial) y lleva a /app.
 * Solo devuelve algo si falla: con éxito redirige.
 */
export async function completeOnboarding(submission: OnboardingSubmission): Promise<ActionResult<never>> {
  const user = await requireUser("/onboarding");
  const supabase = await createSupabaseServerClient();
  const result = await saveOnboarding(supabase, user.id, submission);
  if (!result.ok) return result;
  revalidatePath("/app", "layout");
  redirect("/app");
}

/** Vuelve a autorizar el tratamiento de datos de salud y reactiva el acceso a la app. */
export async function grantHealthConsentAgain(): Promise<ActionResult<never>> {
  const user = await requireUser("/onboarding");
  const supabase = await createSupabaseServerClient();
  const result = await restoreHealthConsent(supabase, user.id);
  if (!result.ok) return result;
  revalidatePath("/app", "layout");
  redirect("/app");
}
