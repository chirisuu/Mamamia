import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/db/database.types";
import { getActiveTargets } from "@/lib/data/targets";
import { serverEnv } from "@/lib/server-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { latestConsents, type ConsentRow, type ConsentType } from "@/features/auth/consents";
import { getPeopleInfo, type PersonInfo } from "./server/professionals";

type Client = SupabaseClient<Database>;
export type TargetRow = Tables<"nutrition_targets">;

export async function getConsentState(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from("consents")
    .select("consent_type, granted, granted_at, revoked_at, created_at, version")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error("consents_read_failed");
  return latestConsents((data ?? []) as ConsentRow[]) as Partial<Record<ConsentType, ConsentRow>>;
}

/** Nombres de quienes fijaron metas o tienen acceso. Requiere service role; sin él, mapa vacío. */
export async function peopleInfoIfAvailable(ids: string[]): Promise<Map<string, PersonInfo>> {
  if (ids.length === 0 || !serverEnv().SUPABASE_SERVICE_ROLE_KEY) return new Map();
  try {
    return await getPeopleInfo(createSupabaseAdminClient(), ids);
  } catch {
    return new Map();
  }
}

export async function getTargetsOverview(supabase: Client, userId: string, today: string) {
  const [active, { data: history, error }] = await Promise.all([
    getActiveTargets(supabase, userId, today),
    supabase
      .from("nutrition_targets")
      .select("*")
      .eq("user_id", userId)
      .order("effective_from", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  if (error) throw new Error("targets_read_failed");
  const rows = history ?? [];
  // Solo buscamos nombres de profesionales que fijaron metas de esta persona.
  const proIds = [...new Set(rows.filter((r) => r.source === "professional" && r.created_by).map((r) => r.created_by!))];
  if (active?.source === "professional" && active.created_by && !proIds.includes(active.created_by)) proIds.push(active.created_by);
  const people = await peopleInfoIfAvailable(proIds);
  return { active, history: rows, people };
}

export function personLabel(people: Map<string, PersonInfo>, id: string | null | undefined, fallback = "tu profesional"): string {
  if (!id) return fallback;
  const p = people.get(id);
  return p?.displayName || p?.email || fallback;
}

export async function getAccessOverview(supabase: Client, userId: string) {
  const [granted, received] = await Promise.all([
    supabase
      .from("professional_access")
      .select("id, professional_id, scope, granted_at, revoked_at")
      .eq("user_id", userId)
      .order("granted_at", { ascending: false })
      .limit(50),
    supabase
      .from("professional_access")
      .select("id, user_id, scope, granted_at")
      .eq("professional_id", userId)
      .is("revoked_at", null)
      .order("granted_at", { ascending: false })
      .limit(200),
  ]);
  if (granted.error || received.error) throw new Error("access_read_failed");
  const grantedRows = granted.data ?? [];
  const receivedRows = received.data ?? [];
  const people = await peopleInfoIfAvailable(grantedRows.map((r) => r.professional_id));
  // Como profesional, el nombre de cada paciente se lee con RLS (profiles_select_professional).
  const patientIds = receivedRows.map((r) => r.user_id);
  const { data: patients } = patientIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", patientIds)
    : { data: [] as Array<{ id: string; display_name: string | null }> };
  const patientNames = new Map((patients ?? []).map((p) => [p.id, p.display_name]));
  return { granted: grantedRows, received: receivedRows, people, patientNames };
}
