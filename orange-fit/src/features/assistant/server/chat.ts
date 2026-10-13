import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveGoal, getActiveTargets } from "@/lib/data/targets";
import type { ChatTurn } from "@/lib/ai/provider";
import type { Database } from "@/lib/db/database.types";
import { ageOn, isIsoDate, localDateInTz } from "@/lib/dates";
import { assistantRiskBlocks, type AssistantContextInput, type GoalTypeValue } from "../lib/context";

type Client = SupabaseClient<Database>;

/** Mensajes previos que se envían al modelo (los más recientes). */
export const HISTORY_LIMIT = 20;
const TITLE_MAX = 60;

export class ChatError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "DB_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "ChatError";
  }
}

export function conversationTitle(firstMessage: string): string {
  const text = firstMessage.replace(/\s+/g, " ").trim();
  return text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX - 1).trimEnd()}…` : text;
}

/** Conversación propia existente o una nueva (título = inicio del primer mensaje). */
export async function getOrCreateConversation(
  supabase: Client,
  userId: string,
  conversationId: string | null | undefined,
  firstMessage: string,
): Promise<{ id: string; title: string | null; created: boolean }> {
  if (conversationId) {
    const { data, error } = await supabase
      .from("assistant_conversations")
      .select("id, title")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new ChatError("DB_ERROR", "No pudimos abrir la conversación.");
    if (!data) throw new ChatError("NOT_FOUND", "No encontramos esa conversación.");
    return { id: data.id, title: data.title, created: false };
  }
  const title = conversationTitle(firstMessage);
  const { data, error } = await supabase
    .from("assistant_conversations")
    .insert({ user_id: userId, title })
    .select("id, title")
    .single();
  if (error || !data) throw new ChatError("DB_ERROR", "No pudimos crear la conversación.");
  return { id: data.id, title: data.title, created: true };
}

export async function deleteConversation(supabase: Client, userId: string, conversationId: string): Promise<void> {
  await supabase.from("assistant_conversations").delete().eq("id", conversationId).eq("user_id", userId);
}

/**
 * Historial para el modelo: los últimos mensajes en orden, alternando persona/asistente y
 * empezando por la persona (requisito de la API). Indica si hubo algún mensaje marcado.
 */
export async function loadHistory(
  supabase: Client,
  userId: string,
  conversationId: string,
  limit = HISTORY_LIMIT,
): Promise<{ turns: ChatTurn[]; flagged: boolean }> {
  const [{ data, error }, { count, error: flaggedError }] = await Promise.all([
    supabase
      .from("assistant_messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("assistant_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId)
      .eq("user_id", userId)
      .eq("flagged", true),
  ]);
  if (error || flaggedError) throw new ChatError("DB_ERROR", "No pudimos leer la conversación.");
  return { turns: normalizeTurns((data ?? []).reverse()), flagged: (count ?? 0) > 0 };
}

/** Une turnos seguidos del mismo rol y descarta respuestas sueltas al inicio. Puro. */
export function normalizeTurns(rows: ReadonlyArray<{ role: string; content: string }>): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const row of rows) {
    const role = row.role === "assistant" ? "assistant" : "user";
    const content = row.content.trim();
    if (!content) continue;
    if (turns.length === 0 && role === "assistant") continue;
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.content = `${last.content}\n\n${content}`;
    else turns.push({ role, content });
  }
  return turns;
}

/**
 * Guarda la pregunta y la respuesta juntas (al final, para no dejar preguntas sin respuesta si
 * algo falla). Marca de tiempo explícita para que el orden sea estable.
 */
export async function saveExchange(
  supabase: Client,
  userId: string,
  conversationId: string,
  exchange: { userText: string; assistantText: string; flagged: boolean; askedAt: Date },
): Promise<{ userMessageId: string; assistantMessageId: string }> {
  const answeredAt = new Date(Math.max(Date.now(), exchange.askedAt.getTime() + 1));
  const { data, error } = await supabase
    .from("assistant_messages")
    .insert([
      {
        conversation_id: conversationId,
        user_id: userId,
        role: "user",
        content: exchange.userText,
        flagged: exchange.flagged,
        created_at: exchange.askedAt.toISOString(),
      },
      {
        conversation_id: conversationId,
        user_id: userId,
        role: "assistant",
        content: exchange.assistantText.slice(0, 20000),
        flagged: false,
        created_at: answeredAt.toISOString(),
      },
    ])
    .select("id, role");
  if (error || !data || data.length !== 2) throw new ChatError("DB_ERROR", "No pudimos guardar la conversación.");
  // Actualiza `updated_at` (trigger) para ordenar la lista de conversaciones.
  await supabase.from("assistant_conversations").update({ updated_at: answeredAt.toISOString() }).eq("id", conversationId).eq("user_id", userId);
  return {
    userMessageId: data.find((m) => m.role === "user")!.id,
    assistantMessageId: data.find((m) => m.role === "assistant")!.id,
  };
}

export async function deleteMessages(supabase: Client, userId: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await supabase.from("assistant_messages").delete().in("id", ids).eq("user_id", userId);
}

const GOALS: readonly GoalTypeValue[] = ["lose_fat", "gain_muscle", "maintain", "recomposition", "improve_habits"];

/** Datos mínimos autorizados para el contexto del asistente (todo con el cliente de la persona: RLS). */
export async function loadAssistantContextData(
  supabase: Client,
  userId: string,
  timezone: string,
): Promise<
  Omit<AssistantContextInput, "quota" | "safety"> & {
    eatingDisorderHistory: boolean;
    professionalReview: boolean;
    deficitBlocked: boolean;
    fastingBlocked: boolean;
  }
> {
  const today = localDateInTz(new Date(), timezone);
  const [targets, goal, totals, profile, weight] = await Promise.all([
    getActiveTargets(supabase, userId, today),
    getActiveGoal(supabase, userId),
    supabase
      .from("daily_nutrition_totals")
      .select("energy_kcal, protein_g, carbs_g, fat_g, fiber_g, items_count")
      .eq("user_id", userId)
      .eq("local_date", today)
      .maybeSingle(),
    // Solo para el cribado de riesgo (no se envía al modelo).
    supabase.from("profiles").select("birth_date, height_cm").eq("id", userId).maybeSingle(),
    supabase.from("weight_logs").select("weight_kg").eq("user_id", userId).order("local_date", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const t = totals.data;
  const goalType = goal && (GOALS as readonly string[]).includes(goal.goal_type) ? (goal.goal_type as GoalTypeValue) : null;
  const birthDate = profile.data?.birth_date ?? null;
  const blocks = assistantRiskBlocks({
    ageYears: birthDate && isIsoDate(birthDate) ? ageOn(birthDate, today) : null,
    heightCm: profile.data?.height_cm == null ? null : Number(profile.data.height_cm),
    weightKg: weight.data?.weight_kg == null ? (goal?.current_weight_kg == null ? null : Number(goal.current_weight_kg)) : Number(weight.data.weight_kg),
    healthFlags: goal?.health_flags ?? [],
    goalType,
  });
  return {
    today,
    goalType,
    targets: targets
      ? {
          energyKcal: Number(targets.energy_kcal),
          proteinG: Number(targets.protein_g),
          carbsG: Number(targets.carbs_g),
          fatG: Number(targets.fat_g),
          fiberG: targets.fiber_g == null ? null : Number(targets.fiber_g),
          waterMl: targets.water_ml == null ? null : Number(targets.water_ml),
        }
      : null,
    consumed: t
      ? {
          energyKcal: Math.round(Number(t.energy_kcal ?? 0)),
          proteinG: Math.round(Number(t.protein_g ?? 0)),
          carbsG: Math.round(Number(t.carbs_g ?? 0)),
          fatG: Math.round(Number(t.fat_g ?? 0)),
          fiberG: t.fiber_g == null ? null : Math.round(Number(t.fiber_g)),
          itemsCount: Number(t.items_count ?? 0),
        }
      : null,
    eatingDisorderHistory: Boolean(goal?.health_flags?.includes("eating_disorder_history")),
    professionalReview: Boolean(goal?.requires_professional_review),
    deficitBlocked: blocks.deficitBlocked,
    fastingBlocked: blocks.fastingBlocked,
  };
}
