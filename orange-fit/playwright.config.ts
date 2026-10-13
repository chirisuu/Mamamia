import fs from "node:fs";
import { defineConfig } from "@playwright/test";

/**
 * E2E contra la app compilada (`next build` previo) y el Supabase LOCAL (correo en Mailpit).
 * El puerto es 3000 porque `site_url` de supabase/config.toml apunta ahí: los enlaces de los
 * correos de confirmación vuelven a esa URL.
 */
const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_URL = `http://localhost:${PORT}`;

// En entornos con un Chromium del sistema (p. ej. contenedores CI) se usa ese binario;
// si no existe, Playwright usa el suyo (`npx playwright install chromium`).
const systemChromium = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const executablePath = fs.existsSync(systemChromium) ? systemChromium : undefined;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL: BASE_URL,
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "es-PE",
    timezoneId: "America/Lima",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
