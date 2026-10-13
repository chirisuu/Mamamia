import { redirect } from "next/navigation";
import { SetupRequired } from "@/components/setup-required";
import { getProfile, getUser } from "@/lib/auth/session";
import { getAppSettings } from "@/lib/config/app-settings";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { firstParam, type SearchParams } from "@/features/auth/server/config";
import { OnboardingClient } from "@/features/onboarding/components/onboarding-client";
import { healthConsentRevoked, loadSavedAnswers } from "@/features/onboarding/queries";
import type { DraftAnswers } from "@/features/onboarding/schemas";

/**
 * Onboarding: funciona sin sesión (respuestas en localStorage) y con sesión. Con el onboarding ya
 * completo lleva a /app, salvo `?rehacer=1` (actualizar objetivo desde Metas).
 */
export default async function OnboardingPage({ searchParams }: { searchParams: SearchParams }) {
  const { appName } = await getAppSettings();
  if (!isSupabaseConfigured()) return <SetupRequired appName={appName} />;
  const params = await searchParams;
  const redoRequested = firstParam(params, "rehacer") === "1";

  const user = await getUser();
  let serverAnswers: DraftAnswers = {};
  let reconsent = false;
  let redo = false;

  if (user) {
    const profile = await getProfile();
    const completed = Boolean(profile?.onboarding_completed_at);
    if (completed && !redoRequested) redirect("/app");
    redo = completed && redoRequested;
    const supabase = await createSupabaseServerClient();
    const saved = await loadSavedAnswers(supabase, user, profile);
    serverAnswers = saved.answers;
    reconsent = !completed && Boolean(saved.goal) && (await healthConsentRevoked(supabase, user.id));
  }

  return (
    <OnboardingClient
      appName={appName}
      isAuthenticated={Boolean(user)}
      accountEmail={user?.email ?? null}
      serverAnswers={serverAnswers}
      redo={redo}
      reconsent={reconsent}
    />
  );
}
