/**
 * Módulo landing contra el Supabase LOCAL:
 * - POST /api/errors real: anónimo (IP reenviada → límite por IP de la BD, 429 al pasar 20/h),
 *   con sesión (user_id de la sesión, nunca del cuerpo) y saneo de ruta/mensaje.
 * - Lecturas del sitio público: FAQ publicadas (los borradores no salen), legales (borrador →
 *   "en preparación") y precios desde plans/plan_prices.
 */
import fs from "node:fs";
import { randomInt, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/database.types";
import { serviceClient, uniqueTag } from "./helpers";

const jar = vi.hoisted(() => ({ current: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [...jar.current].map(([name, value]) => ({ name, value })),
    get: (name: string) => (jar.current.has(name) ? { name, value: jar.current.get(name)! } : undefined),
    set: (name: string, value: string) => {
      if (value) jar.current.set(name, value);
      else jar.current.delete(name);
    },
  }),
}));

const envFile = fileURLToPath(new URL("../../.env.local", import.meta.url));
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const { POST } = await import("@/app/api/errors/route");
const { getLegalDocument, getPricingSummary, getPublishedFaqs, getPublishedLegalSlugs } = await import("@/features/marketing/queries");

const admin = serviceClient();
const tag = `landing-it-${uniqueTag()}`;
// IP de documentación (RFC 5737) única por corrida: su propio contador en rate_limits.
const testIp = `198.51.100.${randomInt(1, 254)}`;
const otherIp = `203.0.113.${randomInt(1, 254)}`;
let user: { id: string; cookies: Map<string, string> } | null = null;
const faqSlugs: string[] = [];

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost:3000/api/errors", {
      method: "POST",
      headers: { "content-type": "application/json", host: "localhost:3000", origin: "http://localhost:3000", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

async function reportsWith(messagePart: string) {
  const { data, error } = await admin.from("error_reports").select("*").like("message", `%${messagePart}%`);
  if (error) throw error;
  return data ?? [];
}

beforeAll(async () => {
  await admin.from("rate_limits").delete().in("key", [`error_reports:ip:${testIp}`, `error_reports:ip:${otherIp}`]);

  const email = `it-landing-${uniqueTag()}@example.com`;
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
  user = { id: data.user.id, cookies };
});

afterAll(async () => {
  await admin.from("error_reports").delete().like("message", `%${tag}%`);
  await admin.from("rate_limits").delete().in("key", [`error_reports:ip:${testIp}`, `error_reports:ip:${otherIp}`]);
  if (user) {
    await admin.from("rate_limits").delete().eq("key", `error_reports:u:${user.id}`);
    await admin.auth.admin.deleteUser(user.id);
  }
  if (faqSlugs.length) await admin.from("content_pages").delete().in("slug", faqSlugs);
});

describe("POST /api/errors (BD real)", () => {
  it("anónimo: guarda sin usuario, con ruta y mensaje saneados", async () => {
    jar.current = new Map();
    const res = await post(
      { message: `Fallo ${tag} de ana@correo.pe`, route: "/compartido/plan/token-secreto?x=1", digest: "4242", user_id: randomUUID() },
      { "x-forwarded-for": testIp, "user-agent": "Vitest/landing" },
    );
    expect(res.status).toBe(201);
    const rows = await reportsWith(`Fallo ${tag}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: null,
      route: "/compartido/plan/[token]",
      digest: "4242",
      user_agent: "Vitest/landing",
      status: "new",
    });
    expect(rows[0]!.message).not.toContain("ana@correo.pe");

    // El límite se contó para la IP del visitante (no para la del servidor de Next).
    const { data: limit } = await admin.from("rate_limits").select("key, count").eq("key", `error_reports:ip:${testIp}`).maybeSingle();
    expect(limit?.count).toBe(1);
  });

  it("anónimo: al pasar 20 reportes por hora desde la misma IP responde 429", async () => {
    jar.current = new Map();
    const statuses: number[] = [];
    // Ya hay 1 del caso anterior: 19 más llegan a 20 y el siguiente se rechaza.
    for (let i = 0; i < 20; i++) {
      const res = await post({ message: `Lote ${tag} #${i}` }, { "x-forwarded-for": testIp });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 19).every((s) => s === 201)).toBe(true);
    expect(statuses[19]).toBe(429);

    // Otra IP sigue pudiendo reportar.
    const other = await post({ message: `Otra IP ${tag}` }, { "x-forwarded-for": otherIp });
    expect(other.status).toBe(201);
  });

  it("con sesión: el user_id sale de la sesión, no del cuerpo", async () => {
    jar.current = new Map(user!.cookies);
    const res = await post({ message: `Con sesión ${tag}`, route: "/app/diario", user_id: randomUUID() }, { "x-forwarded-for": testIp });
    // La IP ya agotó su cupo anónimo, pero con sesión el límite es por usuario.
    expect(res.status).toBe(201);
    const rows = await reportsWith(`Con sesión ${tag}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.user_id).toBe(user!.id);
    expect(rows[0]!.route).toBe("/app/diario");
  });

  it("400 sin mensaje", async () => {
    jar.current = new Map();
    const res = await post({ route: "/" }, { "x-forwarded-for": otherIp });
    expect(res.status).toBe(400);
  });
});

describe("lecturas del sitio público", () => {
  it("FAQ: solo las publicadas, en orden; los borradores no salen", async () => {
    jar.current = new Map();
    const published = `faq-${tag}-pub`;
    const draft = `faq-${tag}-draft`;
    faqSlugs.push(published, draft);
    const { error } = await admin.from("content_pages").insert([
      { slug: published, title: `¿Pregunta publicada ${tag}?`, body_md: "Respuesta **publicada**.", kind: "faq", status: "published", sort_order: 9999 },
      { slug: draft, title: `¿Pregunta borrador ${tag}?`, body_md: "No debe salir.", kind: "faq", status: "draft", sort_order: 9998 },
    ]);
    expect(error).toBeNull();

    const faqs = await getPublishedFaqs();
    expect(faqs.ok).toBe(true);
    if (!faqs.ok) return;
    const slugs = faqs.data.map((f) => f.slug);
    expect(slugs).toContain(published);
    expect(slugs).not.toContain(draft);
    expect(slugs[slugs.length - 1]).toBe(published);

    const { data: dbPublished } = await admin.from("content_pages").select("slug").eq("kind", "faq").eq("status", "published");
    expect(faqs.data).toHaveLength(dbPublished!.length);

    const limited = await getPublishedFaqs(3);
    expect(limited.ok && limited.data.length).toBe(Math.min(3, dbPublished!.length));
  });

  it("legales: borrador → no disponible (nunca se muestra como definitivo); publicado → su texto", async () => {
    jar.current = new Map();
    const { data: rows } = await admin.from("content_pages").select("slug, status, body_md").eq("kind", "legal");
    const publishedSlugs = await getPublishedLegalSlugs();
    for (const slug of ["terminos", "privacidad", "datos-de-salud"] as const) {
      const row = rows!.find((r) => r.slug === slug);
      const doc = await getLegalDocument(slug);
      if (row?.status === "published" && row.body_md.trim()) {
        expect(doc.status).toBe("published");
        expect(publishedSlugs).toContain(slug);
      } else {
        expect(doc.status).toBe("unavailable");
        expect(publishedSlugs).not.toContain(slug);
      }
    }
  });

  it("precios: salen de plans y plan_prices (moneda principal, soles si hay)", async () => {
    jar.current = new Map();
    const pricing = await getPricingSummary();
    expect(pricing.ok).toBe(true);
    if (!pricing.ok) return;

    const { data: prices } = await admin
      .from("plan_prices")
      .select("interval, currency_code, amount_cents, is_active")
      .eq("plan_id", "premium")
      .eq("is_active", true);
    const pen = (prices ?? []).filter((p) => p.currency_code.trim() === "PEN");
    if (pen.length > 0) {
      expect(pricing.data.currency).toBe("PEN");
      const month = pen.find((p) => p.interval === "month");
      if (month) expect(pricing.data.monthly?.amountCents).toBe(month.amount_cents);
    }
    const { data: plans } = await admin.from("plans").select("id, features");
    expect(pricing.data.planFeatures.free).toEqual(plans!.find((p) => p.id === "free")?.features ?? []);
    expect(pricing.data.planFeatures.premium).toEqual(plans!.find((p) => p.id === "premium")?.features ?? []);
  });
});
