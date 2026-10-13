import { describe, expect, it } from "vitest";
import { quotaPeriodStart, zonedMidnightUtc } from "./period";

describe("mes de cupo en la zona del perfil (igual que consume_ai_quota)", () => {
  it("Lima (UTC−5): el mes empieza a las 05:00 UTC del día 1", () => {
    expect(zonedMidnightUtc("2026-10-01", "America/Lima").toISOString()).toBe("2026-10-01T05:00:00.000Z");
  });

  it("el 1 de noviembre a las 02:00 UTC todavía es octubre en Lima", () => {
    const res = quotaPeriodStart(new Date("2026-11-01T02:00:00Z"), "America/Lima");
    expect(res.localDate).toBe("2026-10-01");
    expect(res.instant.toISOString()).toBe("2026-10-01T05:00:00.000Z");
  });

  it("zona con horario de verano (Madrid, octubre en UTC+2)", () => {
    expect(zonedMidnightUtc("2026-10-01", "Europe/Madrid").toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(quotaPeriodStart(new Date("2026-11-15T12:00:00Z"), "Europe/Madrid").instant.toISOString()).toBe("2026-10-31T23:00:00.000Z");
  });
});
