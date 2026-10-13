import { AI_RATE_LIMITS, aiErrorResponse, aiJsonError, enforceAiRateLimit, guardAiRoute, readJson } from "@/features/ai/server/http";
import { getUserTimezone } from "@/features/ai/server/profile";
import { buildAssistantContext } from "@/features/assistant/lib/context";
import { moderateUserMessage } from "@/features/assistant/lib/moderation";
import { CHAT_STREAM_CONTENT_TYPE, encodeChatEvent, type ChatStreamMessage } from "@/features/assistant/lib/stream-protocol";
import { chatRequestSchema } from "@/features/assistant/schemas";
import {
  ChatError,
  deleteConversation,
  deleteMessages,
  getOrCreateConversation,
  loadAssistantContextData,
  loadHistory,
  saveExchange,
} from "@/features/assistant/server/chat";
import { getNutritionAI } from "@/lib/ai/config";
import { AiError, isAiError } from "@/lib/ai/errors";
import { assistantSystemPrompt } from "@/lib/ai/prompts";
import { AiQuotaDeniedError, completeAiRequest, consumeAiQuota, failAiRequest, type AiCompletion } from "@/lib/ai/quota";
import { getAppSettings } from "@/lib/config/app-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const STREAM_HEADERS = {
  "Content-Type": CHAT_STREAM_CONTENT_TYPE,
  "Cache-Control": "private, no-store, no-transform",
  "X-Accel-Buffering": "no",
} as const;

/**
 * POST /api/ai/chat `{ conversationId?, message }` → NDJSON en streaming
 * (ver src/features/assistant/lib/stream-protocol.ts).
 *
 * 1. Guardas (sesión, Premium "assistant", consentimiento, IA configurada) y validación → JSON.
 * 2. Moderación previa por reglas: señales de TCA o autolesión → respuesta segura con recursos,
 *    mensaje marcado, sin llamar al modelo ni consumir cupo.
 * 3. Cupo (`consume_ai_quota('chat')`) → contexto mínimo autorizado → streaming del modelo.
 * 4. Al terminar se guardan pregunta y respuesta y se cierra la solicitud; si el cierre no se
 *    confirma, se borra la respuesta y el cliente la descarta (no se entrega).
 */
export async function POST(request: Request) {
  const guard = await guardAiRoute("chat");
  if (!guard.ok) return guard.response;
  const { supabase, user } = guard;

  const parsed = chatRequestSchema.safeParse(await readJson(request));
  if (!parsed.success) return aiJsonError(400, "VALIDATION", parsed.error.issues[0]?.message ?? "Revisa tu mensaje.");
  const { message } = parsed.data;

  const limited = await enforceAiRateLimit(supabase, AI_RATE_LIMITS.chat.bucket, AI_RATE_LIMITS.chat.max, AI_RATE_LIMITS.chat.window);
  if (limited) return limited;

  const askedAt = new Date();
  let conversation: Awaited<ReturnType<typeof getOrCreateConversation>>;
  try {
    conversation = await getOrCreateConversation(supabase, user.id, parsed.data.conversationId, message);
  } catch (error) {
    if (error instanceof ChatError) return aiJsonError(error.code === "NOT_FOUND" ? 404 : 500, error.code, error.message);
    return aiErrorResponse(error);
  }
  const meta: ChatStreamMessage = { type: "meta", conversationId: conversation.id, title: conversation.title };

  // 2. Moderación previa: respuesta segura sin modelo.
  const moderation = moderateUserMessage(message);
  if (moderation.flagged) {
    try {
      const saved = await saveExchange(supabase, user.id, conversation.id, {
        userText: message,
        assistantText: moderation.reply,
        flagged: true,
        askedAt,
      });
      const events: ChatStreamMessage[] = [
        meta,
        { type: "delta", text: moderation.reply },
        { type: "done", messageId: saved.assistantMessageId, userMessageId: saved.userMessageId, flagged: true, quota: null },
      ];
      return new Response(events.map(encodeChatEvent).join(""), { status: 200, headers: STREAM_HEADERS });
    } catch {
      if (conversation.created) await deleteConversation(supabase, user.id, conversation.id);
      return aiJsonError(500, "DB_ERROR", "No pudimos guardar la conversación. Inténtalo de nuevo.");
    }
  }

  const ai = getNutritionAI();
  if (!ai) return aiJsonError(503, "AI_NOT_CONFIGURED", new AiError("AI_NOT_CONFIGURED").message);

  // 3. Cupo, historial y contexto.
  let requestId: string;
  let quota: { used: number; limit: number };
  let system: string;
  let turns: Awaited<ReturnType<typeof loadHistory>>["turns"];
  try {
    const reservation = await consumeAiQuota(supabase, "chat");
    if (!reservation.allowed || !reservation.requestId) throw new AiQuotaDeniedError(reservation);
    requestId = reservation.requestId;
    quota = { used: reservation.used, limit: reservation.limit };
  } catch (error) {
    if (conversation.created) await deleteConversation(supabase, user.id, conversation.id);
    return aiErrorResponse(error);
  }
  try {
    const timezone = await getUserTimezone(supabase, user.id);
    const [history, data, settings] = await Promise.all([
      loadHistory(supabase, user.id, conversation.id),
      loadAssistantContextData(supabase, user.id, timezone),
      getAppSettings(),
    ]);
    turns = history.turns;
    const safety = {
      eatingDisorderHistory: data.eatingDisorderHistory,
      professionalReview: data.professionalReview,
      flaggedConversation: history.flagged,
      deficitBlocked: data.deficitBlocked,
      fastingBlocked: data.fastingBlocked,
    };
    const context = buildAssistantContext({
      today: data.today,
      goalType: data.goalType,
      targets: data.targets,
      consumed: data.consumed,
      quota,
      safety,
    });
    system = `${assistantSystemPrompt(settings.appName)}\n\n${context}`;
  } catch (error) {
    await failAiRequest(supabase, requestId, error, { provider: ai.provider });
    if (conversation.created) await deleteConversation(supabase, user.id, conversation.id);
    return aiErrorResponse(error instanceof ChatError ? new AiError("AI_PROVIDER_ERROR", { message: error.message }) : error);
  }

  // 4. Streaming.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatStreamMessage) => {
        try {
          controller.enqueue(encoder.encode(encodeChatEvent(event)));
        } catch {
          // El cliente ya se fue: se sigue para cerrar la solicitud correctamente.
        }
      };
      const cleanupNewConversation = async () => {
        if (conversation.created) await deleteConversation(supabase, user.id, conversation.id);
      };
      send(meta);
      try {
        let finalText: string | null = null;
        let finalMeta: AiCompletion | null = null;
        for await (const event of ai.chatStream({ system, messages: [...turns, { role: "user", content: message }] }, { signal: request.signal })) {
          if (event.type === "text") send({ type: "delta", text: event.text });
          else {
            finalText = event.text;
            finalMeta = {
              status: "succeeded",
              provider: event.meta.provider,
              model: event.meta.model,
              tokensInput: event.meta.inputTokens,
              tokensOutput: event.meta.outputTokens,
              estimatedCostUsd: event.meta.estimatedCostUsd,
              latencyMs: event.meta.latencyMs,
            };
          }
        }
        if (finalText == null || !finalMeta) throw new AiError("AI_INVALID_OUTPUT");
        const saved = await saveExchange(supabase, user.id, conversation.id, {
          userText: message,
          assistantText: finalText,
          flagged: false,
          askedAt,
        });
        const closed = await completeAiRequest(supabase, requestId, {
          ...finalMeta,
          // Sin el texto de la conversación (ya está en assistant_messages): solo referencias.
          output: { conversation_id: conversation.id, assistant_message_id: saved.assistantMessageId, chars: finalText.length },
        });
        if (!closed) {
          await deleteMessages(supabase, user.id, [saved.userMessageId, saved.assistantMessageId]);
          await cleanupNewConversation();
          const err = new AiError("AI_REQUEST_CLOSED");
          send({ type: "error", code: err.code, message: err.message });
        } else {
          send({ type: "done", messageId: saved.assistantMessageId, userMessageId: saved.userMessageId, flagged: false, quota });
        }
      } catch (error) {
        const aiError = isAiError(error)
          ? error
          : error instanceof ChatError
            ? new AiError("AI_PROVIDER_ERROR", { message: error.message })
            : new AiError("AI_PROVIDER_ERROR");
        await failAiRequest(supabase, requestId, aiError, { provider: ai.provider });
        await cleanupNewConversation();
        send({ type: "error", code: aiError.code, message: aiError.message });
      } finally {
        try {
          controller.close();
        } catch {
          // ya cerrado
        }
      }
    },
  });
  return new Response(stream, { status: 200, headers: STREAM_HEADERS });
}
