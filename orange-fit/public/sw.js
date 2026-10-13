/* global self, caches */
/**
 * Service worker de ORANGE FIT (alcance "/").
 *
 * Qué hace:
 * - Precarga un shell mínimo: la página sin conexión y los iconos.
 * - Navegaciones: siempre a la red (network-first). Si no hay red, muestra /offline.html.
 *   Las páginas NO se guardan: pueden tener datos de la persona.
 * - Estáticos versionados de Next (/_next/static/…): cache-first (sus nombres llevan hash).
 * - Iconos y logo (/icons/…): stale-while-revalidate.
 * - NUNCA cachea /api, /auth, otras rutas, peticiones que no sean GET, de otro origen (Supabase,
 *   Storage, Stripe…) ni respuestas marcadas como privadas o no-store.
 * - Push: muestra { title, body, url } y al tocar abre o enfoca esa ruta de la app.
 *
 * Al cambiar algo de este archivo, sube VERSION: el activate borra las cachés anteriores.
 */
const VERSION = "v1";
const SHELL_CACHE = `orangefit-shell-${VERSION}`;
const STATIC_CACHE = `orangefit-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [OFFLINE_URL, "/icons/logo.svg", "/icons/icon-192.png", "/icons/badge-96.png"];
const MAX_STATIC_ENTRIES = 150;
const DEFAULT_NOTIFICATION_URL = "/app/notificaciones";
const DEFAULT_TITLE = "ORANGE FIT";

/** Prefijos que jamás se sirven desde caché ni se guardan en ella. */
const NEVER_CACHE_PREFIXES = ["/api/", "/auth/"];

function isNeverCached(pathname) {
  return pathname === "/api" || pathname === "/auth" || NEVER_CACHE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** ¿Se puede guardar esta respuesta? Solo respuestas propias, completas y sin marcas de privacidad. */
function isCacheableResponse(response) {
  if (!response || !response.ok || response.status !== 200 || response.type !== "basic") return false;
  const cacheControl = (response.headers.get("Cache-Control") || "").toLowerCase();
  if (cacheControl.includes("no-store") || cacheControl.includes("private")) return false;
  if (response.headers.has("Set-Cookie")) return false;
  return true;
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  // Las más antiguas primero (orden de inserción).
  for (let i = 0; i < keys.length - maxEntries; i++) await cache.delete(keys[i]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith("orangefit-") && name !== SHELL_CACHE && name !== STATIC_CACHE)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Navegación: red primero; sin red, la página sin conexión. La respuesta no se guarda. */
async function handleNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const offline = await caches.match(OFFLINE_URL);
    return offline || new Response("Sin conexión", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

/** Estáticos con hash: caché primero; si no está, red y se guarda. */
async function handleImmutableStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheableResponse(response)) {
    const copy = response.clone();
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.put(request, copy))
      .then(() => trimCache(STATIC_CACHE, MAX_STATIC_ENTRIES))
      .catch(() => undefined);
  }
  return response;
}

/** Iconos: responde con lo guardado y actualiza en segundo plano. */
async function handleStaleWhileRevalidate(request, event) {
  const cached = await caches.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (isCacheableResponse(response)) {
        const cache = await caches.open(SHELL_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);
  if (cached) {
    event.waitUntil(network);
    return cached;
  }
  const response = await network;
  return response || new Response("", { status: 504 });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Otro origen (Supabase, Storage con URL firmada, Stripe…): el navegador lo maneja sin caché nuestra.
  if (url.origin !== self.location.origin) return;
  // /api y /auth nunca pasan por la caché (ni siquiera como respaldo sin conexión).
  if (isNeverCached(url.pathname)) return;
  // Peticiones con credenciales explícitas: datos de alguien.
  if (request.headers.has("Authorization")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(handleImmutableStatic(request));
    return;
  }
  if (url.pathname.startsWith("/icons/")) {
    event.respondWith(handleStaleWhileRevalidate(request, event));
  }
  // Todo lo demás (datos de React Server Components, /_next/image, páginas, capturas…): red directa.
});

/* -------------------------------------------------------------------------- */
/* Notificaciones push                                                         */
/* -------------------------------------------------------------------------- */

/** Solo rutas internas ("/app/…"); cualquier otra cosa cae en la bandeja de avisos. */
function safeAppPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return DEFAULT_NOTIFICATION_URL;
  }
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin ? url.pathname + url.search + url.hash : DEFAULT_NOTIFICATION_URL;
  } catch {
    return DEFAULT_NOTIFICATION_URL;
  }
}

function readPushData(event) {
  if (!event.data) return {};
  try {
    const data = event.data.json();
    return data && typeof data === "object" ? data : {};
  } catch {
    return { body: event.data.text() };
  }
}

self.addEventListener("push", (event) => {
  const data = readPushData(event);
  const title = typeof data.title === "string" && data.title.trim() ? data.title.slice(0, 120) : DEFAULT_TITLE;
  const body = typeof data.body === "string" ? data.body.slice(0, 500) : "";
  const url = safeAppPath(data.url);
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      lang: "es-PE",
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safeAppPath(event.notification.data && event.notification.data.url);
  const targetUrl = new URL(target, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // 1) Una pestaña que ya está en esa ruta: enfocarla.
      const exact = windows.find((client) => client.url === targetUrl);
      if (exact && "focus" in exact) return exact.focus();
      // 2) Otra pestaña de la app: llevarla a la ruta y enfocarla.
      const sameOrigin = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (sameOrigin && "navigate" in sameOrigin) {
        try {
          const navigated = await sameOrigin.navigate(targetUrl);
          if (navigated) return navigated.focus();
        } catch {
          // navigate() falla si la pestaña no está controlada por este SW: abrimos una nueva.
        }
      }
      // 3) Ninguna: abrir una ventana nueva.
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    })(),
  );
});
