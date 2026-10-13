import { describe, expect, it } from "vitest";
import { logTargetQuery, resolveLogTarget } from "./log-target";

describe("resolveLogTarget", () => {
  const today = "2026-10-13";

  it("sin parámetros: hoy y la comida según la hora", () => {
    expect(resolveLogTarget({}, today, 8)).toEqual({ localDate: today, mealType: "breakfast", customName: null, isToday: true });
    expect(resolveLogTarget({}, today, 13).mealType).toBe("lunch");
  });

  it("respeta fecha y comida válidas", () => {
    expect(resolveLogTarget({ fecha: "2026-10-10", comida: "dinner" }, today, 8)).toEqual({
      localDate: "2026-10-10",
      mealType: "dinner",
      customName: null,
      isToday: false,
    });
    expect(resolveLogTarget({ fecha: "2026-10-14" }, today, 8).localDate).toBe("2026-10-14");
  });

  it("ignora fechas futuras lejanas y comidas desconocidas", () => {
    expect(resolveLogTarget({ fecha: "2026-10-20", comida: "brunch" }, today, 20)).toMatchObject({
      localDate: today,
      mealType: "dinner",
    });
    expect(resolveLogTarget({ fecha: ["2026-10-11", "x"] }, today, 20).localDate).toBe("2026-10-11");
  });

  it("comida personalizada con nombre", () => {
    expect(resolveLogTarget({ comida: "custom", nombre: " Post entreno " }, today, 9)).toMatchObject({
      mealType: "custom",
      customName: "Post entreno",
    });
    expect(resolveLogTarget({ comida: "custom" }, today, 9).mealType).toBe("breakfast");
  });

  it("query string de ida y vuelta", () => {
    expect(logTargetQuery({ localDate: today, mealType: "lunch", customName: null })).toBe("fecha=2026-10-13&comida=lunch");
    expect(logTargetQuery({ localDate: today, mealType: "custom", customName: "Media mañana" }, { q: "pan" })).toBe(
      "fecha=2026-10-13&comida=custom&nombre=Media+ma%C3%B1ana&q=pan",
    );
  });
});
