import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectInstallState } from "@/components/pwa/install-button";
import { shouldRegisterServiceWorker } from "@/components/pwa/register-sw";
import { PWA_ICONS, buildManifest, shortAppName } from "./pwa";

const PUBLIC_DIR = path.resolve(__dirname, "../../../public");

describe("manifest", () => {
  const manifest = buildManifest("ORANGE FIT");

  it("usa el nombre vigente, abre en /app y en modo standalone", () => {
    expect(manifest).toMatchObject({
      name: "ORANGE FIT",
      short_name: "ORANGE FIT",
      start_url: "/app",
      scope: "/",
      display: "standalone",
      lang: "es-PE",
    });
    expect(manifest.theme_color).toMatch(/^#[0-9A-F]{6}$/i);
    expect(manifest.background_color).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it("declara iconos any y maskable que existen en public/", () => {
    expect(manifest.icons?.some((i) => i.purpose === "maskable" && i.sizes === "512x512")).toBe(true);
    expect(manifest.icons?.some((i) => i.purpose === "any" && i.sizes === "192x192")).toBe(true);
    for (const icon of PWA_ICONS) {
      expect(fs.existsSync(path.join(PUBLIC_DIR, icon.src)), icon.src).toBe(true);
    }
    for (const file of ["icons/apple-touch-icon.png", "icons/badge-96.png", "icons/logo.svg", "favicon.ico", "sw.js", "offline.html"]) {
      expect(fs.existsSync(path.join(PUBLIC_DIR, file)), file).toBe(true);
    }
  });

  it("atajos a registrar comida y agua", () => {
    expect(manifest.shortcuts?.map((s) => s.url)).toEqual(["/app/agregar/buscar", "/app/agua"]);
  });

  it("solo incluye capturas que existen", () => {
    expect(manifest).not.toHaveProperty("screenshots");
    const withShots = buildManifest("X", { inicio: true, diario: false });
    expect(withShots.screenshots?.map((s) => s.src)).toEqual(["/screenshots/inicio.png"]);
    // Tamaño real del PNG que genera scripts/capture-screenshots.ts (390×844 a densidad 2).
    expect(withShots.screenshots?.[0]?.sizes).toBe("780x1688");
  });

  it("short_name corto", () => {
    expect(shortAppName("ORANGE FIT")).toBe("ORANGE FIT");
    expect(shortAppName("Nutrición Integral Lima")).toBe("Nutrición");
    expect(shortAppName("Supercalifragilístico")).toHaveLength(12);
  });
});

describe("instalación y service worker", () => {
  const base = { standalone: false, hasPrompt: false, userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/130", maxTouchPoints: 5 };

  it("detecta el estado de instalación", () => {
    expect(detectInstallState({ ...base, standalone: true, hasPrompt: true })).toBe("installed");
    expect(detectInstallState({ ...base, hasPrompt: true })).toBe("prompt");
    expect(detectInstallState(base)).toBe("unavailable");
    expect(detectInstallState({ ...base, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)" })).toBe("ios");
    // iPadOS se presenta como Mac con pantalla táctil.
    expect(detectInstallState({ ...base, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 5 })).toBe("ios");
    expect(detectInstallState({ ...base, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 0 })).toBe("unavailable");
  });

  it("registra el SW en producción o si se pide explícitamente", () => {
    expect(shouldRegisterServiceWorker({ nodeEnv: "production" })).toBe(true);
    expect(shouldRegisterServiceWorker({ nodeEnv: "development" })).toBe(false);
    expect(shouldRegisterServiceWorker({ nodeEnv: "development", enableSw: "true" })).toBe(true);
    expect(shouldRegisterServiceWorker({ nodeEnv: "test", enableSw: "1" })).toBe(false);
  });
});
