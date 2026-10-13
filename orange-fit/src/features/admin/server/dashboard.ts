import "server-only";
import { parseAdminMetrics, parseAiUsage, type AdminMetrics, type AiUsage } from "../lib/metrics";
import { dbError, rpcUntyped, type Db } from "./db";

export type WorkQueues = {
  foodsUnverified: number;
  recipesPending: number;
  contentDrafts: number;
  errorsNew: number;
};

/** Pendientes del equipo editorial (conteos, sin datos personales). */
export async function getWorkQueues(supabase: Db): Promise<WorkQueues> {
  const head = { count: "exact" as const, head: true };
  const [foods, recipes, content, errors] = await Promise.all([
    supabase.from("foods").select("id", head).eq("is_public", true).eq("verification_status", "unverified"),
    supabase.from("recipes").select("id", head).eq("status", "pending_review"),
    supabase.from("content_pages").select("id", head).eq("status", "draft"),
    supabase.from("error_reports").select("id", head).eq("status", "new"),
  ]);
  const failed = foods.error ?? recipes.error ?? content.error ?? errors.error;
  if (failed) throw dbError(failed, "No se pudieron leer los pendientes.");
  return {
    foodsUnverified: foods.count ?? 0,
    recipesPending: recipes.count ?? 0,
    contentDrafts: content.count ?? 0,
    errorsNew: errors.count ?? 0,
  };
}

/** `admin_metrics()` (exige admin en la base). */
export async function getAdminMetrics(supabase: Db): Promise<AdminMetrics> {
  const { data, error } = await supabase.rpc("admin_metrics");
  if (error) throw dbError(error, "No se pudieron leer las métricas.");
  return parseAdminMetrics(data);
}

/** `admin_ai_usage(months)`: agregados por mes, tipo, modelo y estado (exige admin en la base). */
export async function getAiUsage(supabase: Db, months: number): Promise<AiUsage> {
  const { data, error } = await rpcUntyped<unknown>(supabase, "admin_ai_usage", { months });
  if (error) throw dbError(error, "No se pudo leer el uso de IA.");
  return parseAiUsage(data);
}
