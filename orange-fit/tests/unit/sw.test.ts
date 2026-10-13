/**
 * public/sw.js: análisis estático + ejecución en un entorno simulado de service worker.
 * Lo importante: /api, /auth, las navegaciones (pueden traer datos de la persona) y lo de otros
 * orígenes NUNCA se guardan en caché; push y notificationclick solo abren rutas internas.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SW_FILE = path.resolve(__dirname, "../../public/sw.js");
const source = fs.readFileSync(SW_FILE, "utf8");
const ORIGIN = "https://orange.test";

/* -------------------------------------------------------------------------- */
/* Análisis estático                                                           */
/* -------------------------------------------------------------------------- */

describe("sw.js (estático)", () => {
  it("declara /api y /auth como rutas que nunca se cachean", () => {
    const match = /const NEVER_CACHE_PREFIXES = \[([^\]]*)\]/.exec(source);
    expect(match).not.toBeNull();
    expect(match![1]).toContain('"/api/"');
    expect(match![1]).toContain('"/auth/"');
  });

  it("descarta /api, /auth y otros orígenes ANTES de cualquier respondWith", () => {
    const fetchHandler = source.slice(source.indexOf('addEventListener("fetch"'));
    const firstRespond = fetchHandler.indexOf("respondWith");
    expect(fetchHandler.indexOf("if (isNeverCached(url.pathname)) return;")).toBeGreaterThan(-1);
    expect(fetchHandler.indexOf("if (isNeverCached(url.pathname)) return;")).toBeLessThan(firstRespond);
    expect(fetchHandler.indexOf("url.origin !== self.location.origin) return;")).toBeLessThan(firstRespond);
    expect(fetchHandler.indexOf('request.method !== "GET") return;')).toBeLessThan(firstRespond);
  });

  it("solo escribe en caché tras comprobar que la respuesta es cacheable", () => {
    const puts = [...source.matchAll(/\.put\(/g)].map((m) => m.index!);
    expect(puts.length).toBeGreaterThan(0);
    for (const index of puts) {
      // La comprobación está en el mismo bloque, unas líneas antes.
      const before = source.slice(Math.max(0, index - 400), index);
      expect(before).toContain("isCacheableResponse(response)");
    }
    expect(source).toMatch(/no-store/);
    expect(source).toMatch(/private/);
  });

  it("la precarga no incluye rutas de la API, de auth ni de la app", () => {
    const match = /const PRECACHE_URLS = \[([^\]]*)\]/.exec(source)!;
    expect(match[1]).not.toMatch(/\/api|\/auth|\/app|\/admin/);
  });

  it("la navegación no guarda la página (solo usa la de sin conexión)", () => {
    const nav = source.slice(source.indexOf("async function handleNavigation"), source.indexOf("async function handleImmutableStatic"));
    expect(nav).not.toMatch(/\.put\(/);
    expect(nav).toContain("OFFLINE_URL");
  });
});

/* -------------------------------------------------------------------------- */
/* Ejecución simulada                                                          */
/* -------------------------------------------------------------------------- */

type FakeResponse = {
  ok: boolean;
  status: number;
  type: string;
  url: string;
  headers: Headers;
  clone: () => FakeResponse;
};

function fakeResponse(url: string, init: { status?: number; type?: string; headers?: Record<string, string> } = {}): FakeResponse {
  const status = init.status ?? 200;
  const res: FakeResponse = {
    ok: status >= 200 && status < 300,
    status,
    type: init.type ?? "basic",
    url,
    headers: new Headers(init.headers ?? {}),
    clone: () => fakeResponse(url, init),
  };
  return res;
}

type FakeRequest = { url: string; method: string; mode: string; headers: Headers };
const req = (pathOrUrl: string, init: Partial<Omit<FakeRequest, "url">> = {}): FakeRequest => ({
  url: new URL(pathOrUrl, ORIGIN).href,
  method: init.method ?? "GET",
  mode: init.mode ?? "cors",
  headers: init.headers ?? new Headers(),
});

function createEnvironment() {
  const handlers = new Map<string, (event: unknown) => void>();
  const store = new Map<string, Map<string, unknown>>();
  const puts: Array<{ cache: string; url: string }> = [];
  const keyOf = (r: unknown) => (typeof r === "string" ? new URL(r, ORIGIN).href : (r as { url: string }).url);

  const openCache = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    const entries = store.get(name)!;
    return {
      put: async (request: unknown, response: unknown) => {
        puts.push({ cache: name, url: keyOf(request) });
        entries.set(keyOf(request), response);
      },
      addAll: async (requests: unknown[]) => {
        for (const r of requests) {
          puts.push({ cache: name, url: keyOf(r) });
          entries.set(keyOf(r), fakeResponse(keyOf(r)));
        }
      },
      match: async (request: unknown) => entries.get(keyOf(request)),
      keys: async () => [...entries.keys()].map((url) => ({ url })),
      delete: async (request: unknown) => entries.delete(keyOf(request)),
    };
  };

  const caches = {
    open: async (name: string) => openCache(name),
    match: async (request: unknown) => {
      for (const entries of store.values()) {
        const hit = entries.get(keyOf(request));
        if (hit) return hit;
      }
      return undefined;
    },
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
  };

  const fetchMock = vi.fn(async (request: FakeRequest) => fakeResponse(request.url));
  const showNotification = vi.fn(async () => undefined);
  const openWindow = vi.fn(async (url: string) => ({ url, focus: vi.fn() }));
  const windows: Array<{ url: string; focus: ReturnType<typeof vi.fn>; navigate?: ReturnType<typeof vi.fn> }> = [];

  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, handler: (event: unknown) => void) => handlers.set(type, handler),
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined), matchAll: vi.fn(async () => windows), openWindow },
    registration: { showNotification },
  };

  class ShimRequest {
    url: string;
    constructor(url: string) {
      this.url = new URL(url, ORIGIN).href;
    }
  }

  vm.runInNewContext(source, {
    self,
    caches,
    fetch: fetchMock,
    URL,
    Headers,
    Response,
    Request: ShimRequest,
    Promise,
    console,
  });

  async function dispatchFetch(request: FakeRequest) {
    let responded = null as Promise<unknown> | null;
    const waits: Promise<unknown>[] = [];
    handlers.get("fetch")!({
      request,
      respondWith: (p: Promise<unknown>) => {
        responded = Promise.resolve(p);
      },
      waitUntil: (p: Promise<unknown>) => waits.push(p),
    });
    const response = responded ? await responded : undefined;
    await Promise.all(waits);
    // Deja correr las escrituras en caché que no se esperan (fire-and-forget).
    await new Promise((resolve) => setTimeout(resolve, 0));
    return { intercepted: responded !== null, response };
  }

  async function dispatch(type: string, event: Record<string, unknown>) {
    const waits: Promise<unknown>[] = [];
    handlers.get(type)!({ ...event, waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
  }

  return { handlers, puts, fetchMock, showNotification, openWindow, windows, dispatchFetch, dispatch, store };
}

describe("sw.js (ejecución simulada)", () => {
  let env: ReturnType<typeof createEnvironment>;

  beforeEach(async () => {
    env = createEnvironment();
    await env.dispatch("install", {});
    await env.dispatch("activate", {});
  });

  it("precarga solo el shell mínimo", () => {
    const urls = env.puts.map((p) => new URL(p.url).pathname);
    expect(urls).toContain("/offline.html");
    expect(urls.every((u) => u === "/offline.html" || u.startsWith("/icons/"))).toBe(true);
  });

  it("no intercepta ni guarda /api ni /auth (ni siquiera navegaciones)", async () => {
    env.puts.length = 0;
    for (const request of [
      req("/api/foods/search?q=pan"),
      req("/api/account/export", { mode: "navigate" }),
      req("/auth/confirm?token_hash=abc&type=email", { mode: "navigate" }),
      req("/auth/callback?code=xyz"),
      req("/api"),
      req("/auth"),
    ]) {
      const { intercepted } = await env.dispatchFetch(request);
      expect(intercepted, request.url).toBe(false);
    }
    expect(env.puts).toEqual([]);
  });

  it("no intercepta otros orígenes, métodos distintos de GET ni peticiones con Authorization", async () => {
    env.puts.length = 0;
    expect((await env.dispatchFetch(req("https://proyecto.supabase.co/storage/v1/object/sign/x.png"))).intercepted).toBe(false);
    expect((await env.dispatchFetch(req("/_next/static/chunks/a.js", { method: "POST" }))).intercepted).toBe(false);
    expect(
      (await env.dispatchFetch(req("/_next/static/chunks/a.js", { headers: new Headers({ Authorization: "Bearer x" }) }))).intercepted,
    ).toBe(false);
    expect(env.puts).toEqual([]);
  });

  it("navegación: red primero, nunca se guarda; sin red muestra offline.html", async () => {
    env.puts.length = 0;
    const online = await env.dispatchFetch(req("/app/diario", { mode: "navigate" }));
    expect(online.intercepted).toBe(true);
    expect((online.response as FakeResponse).url).toBe(`${ORIGIN}/app/diario`);
    expect(env.puts).toEqual([]);

    env.fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const offline = await env.dispatchFetch(req("/app/diario", { mode: "navigate" }));
    expect((offline.response as FakeResponse).url).toBe(`${ORIGIN}/offline.html`);
    expect(env.puts).toEqual([]);
  });

  it("estáticos de /_next/static: cache-first", async () => {
    env.puts.length = 0;
    const first = await env.dispatchFetch(req("/_next/static/chunks/app.123.js"));
    expect(first.intercepted).toBe(true);
    expect(env.puts.map((p) => new URL(p.url).pathname)).toEqual(["/_next/static/chunks/app.123.js"]);
    const calls = env.fetchMock.mock.calls.length;
    await env.dispatchFetch(req("/_next/static/chunks/app.123.js"));
    expect(env.fetchMock.mock.calls.length).toBe(calls);
  });

  it("no guarda respuestas privadas, no-store, con cookies, opacas o con error", async () => {
    env.puts.length = 0;
    const cases: Array<Parameters<typeof fakeResponse>[1]> = [
      { headers: { "Cache-Control": "private, max-age=60" } },
      { headers: { "Cache-Control": "no-store" } },
      { headers: { "Set-Cookie": "sb=1" } },
      { type: "opaque" },
      { status: 500 },
      { status: 206 },
    ];
    for (const [index, init] of cases.entries()) {
      env.fetchMock.mockResolvedValueOnce(fakeResponse(`${ORIGIN}/_next/static/x${index}.js`, init));
      await env.dispatchFetch(req(`/_next/static/x${index}.js`));
    }
    expect(env.puts).toEqual([]);
  });

  it("páginas y datos RSC no se interceptan", async () => {
    env.puts.length = 0;
    expect((await env.dispatchFetch(req("/app/diario?_rsc=abc"))).intercepted).toBe(false);
    expect((await env.dispatchFetch(req("/screenshots/inicio.png"))).intercepted).toBe(false);
    expect(env.puts).toEqual([]);
  });

  it("push muestra { title, body, url } y solo acepta rutas internas", async () => {
    await env.dispatch("push", { data: { json: () => ({ title: "Hora de tu agua", body: "Te faltan 500 ml", url: "/app/agua" }) } });
    expect(env.showNotification).toHaveBeenLastCalledWith(
      "Hora de tu agua",
      expect.objectContaining({ body: "Te faltan 500 ml", data: { url: "/app/agua" } }),
    );

    for (const url of ["https://evil.example/x", "//evil.example", "javascript:alert(1)", 42]) {
      await env.dispatch("push", { data: { json: () => ({ title: "X", body: "Y", url }) } });
      expect(env.showNotification).toHaveBeenLastCalledWith("X", expect.objectContaining({ data: { url: "/app/notificaciones" } }));
    }
  });

  it("push sin datos o con texto plano no se rompe", async () => {
    await env.dispatch("push", { data: null });
    expect(env.showNotification).toHaveBeenLastCalledWith("ORANGE FIT", expect.objectContaining({ body: "" }));
    await env.dispatch("push", {
      data: {
        json: () => {
          throw new SyntaxError("no json");
        },
        text: () => "Hola",
      },
    });
    expect(env.showNotification).toHaveBeenLastCalledWith("ORANGE FIT", expect.objectContaining({ body: "Hola" }));
  });

  it("notificationclick enfoca la pestaña que ya está en la ruta", async () => {
    const tab = { url: `${ORIGIN}/app/agua`, focus: vi.fn(async () => tab) };
    env.windows.push(tab);
    const close = vi.fn();
    await env.dispatch("notificationclick", { notification: { close, data: { url: "/app/agua" } } });
    expect(close).toHaveBeenCalled();
    expect(tab.focus).toHaveBeenCalled();
    expect(env.openWindow).not.toHaveBeenCalled();
  });

  it("notificationclick lleva otra pestaña de la app a la ruta, o abre una nueva", async () => {
    const focused = { focus: vi.fn(async () => undefined) };
    const tab = { url: `${ORIGIN}/app`, focus: vi.fn(), navigate: vi.fn(async () => focused) };
    env.windows.push(tab);
    await env.dispatch("notificationclick", { notification: { close: vi.fn(), data: { url: "/app/ayuno" } } });
    expect(tab.navigate).toHaveBeenCalledWith(`${ORIGIN}/app/ayuno`);
    expect(focused.focus).toHaveBeenCalled();

    env.windows.length = 0;
    await env.dispatch("notificationclick", { notification: { close: vi.fn(), data: { url: "https://evil.example" } } });
    expect(env.openWindow).toHaveBeenCalledWith(`${ORIGIN}/app/notificaciones`);
  });
});
