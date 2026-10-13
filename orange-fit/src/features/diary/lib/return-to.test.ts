import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./return-to";

describe("safeReturnTo", () => {
  it("acepta rutas internas del registro", () => {
    expect(safeReturnTo("/app/agregar/buscar?fecha=2026-10-13&q=pan")).toBe("/app/agregar/buscar?fecha=2026-10-13");
    expect(safeReturnTo("/app/agregar/codigo")).toBe("/app/agregar/codigo");
    expect(safeReturnTo("/app/diario/2026-10-13")).toBe("/app/diario/2026-10-13");
  });

  it("rechaza externas y otras rutas", () => {
    expect(safeReturnTo("https://malo.com")).toBeNull();
    expect(safeReturnTo("//malo.com/app/agregar")).toBeNull();
    expect(safeReturnTo("/\\malo.com")).toBeNull();
    expect(safeReturnTo("/admin")).toBeNull();
    expect(safeReturnTo("/app/agregarx")).toBeNull();
    expect(safeReturnTo(undefined)).toBeNull();
  });
});
