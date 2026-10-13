/**
 * Módulo IA contra el Supabase LOCAL: route handlers reales (/api/ai/{status,text,photo,chat,
 * transcribe}) con sesión en cookies, cupo real (`consume_ai_quota` / `complete_ai_request`),
 * consentimiento vigente, Premium y la confirmación que registra en el diario.
 *
 * El SDK de Anthropic está SIMULADO (vi.mock): no hay ANTHROPIC_API_KEY en este entorno y nunca se
 * llama a la API real. Primero se prueba sin clave (503) y luego con una clave falsa + SDK simulado.
 */
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { serviceClient, uniqueTag } from "./helpers";

/* ------------------------------------------------------------------ */
/* Simulaciones: cookies (next/headers), caché de Next y SDK.          */
/* ------------------------------------------------------------------ */

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
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
// after() solo existe dentro de una petición de Next; aquí las acciones se llaman directo.
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), after: vi.fn() }));

const sdk = vi.hoisted(() => ({ parse: vi.fn(), stream: vi.fn(), ctor: vi.fn() }));
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  const Real = actual.default;
  class FakeAnthropic {
    static AnthropicError = Real.AnthropicError;
    static APIError = Real.APIError;
    static APIConnectionError = Real.APIConnectionError;
    static APIConnectionTimeoutError = Real.APIConnectionTimeoutError;
    static APIUserAbortError = Real.APIUserAbortError;
    static BadRequestError = Real.BadRequestError;
    static AuthenticationError = Real.AuthenticationError;
    static PermissionDeniedError = Real.PermissionDeniedError;
    static NotFoundError = Real.NotFoundError;
    static RateLimitError = Real.RateLimitError;
    static InternalServerError = Real.InternalServerError;
    beta = { messages: { parse: sdk.parse, stream: sdk.stream } };
    constructor(options: unknown) {
      sdk.ctor(options);
    }
  }
  return { ...actual, default: FakeAnthropic };
});

const envFile = fileURLToPath(new URL("../../.env.local", import.meta.url));
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
// Sin credenciales de IA ni de transcripción al empezar (estado real de este entorno).
delete process.env.ANTHROPIC_API_KEY;
delete process.env.TRANSCRIPTION_PROVIDER;
delete process.env.OPENAI_API_KEY;

/* ------------------------------------------------------------------ */
/* Usuarios con sesión en cookies.                                     */
/* ------------------------------------------------------------------ */

type Db = SupabaseClient<Database>;
type Session = { id: string; cookies: Map<string, string>; client: Db };

async function createSessionUser(label: string): Promise<Session> {
  const admin = serviceClient();
  const email = `it-ia-${label}-${uniqueTag()}@example.com`;
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
  return { id: data.user.id, cookies, client };
}

const as = (s: Session | null) => {
  jar.current = s ? s.cookies : new Map();
};

type Routes = {
  status: typeof import("@/app/api/ai/status/route");
  text: typeof import("@/app/api/ai/text/route");
  photo: typeof import("@/app/api/ai/photo/route");
  chat: typeof import("@/app/api/ai/chat/route");
  transcribe: typeof import("@/app/api/ai/transcribe/route");
  actions: typeof import("@/features/ai/actions");
};

async function loadRoutes(): Promise<Routes> {
  return {
    status: await import("@/app/api/ai/status/route"),
    text: await import("@/app/api/ai/text/route"),
    photo: await import("@/app/api/ai/photo/route"),
    chat: await import("@/app/api/ai/chat/route"),
    transcribe: await import("@/app/api/ai/transcribe/route"),
    actions: await import("@/features/ai/actions"),
  };
}

type ErrorBody = { error?: { code: string; message: string; quota?: { used: number; limit: number } } };

const jsonPost = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function photoRequest(savePhoto: boolean): Promise<Request> {
  const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 240, g: 240, b: 230 } } }).png().toBuffer();
  const form = new FormData();
  form.append("image", new File([new Uint8Array(png)], "plato.png", { type: "image/png" }));
  form.append("savePhoto", savePhoto ? "true" : "false");
  return new Request("http://localhost/api/ai/photo", { method: "POST", body: form });
}

async function readNdjson(res: Response): Promise<Array<Record<string, unknown> & { type: string }>> {
  const text = await res.text();
  return text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Record<string, unknown> & { type: string });
}

const usage = { input_tokens: 1000, output_tokens: 500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };

function fakeStream(texts: string[], final: { stop_reason: string; text: string }) {
  let ended = false;
  return {
    abort: vi.fn(),
    get ended() {
      return ended;
    },
    async *[Symbol.asyncIterator]() {
      for (const t of texts) yield { type: "content_block_delta", delta: { type: "text_delta", text: t } };
      ended = true;
    },
    finalMessage: vi.fn(async () => ({
      model: "claude-opus-5-5",
      stop_reason: final.stop_reason,
      usage,
      content: [{ type: "text", text: final.text }],
    })),
  };
}

/* ------------------------------------------------------------------ */

describe("módulo IA (Supabase local, SDK simulado)", () => {
  const admin = serviceClient();
  const tag = uniqueTag();
  const users: Session[] = [];
  const storagePaths: string[] = [];
  let free: Session;
  let premium: Session;
  let noConsent: Session;
  let revoked: Session;
  let exhausted: Session;
  let foodId: string;
  const foodName = `Arroz iaprueba ${tag} cocido`;
  let r: Routes;

  async function makePremium(user: Session) {
    const now = Date.now();
    const { error } = await admin.from("subscriptions").insert({
      user_id: user.id,
      plan_id: "premium",
      provider: "stripe",
      provider_customer_id: `cus_it_${uniqueTag()}`,
      provider_subscription_id: `sub_it_${randomUUID()}`,
      status: "active",
      current_period_start: new Date(now).toISOString(),
      current_period_end: new Date(now + 30 * 24 * 3600 * 1000).toISOString(),
    });
    if (error) throw error;
  }

  async function consent(user: Session, granted: boolean, createdAt: Date) {
    const { error } = await admin.from("consents").insert({
      user_id: user.id,
      consent_type: "ai_processing",
      version: "2026-10",
      granted,
      granted_at: createdAt.toISOString(),
      revoked_at: granted ? null : createdAt.toISOString(),
      created_at: createdAt.toISOString(),
    });
    if (error) throw error;
  }

  async function requests(user: Session) {
    const { data, error } = await admin
      .from("ai_analysis_requests")
      .select("id, kind, status, provider, model, error_code, tokens_input, tokens_output, estimated_cost_usd, output, input_storage_path")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  }

  beforeAll(async () => {
    r = await loadRoutes();
    [free, premium, noConsent, revoked, exhausted] = await Promise.all([
      createSessionUser("free"),
      createSessionUser("premium"),
      createSessionUser("noconsent"),
      createSessionUser("revoked"),
      createSessionUser("exhausted"),
    ]);
    users.push(free, premium, noConsent, revoked, exhausted);
    for (const u of [premium, noConsent, revoked, exhausted]) await makePremium(u);
    const earlier = new Date(Date.now() - 60_000);
    await consent(free, true, earlier);
    await consent(premium, true, earlier);
    await consent(exhausted, true, earlier);
    // Otorgó y luego retiró: manda la fila más reciente.
    await consent(revoked, true, new Date(Date.now() - 120_000));
    await consent(revoked, false, earlier);

    const { data: food, error } = await admin
      .from("foods")
      .insert({ name: foodName, energy_kcal: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3, fiber_g: 0.4, source: "curated", verification_status: "curated", is_public: true })
      .select("id")
      .single();
    if (error) throw error;
    foodId = food.id;
    const { error: pError } = await admin.from("food_portions").insert({ food_id: foodId, label: "1 taza", quantity: 1, unit: "taza", gram_weight: 160, is_default: true });
    if (pError) throw pError;
  });

  afterAll(async () => {
    as(null);
    if (storagePaths.length) await admin.storage.from("meal-photos").remove(storagePaths);
    for (const u of users) await admin.auth.admin.deleteUser(u.id);
    if (foodId) await admin.from("foods").delete().eq("id", foodId);
  });

  beforeEach(() => {
    sdk.parse.mockReset();
    sdk.stream.mockReset();
  });

  describe("sin ANTHROPIC_API_KEY (estado real de este entorno)", () => {
    it("sin sesión → 401 en todas las rutas", async () => {
      as(null);
      expect((await r.status.GET()).status).toBe(401);
      for (const res of [
        await r.text.POST(jsonPost("/api/ai/text", { text: "una taza de arroz" })),
        await r.chat.POST(jsonPost("/api/ai/chat", { message: "hola" })),
        await r.photo.POST(await photoRequest(false)),
      ]) {
        expect(res.status).toBe(401);
        expect(((await res.json()) as ErrorBody).error?.code).toBe("UNAUTHORIZED");
      }
    });

    it("plan gratis → 403 PREMIUM_REQUIRED (aunque tenga consentimiento)", async () => {
      as(free);
      const res = await r.text.POST(jsonPost("/api/ai/text", { text: "una taza de arroz" }));
      expect(res.status).toBe(403);
      expect(((await res.json()) as ErrorBody).error?.code).toBe("PREMIUM_REQUIRED");
    });

    it("Premium sin consentimiento de IA, o con el consentimiento retirado → 403 CONSENT_REQUIRED", async () => {
      for (const user of [noConsent, revoked]) {
        as(user);
        for (const res of [
          await r.text.POST(jsonPost("/api/ai/text", { text: "una taza de arroz" })),
          await r.photo.POST(await photoRequest(false)),
          await r.chat.POST(jsonPost("/api/ai/chat", { message: "hola" })),
        ]) {
          expect(res.status).toBe(403);
          expect(((await res.json()) as ErrorBody).error?.code).toBe("CONSENT_REQUIRED");
        }
      }
    });

    it("Premium + consentimiento sin clave → 503 AI_NOT_CONFIGURED, sin consumir cupo ni crear el cliente del SDK", async () => {
      as(premium);
      for (const res of [
        await r.text.POST(jsonPost("/api/ai/text", { text: "una taza de arroz" })),
        await r.photo.POST(await photoRequest(false)),
        await r.chat.POST(jsonPost("/api/ai/chat", { message: "¿Cómo llego a mi meta de proteína?" })),
      ]) {
        expect(res.status).toBe(503);
        expect(((await res.json()) as ErrorBody).error?.code).toBe("AI_NOT_CONFIGURED");
      }
      const transcribe = await r.transcribe.POST(new Request("http://localhost/api/ai/transcribe", { method: "POST", body: new FormData() }));
      expect(transcribe.status).toBe(503);
      expect(((await transcribe.json()) as ErrorBody).error?.code).toBe("TRANSCRIPTION_NOT_CONFIGURED");
      expect(await requests(premium)).toEqual([]);
      expect(sdk.ctor).not.toHaveBeenCalled();
    });

    it("GET /api/ai/status dice la verdad: no configurada, consentimiento, plan y cupo", async () => {
      as(premium);
      const res = await r.status.GET();
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        configured: boolean;
        transcriptionConfigured: boolean;
        consent: boolean;
        plan: string;
        kinds: Record<string, { included: boolean; used: number; limit: number }>;
      };
      expect(body).toMatchObject({ configured: false, transcriptionConfigured: false, consent: true, plan: "premium" });
      expect(body.kinds.text).toEqual({ included: true, used: 0, limit: 300 });
      expect(body.kinds.photo).toEqual({ included: true, used: 0, limit: 120 });
      as(free);
      const freeBody = (await (await r.status.GET()).json()) as { plan: string; kinds: Record<string, { included: boolean; limit: number }> };
      expect(freeBody.plan).toBe("free");
      expect(freeBody.kinds.chat).toMatchObject({ included: false, limit: 0 });
    });
  });

  describe("con clave (SDK simulado)", () => {
    beforeAll(async () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-prueba-falsa";
      vi.resetModules();
      r = await loadRoutes();
    });

    afterAll(() => {
      delete process.env.ANTHROPIC_API_KEY;
    });

    it("sin cupo → 429 AI_QUOTA_EXCEEDED con el uso, sin llamar a la IA (y queda el rechazo)", async () => {
      const rows = Array.from({ length: 300 }, () => ({ user_id: exhausted.id, kind: "text" as const, status: "succeeded" as const }));
      const { error } = await admin.from("ai_analysis_requests").insert(rows);
      if (error) throw error;
      as(exhausted);
      const res = await r.text.POST(jsonPost("/api/ai/text", { text: "una taza de arroz" }));
      expect(res.status).toBe(429);
      const body = (await res.json()) as ErrorBody;
      expect(body.error).toMatchObject({ code: "AI_QUOTA_EXCEEDED", quota: { used: 300, limit: 300 } });
      expect(sdk.parse).not.toHaveBeenCalled();
      const rejected = (await requests(exhausted)).filter((q) => q.status === "rejected_quota");
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toMatchObject({ kind: "text", error_code: "quota_exceeded" });
    });

    it("texto: candidatos con coincidencias de la base; nada en el diario hasta confirmar; luego registra con nutrientes de la base", async () => {
      sdk.parse.mockResolvedValue({
        model: "claude-opus-5-5",
        stop_reason: "end_turn",
        usage,
        content: [],
        parsed_output: {
          items: [{ food_query: foodName, quantity: 2, unit: "taza", grams_if_stated: null, needs_clarification: false, clarification_question: null }],
        },
      });
      as(premium);
      const res = await r.text.POST(jsonPost("/api/ai/text", { text: `Comí dos tazas de ${foodName}` }));
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        requestId: string;
        quota: { used: number; limit: number };
        candidates: Array<{ foodQuery: string; quantity: number; unit: string; matches: Array<{ id: string; portions: unknown[] }> }>;
      };
      expect(body.quota).toEqual({ used: 1, limit: 300 });
      expect(body.candidates[0]).toMatchObject({ foodQuery: foodName, quantity: 2, unit: "taza" });
      expect(body.candidates[0]!.matches[0]!.id).toBe(foodId);

      // El prompt pide solo identificar, sin nutrientes; se envían fallbacks y effort.
      const params = sdk.parse.mock.calls[0]![0] as Record<string, unknown> & { system: string; output_config: { effort: string } };
      expect(params).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default", betas: ["server-side-fallback-2026-07-01"] });
      expect(params.output_config.effort).toBe("low");
      expect(params.system).toMatch(/No des calorías/);

      const [request] = (await requests(premium)).filter((q) => q.id === body.requestId);
      expect(request).toMatchObject({ kind: "text", status: "succeeded", provider: "anthropic", model: "claude-opus-5-5", tokens_input: 1000, tokens_output: 500 });
      expect(Number(request!.estimated_cost_usd)).toBeCloseTo(0.014, 6);
      expect(JSON.stringify(request!.output)).not.toMatch(/kcal|energy/i);

      // Nada registrado todavía.
      const before = await admin.from("meal_log_items").select("id").eq("user_id", premium.id);
      expect(before.data).toEqual([]);

      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
      const confirm = await r.actions.confirmAiItemsAction({
        requestId: body.requestId,
        source: "text_ai",
        localDate: today,
        mealType: "lunch",
        items: [{ foodId, grams: 320, quantity: 2, unit: "taza", origin: "ai" }],
      });
      expect(confirm).toMatchObject({ ok: true, data: { count: 1 } });
      const { data: logged } = await admin
        .from("meal_log_items")
        .select("food_id, grams, energy_kcal, source, ai_request_id, is_estimate, confidence, quantity, unit")
        .eq("user_id", premium.id);
      expect(logged).toHaveLength(1);
      expect(logged![0]).toMatchObject({ food_id: foodId, source: "text_ai", ai_request_id: body.requestId, is_estimate: false, confidence: null, unit: "taza" });
      expect(Number(logged![0]!.energy_kcal)).toBeCloseTo(416, 1); // 320 g × 130 kcal/100 g, desde la base

      // No se registra dos veces el mismo análisis, ni con otra fuente.
      const again = await r.actions.confirmAiItemsAction({
        requestId: body.requestId,
        source: "text_ai",
        localDate: today,
        mealType: "lunch",
        items: [{ foodId, grams: 100 }],
      });
      expect(again).toMatchObject({ ok: false, error: { code: "ALREADY_LOGGED" } });
    });

    it("negativa del modelo → 422 AI_REFUSED; la solicitud queda failed (no cuenta) y no hay resultado", async () => {
      sdk.parse.mockResolvedValue({ model: "claude-opus-5-5", stop_reason: "refusal", usage, content: [], parsed_output: null });
      as(premium);
      const res = await r.text.POST(jsonPost("/api/ai/text", { text: "una taza de arroz" }));
      expect(res.status).toBe(422);
      expect(((await res.json()) as ErrorBody).error?.code).toBe("AI_REFUSED");
      const last = (await requests(premium)).at(-1)!;
      expect(last).toMatchObject({ status: "failed", error_code: "AI_REFUSED" });
      // Un análisis fallido no se puede confirmar.
      const confirm = await r.actions.confirmAiItemsAction({
        requestId: last.id,
        source: "text_ai",
        localDate: new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" }),
        mealType: "lunch",
        items: [{ foodId, grams: 100 }],
      });
      expect(confirm).toMatchObject({ ok: false, error: { code: "AI_REQUEST_NOT_READY" } });
    });

    it("foto: se re-codifica, se guarda solo si se elige y al confirmar queda como estimación con confianza", async () => {
      sdk.parse.mockResolvedValue({
        model: "claude-opus-5-5",
        stop_reason: "end_turn",
        usage,
        content: [],
        parsed_output: {
          is_food_image: true,
          uncertainty_note: "No se ve si lleva aceite.",
          items: [
            { name_es: foodName, preparation: "no se distingue", estimated_grams: { min: 120, best: 150, max: 200 }, confidence: 0.8, visible_evidence: "Granos blancos" },
          ],
        },
      });
      as(premium);
      const res = await r.photo.POST(await photoRequest(true));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { requestId: string; photoSaved: boolean; candidates: Array<{ matches: Array<{ id: string }>; confidence: number }> };
      expect(body.photoSaved).toBe(true);
      expect(body.candidates[0]!.matches[0]!.id).toBe(foodId);
      const params = sdk.parse.mock.calls[0]![0] as { output_config: { effort: string }; messages: Array<{ content: Array<{ type: string; source?: { media_type: string } }> }> };
      expect(params.output_config.effort).toBe("medium");
      expect(params.messages[0]!.content[0]).toMatchObject({ type: "image", source: { media_type: "image/jpeg" } });

      const request = (await requests(premium)).find((q) => q.id === body.requestId)!;
      expect(request.input_storage_path).toMatch(new RegExp(`^${premium.id}/\\d{4}-\\d{2}-\\d{2}/${body.requestId}\\.jpg$`));
      storagePaths.push(request.input_storage_path!);
      const { data: file } = await admin.storage.from("meal-photos").download(request.input_storage_path!);
      expect(file?.type).toBe("image/jpeg");

      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
      // Un análisis de foto no se puede registrar como texto.
      const wrong = await r.actions.confirmAiItemsAction({
        requestId: body.requestId,
        source: "text_ai",
        localDate: today,
        mealType: "dinner",
        items: [{ foodId, grams: 150 }],
      });
      expect(wrong).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
      const confirm = await r.actions.confirmAiItemsAction({
        requestId: body.requestId,
        source: "photo_ai",
        localDate: today,
        mealType: "dinner",
        items: [{ foodId, grams: 150, quantity: 150, unit: "g", confidence: 0.8, origin: "ai" }],
      });
      expect(confirm.ok).toBe(true);
      const { data: logged } = await admin
        .from("meal_log_items")
        .select("source, is_estimate, confidence, energy_kcal")
        .eq("user_id", premium.id)
        .eq("ai_request_id", body.requestId);
      expect(logged).toEqual([{ source: "photo_ai", is_estimate: true, confidence: 0.8, energy_kcal: 195 }]);
    });

    it("foto sin elegir guardarla: no se sube nada a Storage", async () => {
      sdk.parse.mockResolvedValue({
        model: "claude-opus-5-5",
        stop_reason: "end_turn",
        usage,
        content: [],
        parsed_output: { is_food_image: false, uncertainty_note: "No se ve comida.", items: [] },
      });
      as(premium);
      const res = await r.photo.POST(await photoRequest(false));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { requestId: string; isFoodImage: boolean; photoSaved: boolean | null };
      expect(body).toMatchObject({ isFoodImage: false, photoSaved: null });
      expect((await requests(premium)).find((q) => q.id === body.requestId)!.input_storage_path).toBeNull();
    });

    it("chat moderado: señal de TCA → respuesta segura, mensaje marcado, sin modelo ni cupo", async () => {
      as(premium);
      const before = (await requests(premium)).filter((q) => q.kind === "chat").length;
      const res = await r.chat.POST(jsonPost("/api/ai/chat", { message: "quiero dejar de comer para bajar rápido" }));
      expect(res.status).toBe(200);
      const events = await readNdjson(res);
      expect(events.map((e) => e.type)).toEqual(["meta", "delta", "done"]);
      expect(String(events[1]!.text)).toContain("Línea 113, opción 5");
      expect(events[2]).toMatchObject({ flagged: true, quota: null });
      expect(sdk.stream).not.toHaveBeenCalled();
      expect((await requests(premium)).filter((q) => q.kind === "chat").length).toBe(before);
      const { data: msgs } = await admin
        .from("assistant_messages")
        .select("role, flagged")
        .eq("conversation_id", String(events[0]!.conversationId))
        .order("created_at");
      expect(msgs).toEqual([
        { role: "user", flagged: true },
        { role: "assistant", flagged: false },
      ]);
    });

    it("chat en streaming: contexto mínimo, respuesta guardada y solicitud cerrada con costo", async () => {
      sdk.stream.mockReturnValue(fakeStream(["Para llegar a tu meta ", "suma una porción de menestras."], { stop_reason: "end_turn", text: "Para llegar a tu meta suma una porción de menestras." }));
      as(premium);
      const res = await r.chat.POST(jsonPost("/api/ai/chat", { message: "¿Cómo llego a mi meta de proteína?" }));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/x-ndjson");
      const events = await readNdjson(res);
      expect(events.map((e) => e.type)).toEqual(["meta", "delta", "delta", "done"]);
      expect(events[3]).toMatchObject({ flagged: false, quota: { used: 1, limit: 400 } });

      const params = sdk.stream.mock.calls[0]![0] as { system: string; messages: Array<{ role: string; content: string }>; fallbacks: string };
      expect(params.fallbacks).toBe("default");
      expect(params.system).toContain("Contexto autorizado de la persona");
      expect(params.system).toContain("Línea 113");
      expect(params.system).not.toMatch(/@example\.com/);
      expect(params.messages).toEqual([{ role: "user", content: "¿Cómo llego a mi meta de proteína?" }]);

      const chatRequest = (await requests(premium)).filter((q) => q.kind === "chat").at(-1)!;
      expect(chatRequest).toMatchObject({ status: "succeeded", model: "claude-opus-5-5", tokens_input: 1000, tokens_output: 500 });
      expect(JSON.stringify(chatRequest.output)).not.toContain("menestras");
      const { data: msgs } = await admin
        .from("assistant_messages")
        .select("role, content")
        .eq("conversation_id", String(events[0]!.conversationId))
        .order("created_at");
      expect(msgs?.map((m) => m.role)).toEqual(["user", "assistant"]);
      expect(msgs?.[1]?.content).toBe("Para llegar a tu meta suma una porción de menestras.");
    });

    it("chat: negativa a mitad de la respuesta → evento de error, nada guardado, conversación nueva borrada", async () => {
      sdk.stream.mockReturnValue(fakeStream(["Parcial"], { stop_reason: "refusal", text: "Parcial" }));
      as(premium);
      const res = await r.chat.POST(jsonPost("/api/ai/chat", { message: "Otra pregunta" }));
      const events = await readNdjson(res);
      expect(events.at(-1)).toMatchObject({ type: "error", code: "AI_REFUSED" });
      const conversationId = String(events[0]!.conversationId);
      const { data: conv } = await admin.from("assistant_conversations").select("id").eq("id", conversationId);
      expect(conv).toEqual([]);
      const last = (await requests(premium)).filter((q) => q.kind === "chat").at(-1)!;
      expect(last).toMatchObject({ status: "failed", error_code: "AI_REFUSED" });
    });
  });
});
