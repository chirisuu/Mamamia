/**
 * Utilidades E2E. Preparan datos con el service role del Supabase LOCAL (nunca remoto) y leen
 * los correos de Mailpit. Las claves salen de `.env.local`; no hay secretos en el código.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

function loadEnvLocal(): Record<string, string> {
  const file = path.resolve(__dirname, "../../.env.local");
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...loadEnvLocal(), ...process.env } as Record<string, string | undefined>;
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY ?? "";

if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(SUPABASE_URL) || !SERVICE_ROLE_KEY) {
  // Estas pruebas crean y borran usuarios: solo contra la instancia local.
  throw new Error("Los E2E necesitan el Supabase local (.env.local con URL local y service role).");
}

export function admin(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function uniqueEmail(label: string): string {
  return `e2e-${label}-${randomUUID().slice(0, 8)}@example.com`;
}

export type E2EUser = { id: string; email: string; password: string };

/** Fecha local de hoy en Lima (YYYY-MM-DD), la zona por defecto de los perfiles. */
export function todayInLima(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
}

type OnboardedOptions = {
  label: string;
  healthFlags?: string[];
  birthDate?: string;
  roles?: string[];
  /** Suscripción Premium activa por 30 días (fila directa en la base, sin pasar por un proveedor). */
  premium?: boolean;
};

/**
 * Usuario confirmado con el onboarding hecho (perfil, objetivo, meta y consentimientos),
 * como lo dejaría `completeOnboarding`. Sirve para probar pantallas sin repetir el asistente.
 */
export async function createOnboardedUser(opts: OnboardedOptions): Promise<E2EUser> {
  const db = admin();
  const email = uniqueEmail(opts.label);
  const password = `Pw-${randomUUID()}`;
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Prueba" },
  });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  const id = data.user.id;
  const risky = (opts.healthFlags ?? []).length > 0;

  const steps = [
    db
      .from("profiles")
      .update({
        display_name: "Prueba",
        birth_date: opts.birthDate ?? "1995-03-10",
        sex: "female",
        height_cm: 165,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("id", id),
    db.from("user_goals").insert({
      user_id: id,
      goal_type: risky ? "maintain" : "lose_fat",
      current_weight_kg: 70,
      target_weight_kg: risky ? 70 : 65,
      weekly_rate_kg: risky ? null : 0.35,
      activity_level: "light",
      health_flags: opts.healthFlags ?? [],
      requires_professional_review: risky,
    }),
    db.from("nutrition_targets").insert({
      user_id: id,
      energy_kcal: 1800,
      protein_g: 120,
      carbs_g: 200,
      fat_g: 60,
      fiber_g: 25,
      water_ml: 2300,
      source: "auto",
      created_by: id,
    }),
    db.from("weight_logs").insert({ user_id: id, weight_kg: 70, local_date: todayInLima() }),
    db.from("consents").insert(
      ["terms", "privacy", "health_data"].map((consent_type) => ({
        user_id: id,
        consent_type,
        version: "2026-10",
        granted: true,
      })),
    ),
  ];
  for (const step of steps) {
    const { error: stepError } = await step;
    if (stepError) throw new Error(`Preparar usuario: ${stepError.message}`);
  }
  if (opts.premium) {
    const now = Date.now();
    const { error: subError } = await db.from("subscriptions").insert({
      user_id: id,
      plan_id: "premium",
      provider: "stripe",
      provider_subscription_id: `e2e_${randomUUID()}`,
      status: "active",
      current_period_start: new Date(now).toISOString(),
      current_period_end: new Date(now + 30 * 86_400_000).toISOString(),
    });
    if (subError) throw new Error(`Suscripción: ${subError.message}`);
  }
  if (opts.roles?.length) {
    const { error: roleError } = await db.from("user_roles").insert(opts.roles.map((role) => ({ user_id: id, role })));
    if (roleError) throw new Error(`Rol: ${roleError.message}`);
  }
  return { id, email, password };
}

export async function deleteUsers(...users: Array<{ id: string } | undefined>): Promise<void> {
  const db = admin();
  for (const user of users) if (user) await db.auth.admin.deleteUser(user.id);
}

export async function deleteUserByEmail(email: string): Promise<void> {
  const db = admin();
  const { data } = await db.auth.admin.listUsers({ perPage: 200 });
  const user = data?.users.find((u) => u.email === email);
  if (user) await db.auth.admin.deleteUser(user.id);
}

export async function login(page: Page, user: { email: string; password: string }, next = "/app"): Promise<void> {
  await page.goto(`/ingresar?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Correo").fill(user.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.waitForURL((url) => url.pathname.startsWith(next));
}

/** Último correo recibido en Mailpit para esa dirección; devuelve el primer enlace a /auth/confirm. */
export async function confirmationLinkFor(to: string, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    if (res.ok) {
      const body = (await res.json()) as { messages?: Array<{ ID: string }> };
      const id = body.messages?.[0]?.ID;
      if (id) {
        const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()) as { HTML?: string; Text?: string };
        const html = (msg.HTML ?? msg.Text ?? "").replace(/&amp;/g, "&");
        const link = /https?:\/\/[^"'\s<>]+\/auth\/confirm\?[^"'\s<>]+/.exec(html)?.[0];
        if (link) return link;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No llegó el correo de confirmación a ${to}`);
}

/** Falla la prueba si la página registra errores de consola o excepciones sin capturar. */
export function trackConsoleErrors(page: Page): () => void {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  return () => expect(errors, errors.join("\n")).toEqual([]);
}
