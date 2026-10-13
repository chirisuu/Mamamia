import "server-only";
import type { z } from "zod";
import type { Tables } from "@/lib/db/database.types";
import type { ErrorStatus } from "../lib/labels";
import type { errorStatusSchema } from "../schemas";
import { AdminOpError, dbError, logAdminAction, type Db } from "./db";

export const ERRORS_PER_PAGE = 30;

export type ErrorReportRow = Omit<Tables<"error_reports">, "user_id"> & { hasUser: boolean };

export async function listErrorReports(
  supabase: Db,
  opts: { status?: ErrorStatus | null; route?: string | null; page: number },
): Promise<{ rows: ErrorReportRow[]; total: number; counts: Record<ErrorStatus, number> }> {
  const from = (opts.page - 1) * ERRORS_PER_PAGE;
  let query = supabase
    .from("error_reports")
    .select("id, user_id, message, route, digest, user_agent, status, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + ERRORS_PER_PAGE - 1);
  if (opts.status) query = query.eq("status", opts.status);
  if (opts.route) {
    const term = opts.route.replace(/[%_]/g, "").trim();
    if (term) query = query.ilike("route", `%${term}%`);
  }
  const countFor = (status: ErrorStatus) => supabase.from("error_reports").select("id", { count: "exact", head: true }).eq("status", status);
  const [{ data, count, error }, newCount, triagedCount, resolvedCount] = await Promise.all([query, countFor("new"), countFor("triaged"), countFor("resolved")]);
  if (error) throw dbError(error, "No se pudieron leer los errores.");
  return {
    // El id de la cuenta no se muestra: basta saber si había sesión.
    rows: (data ?? []).map(({ user_id, ...row }) => ({ ...row, hasUser: Boolean(user_id) })),
    total: count ?? 0,
    counts: { new: newCount.count ?? 0, triaged: triagedCount.count ?? 0, resolved: resolvedCount.count ?? 0 },
  };
}

export async function setErrorStatus(supabase: Db, data: z.output<typeof errorStatusSchema>): Promise<void> {
  const { data: saved, error } = await supabase.from("error_reports").update({ status: data.status }).eq("id", data.id).select("id");
  if (error) throw dbError(error, "No se pudo cambiar el estado.");
  if (!saved?.length) throw new AdminOpError("NOT_FOUND", "El reporte no existe.");
  await logAdminAction(supabase, { action: "error_report.status", targetTable: "error_reports", targetId: data.id, metadata: { status: data.status } });
}
