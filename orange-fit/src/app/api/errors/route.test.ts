import { beforeEach, describe, expect, it, vi } from "vitest";

/* POST /api/errors con Supabase simulado: validación, origen, tamaño, usuario de la sesión y 429. */

const state = vi.hoisted(() => ({
  configured: true,
  user: null as { id: string } | null,
  insertResult: { error: null as null | { code: string; message: string }, status: 201 },
  inserted: [] as Array<{ client: string; row: Record<string, unknown> }>,
  anonIp: [] as Array<string | null>,
}));

function fakeClient(name: string) {
  return {
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        expect(table).toBe("error_reports");
        state.inserted.push({ client: name, row });
        return state.insertResult;
      },
    }),
  };
}

vi.mock("@/lib/env", () => ({ isSupabaseConfigured: () => state.configured }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => fakeClient("session") }));
vi.mock("@/features/marketing/server/error-reports", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/features/marketing/server/error-reports")>();
  return {
    ...original,
    createAnonReporterClient: (ip: string | null) => {
      state.anonIp.push(ip);
      return fakeClient("anon");
    },
  };
});

const { POST } = await import("./route");

function post(body: unknown, headers: Record<string, string> = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return POST(
    new Request("http://localhost:3000/api/errors", {
      method: "POST",
      headers: { "content-type": "application/json", host: "localhost:3000", origin: "http://localhost:3000", ...headers },
      body: text,
    }),
  );
}

beforeEach(() => {
  state.configured = true;
  state.user = null;
  state.insertResult = { error: null, status: 201 };
  state.inserted = [];
  state.anonIp = [];
});

describe("POST /api/errors", () => {
  it("anónimo: guarda sin usuario, con la IP reenviada y los campos saneados", async () => {
    const res = await post(
      { message: "Falló para ana@correo.pe", route: "/compartido/plan/secreto?x=1", digest: "123", user_id: "suplantado" },
      { "user-agent": "Mozilla/5.0 Prueba", "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(state.anonIp).toEqual(["203.0.113.9"]);
    expect(state.inserted).toEqual([
      {
        client: "anon",
        row: {
          message: "Falló para [correo]",
          route: "/compartido/plan/[token]",
          digest: "123",
          user_agent: "Mozilla/5.0 Prueba",
          user_id: null,
          status: "new",
        },
      },
    ]);
  });

  it("con sesión: el usuario sale de la sesión (no del cuerpo) y usa el cliente con cookies", async () => {
    state.user = { id: "11111111-1111-1111-1111-111111111111" };
    const res = await post({ message: "x", user_id: "22222222-2222-2222-2222-222222222222" });
    expect(res.status).toBe(201);
    expect(state.inserted[0]).toMatchObject({ client: "session", row: { user_id: "11111111-1111-1111-1111-111111111111" } });
    expect(state.anonIp).toEqual([]);
  });

  it("400 con JSON inválido o sin mensaje", async () => {
    const bad = await post("{no es json");
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe("INVALID_JSON");
    const empty = await post({ route: "/app" });
    expect(empty.status).toBe(400);
    expect((await empty.json()).error.code).toBe("VALIDATION");
    expect(state.inserted).toEqual([]);
  });

  it("403 desde otro origen", async () => {
    const res = await post({ message: "x" }, { origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(state.inserted).toEqual([]);
  });

  it("413 si el cuerpo es demasiado grande", async () => {
    const res = await post({ message: "x".repeat(20_000) });
    expect(res.status).toBe(413);
    expect(state.inserted).toEqual([]);
  });

  it("429 cuando la BD aplica el límite", async () => {
    state.insertResult = { error: { code: "PT429", message: "Demasiados reportes" }, status: 429 };
    const res = await post({ message: "x" });
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("RATE_LIMITED");
  });

  it("500 con otro error de la BD (sin filtrar el detalle)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    state.insertResult = { error: { code: "23514", message: "detalle interno" }, status: 400 };
    const res = await post({ message: "x" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("detalle interno");
    spy.mockRestore();
  });

  it("503 si Supabase no está configurado", async () => {
    state.configured = false;
    const res = await post({ message: "x" });
    expect(res.status).toBe(503);
  });
});
