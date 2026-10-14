/**
 * Capturas REALES de la app para la landing y el manifest (public/screenshots/*.png).
 *
 * Uso: con Supabase local y la app compilada corriendo (`npm run build && npm run start`):
 *   npx tsx scripts/capture-screenshots.ts            # BASE_URL=http://localhost:3000 por defecto
 *
 * Crea una cuenta de demostración en el Supabase LOCAL, registra comidas desde la interfaz (mismo
 * camino que una persona: buscador → porción → agregar), genera un plan con el planificador real,
 * toma las capturas a 390×844 (×2) y borra la cuenta. Solo escribe en `AVAILABLE_SCREENSHOTS` las
 * capturas que realmente tomó: la de «foto con IA» necesita una clave de Anthropic y una foto real, así
 * que sin ellas queda como «Captura en preparación» en la landing (nunca un resultado inventado).
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { chromium, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "screenshots");
const LIST_FILE = path.join(ROOT, "src", "features", "marketing", "screenshots.available.ts");
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

function loadEnv(): Record<string, string> {
  const file = path.join(ROOT, ".env.local");
  const out: Record<string, string> = {};
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return { ...out, ...(process.env as Record<string, string>) };
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY ?? "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(SUPABASE_URL) || !SERVICE_ROLE) {
  // Crea y borra una cuenta: nunca contra un proyecto remoto.
  throw new Error("Este script solo corre contra el Supabase local (.env.local con URL local y service role).");
}
const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
function daysAgo(n: number): string {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function createDemoUser(): Promise<{ id: string; email: string; password: string }> {
  const email = `demo-capturas-${randomUUID().slice(0, 8)}@example.com`;
  const password = `Pw-${randomUUID()}`;
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: "Lucía" } });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  const id = data.user.id;
  const now = Date.now();
  // Peso de las últimas 5 semanas: bajada suave con el ruido normal de un día a otro (determinista).
  const weights = Array.from({ length: 35 }, (_, i) => {
    const day = 34 - i;
    const trend = 68.4 - (i * 1.6) / 34;
    const noise = Math.sin(i * 1.7) * 0.35 + Math.cos(i * 0.9) * 0.15;
    return { user_id: id, local_date: daysAgo(day), weight_kg: Math.round((trend + noise) * 10) / 10 };
  }).filter((_, i) => i % 2 === 0 || i > 28);
  const steps = [
    db.from("profiles").update({ display_name: "Lucía", birth_date: "1996-04-12", sex: "female", height_cm: 162, onboarding_completed_at: new Date().toISOString() }).eq("id", id),
    db.from("user_goals").insert({ user_id: id, goal_type: "lose_fat", current_weight_kg: 68.4, target_weight_kg: 62, weekly_rate_kg: 0.3, activity_level: "light", meals_per_day: 4 }),
    db.from("nutrition_targets").insert({ user_id: id, energy_kcal: 1750, protein_g: 115, carbs_g: 190, fat_g: 58, fiber_g: 25, water_ml: 2200, source: "auto", created_by: id, effective_from: daysAgo(40) }),
    db.from("weight_logs").insert(weights),
    db.from("water_logs").insert([
      { user_id: id, local_date: today, amount_ml: 500, logged_at: new Date(now - 4 * 3600_000).toISOString() },
      { user_id: id, local_date: today, amount_ml: 750, logged_at: new Date(now - 1 * 3600_000).toISOString() },
    ]),
    db.from("consents").insert(["terms", "privacy", "health_data"].map((consent_type) => ({ user_id: id, consent_type, version: "2026-10", granted: true }))),
    db.from("subscriptions").insert({
      user_id: id,
      plan_id: "premium",
      provider: "stripe",
      provider_subscription_id: `demo_${randomUUID()}`,
      status: "active",
      current_period_start: new Date(now).toISOString(),
      current_period_end: new Date(now + 30 * 86_400_000).toISOString(),
    }),
  ];
  for (const step of steps) {
    const { error: stepError } = await step;
    if (stepError) throw new Error(`Preparar la cuenta de demostración: ${stepError.message}`);
  }
  return { id, email, password };
}

/** Registra un alimento como lo haría una persona: buscador → primera coincidencia → porción por defecto. */
async function logFood(page: Page, meal: string, query: string, pick: RegExp): Promise<void> {
  await page.goto(`${BASE_URL}/app/agregar/buscar?comida=${meal}`);
  await page.getByLabel("Buscar alimento").fill(query);
  const result = page.getByRole("region", { name: "Resultados" }).getByRole("button").filter({ hasText: pick }).first();
  await result.waitFor({ state: "visible", timeout: 15_000 });
  await result.click();
  await page.getByRole("button", { name: /^Agregar a / }).click();
  await page.getByText(/^Agregado a /).first().waitFor({ timeout: 15_000 });
}

async function shoot(page: Page, key: string): Promise<void> {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(600); // animaciones de entrada (150–250 ms) y anillos
  await page.screenshot({ path: path.join(OUT_DIR, `${key}.png`), fullPage: false });
  console.log(`✓ ${key}.png`);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const user = await createDemoUser();
  const executablePath = fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
  const browser = await chromium.launch({ executablePath });
  const taken: string[] = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: "es-PE",
      timezoneId: "America/Lima",
      colorScheme: "light",
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/ingresar?next=%2Fapp`);
    await page.getByLabel("Correo").fill(user.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Ingresar", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/app");

    await logFood(page, "breakfast", "avena", /Avena/);
    await logFood(page, "breakfast", "plátano", /Plátano de seda/);
    await logFood(page, "lunch", "arroz con pollo", /Arroz con pollo/);
    await logFood(page, "lunch", "palta", /^Palta/);
    await logFood(page, "snack", "huevo sancochado", /Huevo sancochado/);

    await page.goto(`${BASE_URL}/app`);
    await shoot(page, "inicio");
    taken.push("inicio");

    await page.goto(`${BASE_URL}/app/diario`);
    await shoot(page, "diario");
    taken.push("diario");

    await page.goto(`${BASE_URL}/app/plan/nuevo`);
    await page.getByRole("button", { name: "Generar plan" }).click();
    await page.getByRole("button", { name: "Guardar plan" }).waitFor({ timeout: 15_000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await shoot(page, "plan");
    taken.push("plan");

    await page.goto(`${BASE_URL}/app/progreso`);
    // El gráfico de peso (lo que describe la landing), no el formulario de registro que va arriba.
    await page.getByRole("heading", { name: "Tu peso" }).evaluate((el) => {
      const card = el.closest("section, [data-slot='card']") ?? el;
      window.scrollTo(0, card.getBoundingClientRect().top + window.scrollY - 84); // bajo el encabezado fijo
    });
    await shoot(page, "progreso");
    taken.push("progreso");

    await context.close();
  } finally {
    await browser.close();
    await db.auth.admin.deleteUser(user.id);
  }

  const list = taken.map((k) => `"${k}"`).join(", ");
  fs.writeFileSync(
    LIST_FILE,
    `// Generado por scripts/capture-screenshots.ts: capturas reales que ya existen en public/screenshots/.
// No editar a mano; vuelve a correr el script cuando cambien las pantallas.
import type { ScreenshotKey } from "./content";

export const AVAILABLE_SCREENSHOTS: readonly ScreenshotKey[] = [${list}];
`,
  );
  console.log(`Lista actualizada: ${taken.join(", ")}. «foto-ia» queda pendiente (necesita IA real).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
