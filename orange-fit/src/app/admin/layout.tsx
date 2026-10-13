import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { SetupRequired } from "@/components/setup-required";
import { getRoles, hasRole, requireRole } from "@/lib/auth/session";
import { getAppSettings } from "@/lib/config/app-settings";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

/** Panel admin: solo staff (editor o superior). Sin rol responde 404 para no revelar el panel. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { appName } = await getAppSettings();
  if (!isSupabaseConfigured()) return <SetupRequired appName={appName} />;
  await requireRole("editor");
  const isAdmin = hasRole(await getRoles(), "admin");
  return (
    <AdminShell appName={appName} isAdmin={isAdmin}>
      {children}
    </AdminShell>
  );
}
