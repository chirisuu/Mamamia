/**
 * Protocolo del chat en streaming (POST /api/ai/chat): NDJSON, un evento JSON por línea.
 *   meta  → conversación (nueva o existente)
 *   delta → trozo de texto de la respuesta (provisional hasta "done")
 *   done  → la respuesta quedó guardada (id del mensaje)
 *   error → la respuesta no vale: el cliente descarta el texto parcial (p. ej. negativa del modelo)
 * Puro: lo usan el servidor y el cliente.
 */
import type { AiQuotaDto } from "@/features/ai/schemas";

export type ChatStreamMessage =
  | { type: "meta"; conversationId: string; title: string | null }
  | { type: "delta"; text: string }
  | { type: "done"; messageId: string; userMessageId: string; flagged: boolean; quota: AiQuotaDto | null }
  | { type: "error"; code: string; message: string };

export const CHAT_STREAM_CONTENT_TYPE = "application/x-ndjson; charset=utf-8";

export function encodeChatEvent(event: ChatStreamMessage): string {
  return `${JSON.stringify(event)}\n`;
}

function isChatStreamMessage(value: unknown): value is ChatStreamMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  switch (v.type) {
    case "meta":
      return typeof v.conversationId === "string";
    case "delta":
      return typeof v.text === "string";
    case "done":
      return typeof v.messageId === "string";
    case "error":
      return typeof v.code === "string" && typeof v.message === "string";
    default:
      return false;
  }
}

/** Parser incremental: recibe trozos de texto (pueden cortar una línea a la mitad). */
export class ChatStreamParser {
  private buffer = "";

  push(chunk: string): ChatStreamMessage[] {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    return lines.flatMap((line) => this.parseLine(line));
  }

  flush(): ChatStreamMessage[] {
    const rest = this.buffer;
    this.buffer = "";
    return this.parseLine(rest);
  }

  private parseLine(line: string): ChatStreamMessage[] {
    const trimmed = line.trim();
    if (!trimmed) return [];
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return isChatStreamMessage(parsed) ? [parsed] : [];
    } catch {
      return [];
    }
  }
}
