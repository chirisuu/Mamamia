/**
 * La imagen OG se genera de verdad (next/og + Geist del paquete `geist`) y es un PNG de 1200×630.
 * Con OG_PREVIEW_DIR=/ruta se guarda una copia para revisarla a ojo.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/app-settings", () => ({
  getAppSettings: async () => ({ appName: "ORANGE FIT", supportEmail: null, featureFlags: {}, defaultTrialDays: 7, maintenanceBanner: null }),
}));

describe("opengraph-image", () => {
  it("genera un PNG 1200×630 con la fuente Geist", async () => {
    const mod = await import("@/app/opengraph-image");
    expect(mod.size).toEqual({ width: 1200, height: 630 });
    expect(mod.contentType).toBe("image/png");

    const response = await mod.default();
    const buffer = Buffer.from(await response.arrayBuffer());
    // Firma PNG y dimensiones del encabezado IHDR.
    expect(buffer.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(buffer.readUInt32BE(16)).toBe(1200);
    expect(buffer.readUInt32BE(20)).toBe(630);

    const previewDir = process.env.OG_PREVIEW_DIR;
    if (previewDir) fs.writeFileSync(path.join(previewDir, "opengraph-image.png"), buffer);
  }, 30_000);
});
