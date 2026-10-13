import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/lib/db/database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/** Usuario autenticado validado contra el servidor de Auth (no solo la cookie). Cacheado por request. */
export const getUser = cache(async (): Promise<User | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
});

/** Exige sesión; si no hay, redirige al ingreso conservando el destino. */
export async function requireUser(next?: string): Promise<User> {
  const user = await getUser();
  if (!user) redirect(next ? `/ingresar?next=${encodeURIComponent(next)}` : "/ingresar");
  return user;
}

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data;
});

/** Roles del usuario actual (filas propias de user_roles; RLS permite leerlas). */
export const getRoles = cache(async (): Promise<AppRole[]> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  return (data ?? []).map((r) => r.role);
});

const RANK: Record<Exclude<AppRole, "professional">, number> = { editor: 1, admin: 2, superadmin: 3 };

/** ¿Tiene el usuario al menos ese rol? Jerarquía superadmin ⊃ admin ⊃ editor; professional es aparte. */
export function hasRole(roles: AppRole[], required: AppRole): boolean {
  if (required === "professional") return roles.includes("professional");
  const need = RANK[required];
  return roles.some((r) => r !== "professional" && RANK[r] >= need);
}

/** Exige rol de staff. Sin sesión → ingreso; sin rol → 404 para no revelar que existe el panel. */
export async function requireRole(required: AppRole): Promise<User> {
  const user = await requireUser("/admin");
  const roles = await getRoles();
  if (!hasRole(roles, required)) {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return user;
}
