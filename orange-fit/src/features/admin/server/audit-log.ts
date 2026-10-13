import "server-only";
import { z } from "zod";
import type { Tables } from "@/lib/db/database.types";
import { isIsoDate } from "@/lib/dates";
import { dbError, type Db } from "./db";

export const AUDIT_PER_PAGE = 50;

export type AuditRow = Tables<"admin_audit_logs">;

export const auditFiltersSchema = z.object({
  action: z
    .string()
    .trim()
    .max(100)
    .regex(/^[a-z0-9_.:-]*$/)
    .optional()
    .catch(undefined),
  table: z
    .string()
    .trim()
    .max(60)
    .regex(/^[a-z0-9_.]*$/)
    .optional()
    .catch(undefined),
  actor: z.uuid().optional().catch(undefined),
  from: z.string().refine(isIsoDate).optional().catch(undefined),
  to: z.string().refine(isIsoDate).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type AuditFilters = z.output<typeof auditFiltersSchema>;

/** Fecha local de Lima (YYYY-MM-DD) → instante UTC del inicio de ese día (Lima es UTC−5, sin horario de verano). */
export function limaDayStartUtc(isoDate: string): string {
  return new Date(`${isoDate}T05:00:00.000Z`).toISOString();
}

export async function listAuditLogs(supabase: Db, filters: AuditFilters): Promise<{ rows: AuditRow[]; total: number }> {
  const from = (filters.page - 1) * AUDIT_PER_PAGE;
  let query = supabase
    .from("admin_audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + AUDIT_PER_PAGE - 1);
  if (filters.action) query = query.like("action", `${filters.action}%`);
  if (filters.table) query = query.eq("target_table", filters.table);
  if (filters.actor) query = query.eq("actor_id", filters.actor);
  if (filters.from) query = query.gte("created_at", limaDayStartUtc(filters.from));
  if (filters.to) {
    const next = new Date(limaDayStartUtc(filters.to));
    next.setUTCDate(next.getUTCDate() + 1);
    query = query.lt("created_at", next.toISOString());
  }
  const { data, count, error } = await query;
  if (error) throw dbError(error, "No se pudo leer la auditoría.");
  return { rows: data ?? [], total: count ?? 0 };
}

/** Cuentas del staff (para el filtro por autor y para mostrar su correo). */
export async function listStaff(supabase: Db, admin: Db | null): Promise<Array<{ id: string; email: string | null; roles: string[] }>> {
  const { data, error } = await supabase.from("user_roles").select("user_id, role").in("role", ["editor", "admin", "superadmin"]);
  if (error) throw dbError(error, "No se pudo leer el equipo.");
  const byUser = new Map<string, string[]>();
  for (const r of data ?? []) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role]);
  const ids = [...byUser.keys()].slice(0, 200);
  const emails = new Map<string, string | null>();
  if (admin) {
    await Promise.all(
      ids.map(async (id) => {
        const { data: u } = await admin.auth.admin.getUserById(id);
        emails.set(id, u.user?.email ?? null);
      }),
    );
  }
  return ids
    .map((id) => ({ id, email: emails.get(id) ?? null, roles: byUser.get(id) ?? [] }))
    .sort((a, b) => (a.email ?? a.id).localeCompare(b.email ?? b.id));
}
