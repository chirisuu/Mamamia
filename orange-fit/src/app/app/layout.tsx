import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { SetupRequired } from "@/components/setup-required";
import { getProfile, requireUser } from "@/lib/auth/session";
import { getAppSettings } from "@/lib/config/app-settings";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Área privada del usuario: exige sesión y onboarding completo. */
export default async function UserAppLayout({ children }: { children: React.ReactNode }) {
  const { appName } = await getAppSettings();
  if (!isSupabaseConfigured()) return <SetupRequired appName={appName} />;
  await requireUser("/app");
  const profile = await getProfile();
  if (!profile?.onboarding_completed_at) redirect("/onboarding");
  return <AppShell appName={appName}>{children}</AppShell>;
}
