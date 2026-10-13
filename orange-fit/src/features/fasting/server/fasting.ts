import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { getActiveGoal } from "@/lib/data/targets";
import { fastingStats, type FastingStats } from "@/lib/nutrition";
import { fastingEligibility, type FastingEligibility } from "../lib/eligibility";
import { durationHours, reachedTarget, resolveTargetHours, type ProtocolCode } from "../lib/fasting-view";

type Client = SupabaseClient<Database>;

export type FastingOpCode = "RISK_BLOCKED" | "MISSING_DATA" | "ACTIVE_SESSION" | "INVALID_HOURS" | "NOT_FOUND" | "DB_ERROR";

export class FastingOpError extends Error {
  constructor(
    readonly code: FastingOpCode,
    message: string,
  ) {
    super(message);
    this.name = "FastingOpError";
  }
}

export type FastingSession = {
  id: string;
  protocol: string;
  targetHours: number;
  startedAt: string;
  endedAt: string | null;
  status: "active" | "completed" | "cancelled";
  note: string | null;
};

type Row = Pick<Database["public"]["Tables"]["fasting_sessions"]["Row"], "id" | "protocol" | "target_hours" | "started_at" | "ended_at" | "status" | "note">;

const toSession = (r: Row): FastingSession => ({
  id: r.id,
  protocol: r.protocol,
  targetHours: Number(r.target_hours),
  startedAt: r.started_at,
  endedAt: r.ended_at,
  status: r.status,
  note: r.note,
});

const COLUMNS = "id, protocol, target_hours, started_at, ended_at, status, note";

export async function getActiveFast(supabase: Client, userId: string): Promise<FastingSession | null> {
  const { data, error } = await supabase.from("fasting_sessions").select(COLUMNS).eq("user_id", userId).eq("status", "active").maybeSingle();
  if (error) throw new FastingOpError("DB_ERROR", "No pudimos leer tu ayuno.");
  return data ? toSession(data) : null;
}

/** Cribado de riesgo con los datos actuales del servidor (perfil, objetivo activo y último peso). */
export async function getFastingEligibility(supabase: Client, userId: string, today: string): Promise<FastingEligibility> {
  const [profileRes, goal, weightRes, active] = await Promise.all([
    supabase.from("profiles").select("birth_date, sex, height_cm").eq("id", userId).maybeSingle(),
    getActiveGoal(supabase, userId),
    supabase.from("weight_logs").select("weight_kg").eq("user_id", userId).lte("local_date", today).order("local_date", { ascending: false }).limit(1),
    getActiveFast(supabase, userId),
  ]);
  if (profileRes.error || weightRes.error) throw new FastingOpError("DB_ERROR", "No pudimos revisar tu perfil.");
  const w = weightRes.data?.[0]?.weight_kg;
  return fastingEligibility({
    today,
    profile: profileRes.data
      ? { birth_date: profileRes.data.birth_date, sex: profileRes.data.sex, height_cm: profileRes.data.height_cm == null ? null : Number(profileRes.data.height_cm) }
      : null,
    goal: goal ? { goal_type: goal.goal_type, health_flags: goal.health_flags, current_weight_kg: goal.current_weight_kg == null ? null : Number(goal.current_weight_kg) } : null,
    latestWeightKg: w == null ? null : Number(w),
    hasActiveSession: active !== null,
  });
}

export type FastingPageData = {
  active: FastingSession | null;
  history: FastingSession[];
  stats: FastingStats;
  /** Ayunos terminados que llegaron a su meta de horas. */
  reachedCount: number;
};

export async function getFastingPageData(supabase: Client, userId: string): Promise<FastingPageData> {
  const { data, error } = await supabase
    .from("fasting_sessions")
    .select(COLUMNS)
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(200);
  if (error) throw new FastingOpError("DB_ERROR", "No pudimos cargar tus ayunos.");
  const sessions = (data ?? []).map(toSession);
  const valid = sessions.filter((s) => s.status === "active" || s.endedAt != null);
  return {
    active: sessions.find((s) => s.status === "active") ?? null,
    history: sessions.filter((s) => s.status !== "active"),
    stats: fastingStats(valid),
    reachedCount: valid.filter((s) => s.status === "completed" && s.endedAt && reachedTarget(s.startedAt, s.endedAt, s.targetHours)).length,
  };
}

/** Inicia un ayuno si el cribado lo permite (se recalcula aquí; no se confía en el cliente). */
export async function startFasting(
  supabase: Client,
  userId: string,
  input: { protocol: ProtocolCode; customHours: number | null; startedMinutesAgo: number; note: string | null },
  today: string,
  now: Date = new Date(),
): Promise<FastingSession> {
  const eligibility = await getFastingEligibility(supabase, userId, today);
  if (!eligibility.allowed) {
    const code: FastingOpCode =
      eligibility.code === "active_session" ? "ACTIVE_SESSION" : eligibility.code === "missing_data" ? "MISSING_DATA" : "RISK_BLOCKED";
    throw new FastingOpError(code, eligibility.reason ?? "No puedes iniciar un ayuno ahora.");
  }
  const targetHours = resolveTargetHours(input.protocol, input.customHours);
  if (targetHours == null) throw new FastingOpError("INVALID_HOURS", "Elige entre 8 y 24 horas, en pasos de media hora.");
  const startedAt = new Date(now.getTime() - input.startedMinutesAgo * 60_000).toISOString();
  const { data, error } = await supabase
    .from("fasting_sessions")
    .insert({ user_id: userId, protocol: input.protocol, target_hours: targetHours, started_at: startedAt, status: "active", note: input.note || null })
    .select(COLUMNS)
    .single();
  if (error?.code === "23505") throw new FastingOpError("ACTIVE_SESSION", "Ya tienes un ayuno en curso. Termínalo antes de iniciar otro.");
  if (error || !data) throw new FastingOpError("DB_ERROR", "No pudimos iniciar tu ayuno.");
  return toSession(data);
}

async function closeFast(
  supabase: Client,
  userId: string,
  sessionId: string,
  status: "completed" | "cancelled",
  now: Date,
): Promise<FastingSession> {
  const { data, error } = await supabase
    .from("fasting_sessions")
    .update({ status, ended_at: now.toISOString() })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .eq("status", "active")
    .select(COLUMNS);
  if (error) throw new FastingOpError("DB_ERROR", "No pudimos actualizar tu ayuno.");
  const row = data?.[0];
  if (!row) throw new FastingOpError("NOT_FOUND", "Ese ayuno ya no está en curso.");
  return toSession(row);
}

/** Terminar: queda en el historial con su duración real (haya llegado o no a la meta). */
export async function endFasting(
  supabase: Client,
  userId: string,
  sessionId: string,
  now: Date = new Date(),
): Promise<{ session: FastingSession; hours: number; reached: boolean }> {
  const session = await closeFast(supabase, userId, sessionId, "completed", now);
  const endedAt = session.endedAt ?? now.toISOString();
  return { session, hours: durationHours(session.startedAt, endedAt), reached: reachedTarget(session.startedAt, endedAt, session.targetHours) };
}

/** Cancelar: p. ej. si se inició por error. No cuenta en las estadísticas de duración. */
export async function cancelFasting(supabase: Client, userId: string, sessionId: string, now: Date = new Date()): Promise<FastingSession> {
  return closeFast(supabase, userId, sessionId, "cancelled", now);
}
