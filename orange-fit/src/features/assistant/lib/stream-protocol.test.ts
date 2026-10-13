import { describe, expect, it } from "vitest";
import { ChatStreamParser, encodeChatEvent, type ChatStreamMessage } from "./stream-protocol";

describe("protocolo NDJSON del chat", () => {
  it("codifica un evento por línea y lo vuelve a leer aunque llegue cortado", () => {
    const events: ChatStreamMessage[] = [
      { type: "meta", conversationId: "c1", title: "Hola" },
      { type: "delta", text: "Hola, " },
      { type: "delta", text: "¿cómo vas?\n¿todo bien?" },
      { type: "done", messageId: "m2", userMessageId: "m1", flagged: false, quota: { used: 3, limit: 400 } },
    ];
    const wire = events.map(encodeChatEvent).join("");
    const parser = new ChatStreamParser();
    const out: ChatStreamMessage[] = [];
    for (let i = 0; i < wire.length; i += 7) out.push(...parser.push(wire.slice(i, i + 7)));
    out.push(...parser.flush());
    expect(out).toEqual(events);
  });

  it("ignora líneas inválidas o de tipo desconocido", () => {
    const parser = new ChatStreamParser();
    expect(parser.push('{"type":"delta"}\nno-json\n{"type":"otro"}\n{"type":"error","code":"AI_REFUSED","message":"x"}\n')).toEqual([
      { type: "error", code: "AI_REFUSED", message: "x" },
    ]);
  });
});
