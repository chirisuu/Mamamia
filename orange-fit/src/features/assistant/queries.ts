import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { AssistantMessageDto, ConversationSummary } from "./schemas";

type Client = SupabaseClient<Database>;

export const UNTITLED_CONVERSATION = "Conversación sin título";

/** Conversaciones propias, la más reciente primero. */
export async function listConversations(supabase: Client, userId: string, limit = 30): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from("assistant_conversations")
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`assistant_conversations: ${error.code ?? "error"}`);
  return (data ?? []).map((c) => ({ id: c.id, title: c.title?.trim() || UNTITLED_CONVERSATION, updatedAt: c.updated_at }));
}

/** Mensajes de una conversación propia (los últimos `limit`, en orden cronológico); null si no existe. */
export async function getConversationMessages(
  supabase: Client,
  userId: string,
  conversationId: string,
  limit = 100,
): Promise<{ conversation: ConversationSummary; messages: AssistantMessageDto[] } | null> {
  const { data: conv, error } = await supabase
    .from("assistant_conversations")
    .select("id, title, updated_at")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`assistant_conversations: ${error.code ?? "error"}`);
  if (!conv) return null;
  const { data: rows, error: msgError } = await supabase
    .from("assistant_messages")
    .select("id, role, content, flagged, created_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (msgError) throw new Error(`assistant_messages: ${msgError.code ?? "error"}`);
  const messages = (rows ?? [])
    .reverse()
    .map((m) => ({
      id: m.id,
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
      flagged: m.flagged,
      createdAt: m.created_at,
    }));
  return {
    conversation: { id: conv.id, title: conv.title?.trim() || UNTITLED_CONVERSATION, updatedAt: conv.updated_at },
    messages,
  };
}
