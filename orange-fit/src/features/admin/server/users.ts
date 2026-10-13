import "server-only";
import type { User } from "@supabase/supabase-js";
import type { z } from "zod";
import type { AppRole } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";
import type { setUserRoleSchema } from "../schemas";
import { AdminOpError, dbError, logAdminAction, type Db } from "./db";

export const USERS_PER_PAGE = 25;

/** Lo único que el panel muestra de una cuenta: sin nombre, sin datos de salud. */
export type AdminUserRow = {
  id: string;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  plan: "free" | "premium";
  planStatus: string | null;
  roles: AppRole[];
};

export type AdminUserPage = { users: AdminUserRow[]; total: number; page: number; perPage: number };

type AuthUserLite = Pick<User, "id" | "email" | "created_at" | "last_sign_in_at">;

/**
 * Lista de cuentas con la API admin de Auth (service role). Sin filtro usa `auth.admin.listUsers`;
 * con filtro por correo usa el mismo endpoint (`GET /auth/v1/admin/users`) con `filter`, que
 * supabase-js aún no expone. Solo se toman id, correo y fechas.
 */
export async function listAuthUsers(admin: Db, opts: { page: number; perPage: number; email?: string | null }): Promise<{ users: AuthUserLite[]; total: number }> {
  const page = Math.max(1, Math.floor(opts.page));
  const perPage = Math.min(Math.max(1, Math.floor(opts.perPage)), 100);
  const email = opts.email?.trim().toLowerCase().slice(0, 120) ?? "";
  const pick = (u: AuthUserLite): AuthUserLite => ({ id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at });

  if (!email) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new AdminOpError("AUTH_ERROR", "No se pudo leer la lista de usuarios.");
    const total = "total" in data && typeof data.total === "number" ? data.total : data.users.length;
    return { users: data.users.map(pick), total };
  }

  const key = serverEnv().SUPABASE_SERVICE_ROLE_KEY;
  const base = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !base) throw new AdminOpError("NOT_CONFIGURED", "La gestión de usuarios está pendiente de configurar (falta SUPABASE_SERVICE_ROLE_KEY).");
  const url = new URL(`${base.replace(/\/+$/, "")}/auth/v1/admin/users`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("filter", email);
  let res: Response;
  try {
    res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new AdminOpError("AUTH_ERROR", "No se pudo conectar con el servicio de cuentas.");
  }
  if (!res.ok) throw new AdminOpError("AUTH_ERROR", "No se pudo buscar usuarios.");
  const body = (await res.json()) as { users?: AuthUserLite[] };
  const users = (body.users ?? []).map(pick);
  const total = Number(res.headers.get("x-total-count"));
  return { users, total: Number.isFinite(total) ? total : users.length };
}

/** Plan vigente por usuario: suscripción trialing/active con fecha de fin futura (o sin fecha). */
export function planFromSubscriptions(
  subs: Array<{ status: string; trial_end: string | null; current_period_end: string | null }>,
  now: Date = new Date(),
): { plan: "free" | "premium"; status: string | null } {
  for (const s of subs) {
    if (s.status !== "trialing" && s.status !== "active") continue;
    const end = s.status === "trialing" ? (s.trial_end ?? s.current_period_end) : s.current_period_end;
    if (!end || new Date(end) > now) return { plan: "premium", status: s.status };
  }
  return { plan: "free", status: subs[0]?.status ?? null };
}

/**
 * Página de usuarios con plan y roles. `admin` es el cliente service role (ya autorizado con
 * requireRole('admin')); plan y roles se leen con la sesión del admin (RLS lo permite).
 */
export async function listAdminUsers(supabase: Db, admin: Db, opts: { page: number; email?: string | null }): Promise<AdminUserPage> {
  const { users, total } = await listAuthUsers(admin, { page: opts.page, perPage: USERS_PER_PAGE, email: opts.email });
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return { users: [], total, page: opts.page, perPage: USERS_PER_PAGE };

  const [{ data: roles, error: rolesError }, { data: subs, error: subsError }] = await Promise.all([
    supabase.from("user_roles").select("user_id, role").in("user_id", ids),
    supabase
      .from("subscriptions")
      .select("user_id, status, trial_end, current_period_end, created_at")
      .in("user_id", ids)
      .order("created_at", { ascending: false }),
  ]);
  if (rolesError || subsError) throw dbError(rolesError ?? subsError, "No se pudieron leer planes y roles.");

  return {
    users: users.map((u) => {
      const plan = planFromSubscriptions((subs ?? []).filter((s) => s.user_id === u.id));
      return {
        id: u.id,
        email: u.email ?? null,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        plan: plan.plan,
        planStatus: plan.status,
        roles: (roles ?? []).filter((r) => r.user_id === u.id).map((r) => r.role),
      };
    }),
    total,
    page: opts.page,
    perPage: USERS_PER_PAGE,
  };
}

/**
 * Otorga o quita un rol (editor, admin, professional). Escribe con la sesión del superadmin:
 * el RLS de user_roles también exige superadmin. `superadmin` no se toca desde el panel.
 */
export async function setUserRole(supabase: Db, actorId: string, data: z.output<typeof setUserRoleSchema>): Promise<{ changed: boolean }> {
  if (data.grant) {
    const { data: existing, error: readError } = await supabase.from("user_roles").select("role").eq("user_id", data.userId).eq("role", data.role);
    if (readError) throw dbError(readError, "No se pudo leer el rol.");
    if (existing?.length) return { changed: false };
    const { error } = await supabase.from("user_roles").insert({ user_id: data.userId, role: data.role, granted_by: actorId });
    if (error) {
      if (error.code === "23503") throw new AdminOpError("NOT_FOUND", "La cuenta no existe.");
      if (error.code === "23505") return { changed: false };
      throw dbError(error, "No se pudo otorgar el rol.");
    }
  } else {
    const { data: deleted, error } = await supabase.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role).select("role");
    if (error) throw dbError(error, "No se pudo quitar el rol.");
    if (!deleted?.length) return { changed: false };
  }
  await logAdminAction(supabase, {
    action: data.grant ? "user_role.grant" : "user_role.revoke",
    targetTable: "user_roles",
    targetId: data.userId,
    metadata: { role: data.role },
  });
  return { changed: true };
}
