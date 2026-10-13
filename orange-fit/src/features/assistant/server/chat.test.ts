import { describe, expect, it } from "vitest";
import { conversationTitle, normalizeTurns } from "./chat";

describe("historial para el modelo", () => {
  it("empieza por la persona, alterna roles y une mensajes seguidos del mismo rol", () => {
    expect(
      normalizeTurns([
        { role: "assistant", content: "respuesta suelta" },
        { role: "user", content: "hola" },
        { role: "user", content: "¿sigues?" },
        { role: "assistant", content: "  sí  " },
        { role: "user", content: "   " },
      ]),
    ).toEqual([
      { role: "user", content: "hola\n\n¿sigues?" },
      { role: "assistant", content: "sí" },
    ]);
  });

  it("título de la conversación: inicio del primer mensaje (máx. 60)", () => {
    expect(conversationTitle("  ¿Cómo   llego a mi meta?  ")).toBe("¿Cómo llego a mi meta?");
    const long = conversationTitle("a".repeat(100));
    expect(long).toHaveLength(60);
    expect(long.endsWith("…")).toBe(true);
  });
});
