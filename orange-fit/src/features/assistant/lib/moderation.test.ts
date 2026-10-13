import { describe, expect, it } from "vitest";
import { moderateUserMessage, normalizeForModeration, SAFE_REPLIES } from "./moderation";

const category = (text: string) => {
  const res = moderateUserMessage(text);
  return res.flagged ? res.category : null;
};

describe("moderación previa del asistente (reglas, sin IA)", () => {
  it("normaliza tildes, signos y mayúsculas", () => {
    expect(normalizeForModeration("¡Me provoqué el VÓMITO!")).toBe("me provoque el vomito");
  });

  it("autolesión → respuesta segura con la Línea 113 y el 106", () => {
    for (const text of ["A veces pienso en el suicidio", "ya no quiero vivir", "quiero hacerme daño", "me quiero morir"]) {
      expect(category(text)).toBe("self_harm");
    }
    const res = moderateUserMessage("no quiero seguir viviendo así, quiero morirme");
    expect(res.flagged && res.reply).toContain("Línea 113, opción 5");
    expect(res.flagged && res.reply).toContain("106");
  });

  it("señales de trastorno alimentario → sin metas de restricción", () => {
    for (const text of [
      "después de comer me provoco el vómito",
      "uso laxantes para bajar de peso",
      "quiero dejar de comer para bajar rápido",
      "voy a dejar de comer",
      "me castigo sin comer cuando me paso",
      "anoche me di un atracón y me siento fatal",
      "me da miedo comer",
    ]) {
      expect(category(text), text).toBe("eating_disorder");
    }
    expect(SAFE_REPLIES.eating_disorder).toMatch(/No voy a darte metas de restricción/);
  });

  it("restricción extrema: menos de 800 kcal al día o ayunos de días", () => {
    expect(category("quiero hacer una dieta de 500 calorías")).toBe("extreme_restriction");
    expect(category("¿puedo comer 600 kcal al día?")).toBe("extreme_restriction");
    expect(category("pienso pasar 3 días sin comer")).toBe("extreme_restriction");
    expect(category("quiero ayunar tres días")).toBe("extreme_restriction");
  });

  it("no marca preguntas normales (evita falsos positivos)", () => {
    for (const text of [
      "¿Cómo llego a mi meta de proteína?",
      "Tuve vómitos por una infección estomacal, ¿qué como?",
      "Quiero dejar de comer pan blanco, ¿con qué lo reemplazo?",
      "¿Es malo no comer nada de azúcar?",
      "Quiero comer algo de 300 kcal en la cena",
      "¿Un yogur de 150 calorías es buen snack?",
      "Me mato entrenando y no bajo, ¿qué hago?",
      "No quiero hacerme daño en la rodilla al correr",
      "Quiero hacerme un batido de proteína",
      "Mi meta es 1800 kcal al día",
      "Me da asco comer hígado, ¿qué otra fuente de hierro hay?",
    ]) {
      expect(category(text), text).toBeNull();
    }
  });
});
