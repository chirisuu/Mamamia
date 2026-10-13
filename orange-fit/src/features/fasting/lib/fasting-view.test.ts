import { describe, expect, it } from "vitest";
import { durationHours, formatClock, formatHours, protocolLabel, reachedTarget, resolveTargetHours } from "./fasting-view";

describe("fasting-view", () => {
  it("horas de cada protocolo y personalizado 8–24 h en pasos de 0.5", () => {
    expect(resolveTargetHours("12:12", null)).toBe(12);
    expect(resolveTargetHours("16:8", 30)).toBe(16);
    expect(resolveTargetHours("18:6", null)).toBe(18);
    expect(resolveTargetHours("custom", 13.5)).toBe(13.5);
    expect(resolveTargetHours("custom", 24)).toBe(24);
    expect(resolveTargetHours("custom", 7.5)).toBeNull();
    expect(resolveTargetHours("custom", 25)).toBeNull();
    expect(resolveTargetHours("custom", 13.25)).toBeNull();
    expect(resolveTargetHours("custom", null)).toBeNull();
  });

  it("formatos de tiempo", () => {
    expect(formatHours(16)).toBe("16 h");
    expect(formatHours(13.5)).toBe("13 h 30 min");
    expect(formatHours(0.75)).toBe("45 min");
    expect(formatClock(3_725_000)).toBe("01:02:05");
    expect(formatClock(-5)).toBe("00:00:00");
    expect(formatClock(25 * 3_600_000)).toBe("25:00:00");
    expect(protocolLabel("custom", 20)).toBe("Personalizado · 20 h");
    expect(protocolLabel("16:8", 16)).toMatch(/^16:8/);
  });

  it("duración real y meta alcanzada (tolerancia de 1 min)", () => {
    const start = "2026-10-12T20:00:00.000Z";
    expect(durationHours(start, "2026-10-13T12:00:00.000Z")).toBe(16);
    expect(reachedTarget(start, "2026-10-13T11:59:30.000Z", 16)).toBe(true);
    expect(reachedTarget(start, "2026-10-13T10:00:00.000Z", 16)).toBe(false);
  });
});
