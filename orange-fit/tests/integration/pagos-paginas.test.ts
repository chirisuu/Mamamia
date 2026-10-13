/**
 * Páginas de pagos renderizadas en el servidor con datos REALES del Supabase local (sin next dev):
 * comprueba que leen el estado verdadero y que nunca muestran "listo" sin una suscripción vigente.
 */
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/database.types";
import { serviceClient, uniqueTag } from "./helpers";

const jar = vi.hoisted(() => ({ current: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [...jar.current].map(([name, value]) => ({ name, value })),
    get: (name: string) => (jar.current.has(name) ? { name, value: jar.current.get(name)! } : undefined),
    set: () => undefined,
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  usePathname: () => "/precios",
  useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const envFile = fileURLToPath(new URL("../../.env.local", import.meta.url));
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
delete process.env.STRIPE_SECRET_KEY;
delete process.env.STRIPE_WEBHOOK_SECRET;
delete process.env.MERCADOPAGO_ACCESS_TOKEN;
delete process.env.MERCADOPAGO_WEBHOOK_SECRET;

async function sessionCookies(label: string) {
  const admin = serviceClient();
  const email = `it-pagos-pag-${label}-${uniqueTag()}@example.com`;
  const password = `Pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  const cookies = new Map<string, string>();
  const client = createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (list) => {
        for (const { name, value } of list) {
          if (value) cookies.set(name, value);
          else cookies.delete(name);
        }
      },
    },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn: ${signInError.message}`);
  return { id: data.user.id, cookies };
}

const html = async (node: Promise<React.ReactElement> | React.ReactElement) => renderToStaticMarkup(await node);
const sp = (v: Record<string, string> = {}) => ({ searchParams: Promise.resolve(v) });
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

describe("páginas de pagos (render de servidor con datos reales)", () => {
  const admin = serviceClient();
  const ids: string[] = [];
  let free: { id: string; cookies: Map<string, string> };
  let premium: { id: string; cookies: Map<string, string> };

  beforeAll(async () => {
    free = await sessionCookies("free");
    premium = await sessionCookies("premium");
    ids.push(free.id, premium.id);
    const { data: price } = await admin.from("plan_prices").select("id").eq("plan_id", "premium").eq("currency_code", "PEN").eq("interval", "month").eq("is_active", true).single();
    const { data: sub, error } = await admin
      .from("subscriptions")
      .insert({
        user_id: premium.id,
        plan_id: "premium",
        price_id: price!.id,
        provider: "mercadopago",
        provider_subscription_id: `pre_it_${uniqueTag()}`,
        status: "active",
        current_period_start: new Date().toISOString(),
        current_period_end: inDays(20),
      })
      .select("id")
      .single();
    if (error) throw error;
    const pay = await admin.from("payments").insert({
      user_id: premium.id,
      subscription_id: sub.id,
      provider: "mercadopago",
      provider_payment_id: `ap_it_${uniqueTag()}`,
      amount_cents: 2990,
      currency_code: "PEN",
      status: "succeeded",
      paid_at: new Date().toISOString(),
    });
    if (pay.error) throw pay.error;
  });

  afterAll(async () => {
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  });

  it("/precios: Gratis vs Premium con montos de plan_prices, ahorro y pagos pendientes de configurar", async () => {
    jar.current = new Map();
    const { default: PricingPage } = await import("@/app/precios/page");
    const out = await html(PricingPage());
    expect(out).toContain("Planes y precios");
    expect(out).toContain("S/ 29.90");
    expect(out).toContain("Anual · ahorra 44 %");
    expect(out).toContain("Registro con foto e IA");
    expect(out).toContain("Compara los planes");
    expect(out).toContain("¿Guardan los datos de mi tarjeta?");
    // Sin claves: el botón de Premium aparece deshabilitado y lo explica.
    expect(out).toContain("Los pagos en línea están pendientes de configurar");
    expect(out).toMatch(/<button[^>]*disabled[^>]*>Elegir Premium<\/button>/);
  });

  it("/app/premium sin suscripción: elige medio de pago, deshabilitado sin claves; aviso de pago cancelado", async () => {
    jar.current = free.cookies;
    const { default: PremiumPage } = await import("@/app/app/premium/page");
    const out = await html(PremiumPage(sp({ cancelado: "1" })));
    expect(out).toContain("No se completó el pago");
    expect(out).toContain("Elige cómo pagar");
    expect(out).toContain("Pagos pendientes de configurar");
    expect(out).toContain("Mercado Pago");
    expect(out).not.toContain("Ya tienes Premium");
  });

  it("/app/premium con Premium vigente: muestra su estado, no el checkout", async () => {
    jar.current = premium.cookies;
    const { default: PremiumPage } = await import("@/app/app/premium/page");
    const out = await html(PremiumPage(sp()));
    expect(out).toContain("Ya tienes Premium");
    expect(out).toContain("Próximo cobro");
    expect(out).not.toContain("Elige cómo pagar");
  });

  it("/app/premium/gracias: sin suscripción → 'estamos confirmando'; con suscripción → 'listo'", async () => {
    const { default: ThanksPage } = await import("@/app/app/premium/gracias/page");
    jar.current = free.cookies;
    const waiting = await html(ThanksPage(sp({ provider: "stripe", session_id: "cs_test_abcdefghij" })));
    expect(waiting).toContain("Estamos confirmando tu pago");
    expect(waiting).not.toContain("Listo, ya tienes Premium");

    jar.current = premium.cookies;
    const done = await html(ThanksPage(sp({ provider: "mercadopago" })));
    expect(done).toContain("Listo, ya tienes Premium");
  });

  it("/app/perfil/suscripcion: estado, precio, próximo cobro, cancelar (deshabilitado sin claves) e historial", async () => {
    const { default: SubscriptionPage } = await import("@/app/app/perfil/suscripcion/page");
    jar.current = premium.cookies;
    const out = await html(SubscriptionPage());
    expect(out).toContain("Activa");
    expect(out).toContain("S/ 29.90 al mes");
    expect(out).toContain("Próximo cobro");
    expect(out).toMatch(/<button[^>]*disabled[^>]*>Cancelar renovación<\/button>/);
    expect(out).toContain("pendientes de configurar en el servidor");
    expect(out).toContain("Ver mi suscripción en Mercado Pago");
    expect(out).toContain("Historial de pagos");
    expect(out).toContain("Pagado");

    jar.current = free.cookies;
    const empty = await html(SubscriptionPage());
    expect(empty).toContain("Estás en el plan gratis");
    expect(empty).toContain("Aún no hay cobros");
  });

  it("sin sesión, las páginas privadas redirigen al ingreso", async () => {
    jar.current = new Map();
    const { default: SubscriptionPage } = await import("@/app/app/perfil/suscripcion/page");
    await expect(SubscriptionPage()).rejects.toThrow("REDIRECT:/ingresar?next=%2Fapp%2Fperfil%2Fsuscripcion");
  });
});
