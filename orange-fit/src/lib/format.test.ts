import { describe, expect, it } from "vitest";
import { formatInstantDate } from "./format";

describe("formatInstantDate", () => {
  it("usa la zona indicada, no la del proceso (servidor UTC y navegador en Lima pintan lo mismo)", () => {
    // 03:50 UTC del 14 es todavía el 13 en Lima.
    expect(formatInstantDate("2026-10-14T03:50:00Z")).toBe("13 oct 2026");
    expect(formatInstantDate("2026-10-14T03:50:00Z", "UTC")).toBe("14 oct 2026");
  });
});
