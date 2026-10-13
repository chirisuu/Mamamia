import { describe, expect, it } from "vitest";
import {
  defaultMealForHour,
  defaultMealNow,
  greetingForHour,
  isAllowedDiaryDate,
  localHourInTz,
  maxDiaryDate,
} from "./meal-time";

describe("defaultMealForHour", () => {
  it.each([
    [4, "breakfast"],
    [7, "breakfast"],
    [10, "breakfast"],
    [11, "lunch"],
    [13, "lunch"],
    [15, "lunch"],
    [16, "snack"],
    [18, "snack"],
    [19, "dinner"],
    [22, "dinner"],
    [23, "snack"],
    [0, "snack"],
    [3, "snack"],
  ] as const)("a las %i h → %s", (hour, meal) => {
    expect(defaultMealForHour(hour)).toBe(meal);
  });

  it("normaliza horas fuera de rango", () => {
    expect(defaultMealForHour(24 + 8)).toBe("breakfast");
    expect(defaultMealForHour(-1)).toBe("snack");
  });
});

describe("localHourInTz", () => {
  it("usa la zona del perfil, no la del servidor", () => {
    // 2026-10-13 03:30 UTC = 22:30 del 12 en Lima (UTC−5).
    const instant = new Date("2026-10-13T03:30:00Z");
    expect(localHourInTz(instant, "America/Lima")).toBe(22);
    expect(localHourInTz(instant, "UTC")).toBe(3);
    expect(localHourInTz(instant, "Asia/Tokyo")).toBe(12);
  });

  it("medianoche es 0, no 24", () => {
    expect(localHourInTz(new Date("2026-10-13T05:00:00Z"), "America/Lima")).toBe(0);
  });

  it("defaultMealNow combina ambas", () => {
    expect(defaultMealNow("America/Lima", new Date("2026-10-13T18:00:00Z"))).toBe("lunch"); // 13 h
    expect(defaultMealNow("America/Lima", new Date("2026-10-14T01:00:00Z"))).toBe("dinner"); // 20 h
  });
});

describe("fechas del diario", () => {
  it("permite el pasado y mañana, no pasado mañana", () => {
    expect(maxDiaryDate("2026-10-13")).toBe("2026-10-14");
    expect(isAllowedDiaryDate("2026-10-13", "2026-10-13")).toBe(true);
    expect(isAllowedDiaryDate("2026-10-14", "2026-10-13")).toBe(true);
    expect(isAllowedDiaryDate("2026-10-15", "2026-10-13")).toBe(false);
    expect(isAllowedDiaryDate("2025-01-01", "2026-10-13")).toBe(true);
    expect(isAllowedDiaryDate("1999-12-31", "2026-10-13")).toBe(false);
    expect(isAllowedDiaryDate("2026-02-30", "2026-10-13")).toBe(false);
    expect(isAllowedDiaryDate("hoy", "2026-10-13")).toBe(false);
  });
});

describe("greetingForHour", () => {
  it("saluda según la hora", () => {
    expect(greetingForHour(7)).toBe("Buenos días");
    expect(greetingForHour(15)).toBe("Buenas tardes");
    expect(greetingForHour(21)).toBe("Buenas noches");
    expect(greetingForHour(2)).toBe("Buenas noches");
  });
});
