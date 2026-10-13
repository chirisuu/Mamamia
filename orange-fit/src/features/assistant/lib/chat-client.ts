/**
 * Cliente del chat en streaming: envía el mensaje y entrega los eventos NDJSON a medida que llegan.
 * Los errores previos al streaming (401/403/429/503…) llegan como `AiApiError`.
 */
import { AiApiError, readApiError } from "@/features/ai/lib/api-client";
import { ChatStreamParser, type ChatStreamMessage } from "./stream-protocol";

export async function streamChat(
  body: { conversationId: string | null; message: string },
  onEvent: (event: ChatStreamMessage) => void,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new AiApiError(0, "NETWORK", "No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.");
  }
  if (!res.ok) throw await readApiError(res);
  if (!res.body) throw new AiApiError(0, "NETWORK", "No recibimos respuesta. Inténtalo de nuevo.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const parser = new ChatStreamParser();
  let ended = false;
  const emit = (events: ChatStreamMessage[]) => {
    for (const event of events) {
      if (event.type === "done" || event.type === "error") ended = true;
      onEvent(event);
    }
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      emit(parser.push(decoder.decode(value, { stream: true })));
    }
    emit(parser.push(decoder.decode()));
    emit(parser.flush());
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new AiApiError(0, "NETWORK", "Se cortó la conexión. La respuesta no se guardó; inténtalo de nuevo.");
  }
  if (!ended) throw new AiApiError(0, "NETWORK", "Se cortó la conexión. La respuesta no se guardó; inténtalo de nuevo.");
}
