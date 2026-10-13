/**
 * Utilidades de navegador para push y avisos locales. El service worker (`/sw.js`) lo publica el
 * módulo de landing; aquí solo se registra si aún no lo está.
 */

/** Clave VAPID pública (base64url) → bytes para `pushManager.subscribe`. Pura. */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

/** Registro activo del service worker (lo registra si falta). null si no se pudo. */
export async function getActiveRegistration(timeoutMs = 10_000): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (!existing) await navigator.serviceWorker.register("/sw.js");
    return await withTimeout(navigator.serviceWorker.ready, timeoutMs);
  } catch {
    return null;
  }
}

export type LocalNotificationResult = "shown" | "no_permission" | "unsupported" | "failed";

/**
 * Aviso local mientras la app está abierta (Notification API). En Android Chrome `new Notification`
 * no está permitido en la página: se usa el service worker si existe.
 */
export async function showLocalNotification(title: string, options: { body: string; url?: string; tag?: string }): Promise<LocalNotificationResult> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission !== "granted") return "no_permission";
  const data = { url: options.url ?? "/app" };
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) {
      await reg.showNotification(title, { body: options.body, tag: options.tag, data });
      return "shown";
    }
    new Notification(title, { body: options.body, tag: options.tag, data });
    return "shown";
  } catch {
    return "failed";
  }
}
