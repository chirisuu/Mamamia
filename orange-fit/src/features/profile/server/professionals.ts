import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

type Client = SupabaseClient<Database>;

export type PersonInfo = { id: string; email: string | null; displayName: string | null };

const DIRECT_LOOKUP_LIMIT = 50;

/**
 * Busca una cuenta con rol `professional` por correo (cliente admin: Auth no expone correos por
 * la API pública). Solo devuelve profesionales: un correo de alguien sin ese rol da null, igual que
 * uno inexistente, para no revelar quién tiene cuenta.
 */
export async function findProfessionalByEmail(admin: Client, email: string): Promise<PersonInfo | null> {
  const target = email.trim().toLowerCase();
  const { data: roles, error } = await admin.from("user_roles").select("user_id").eq("role", "professional").limit(5000);
  if (error) throw new Error("roles_read_failed");
  const ids = new Set((roles ?? []).map((r) => r.user_id));
  if (ids.size === 0) return null;

  let matchId: string | null = null;
  let matchEmail: string | null = null;
  if (ids.size <= DIRECT_LOOKUP_LIMIT) {
    const users = await Promise.all([...ids].map((id) => admin.auth.admin.getUserById(id)));
    for (const res of users) {
      const u = res.data.user;
      if (u?.email?.toLowerCase() === target) {
        matchId = u.id;
        matchEmail = u.email;
        break;
      }
    }
  } else {
    for (let page = 1; page <= 100 && !matchId; page++) {
      const { data, error: listError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (listError) throw new Error("users_list_failed");
      const found = data.users.find((u) => ids.has(u.id) && u.email?.toLowerCase() === target);
      if (found) {
        matchId = found.id;
        matchEmail = found.email ?? null;
      }
      if (data.users.length < 1000) break;
    }
  }
  if (!matchId) return null;
  const { data: profile } = await admin.from("profiles").select("display_name").eq("id", matchId).maybeSingle();
  return { id: matchId, email: matchEmail, displayName: profile?.display_name ?? null };
}

/** Nombre y correo de cuentas concretas (solo ids ya autorizados por quien llama). */
export async function getPeopleInfo(admin: Client, ids: readonly string[]): Promise<Map<string, PersonInfo>> {
  const unique = [...new Set(ids)].slice(0, 100);
  const out = new Map<string, PersonInfo>();
  if (unique.length === 0) return out;
  const [{ data: profiles }, users] = await Promise.all([
    admin.from("profiles").select("id, display_name").in("id", unique),
    Promise.all(unique.map((id) => admin.auth.admin.getUserById(id))),
  ]);
  const names = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  for (const [i, id] of unique.entries()) {
    out.set(id, { id, email: users[i]?.data.user?.email ?? null, displayName: names.get(id) ?? null });
  }
  return out;
}
