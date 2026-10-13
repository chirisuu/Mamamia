import "server-only";
import webpush from "web-push";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";

/**
 * Web Push con VAPID (librería web-push). Sin las tres variables (NEXT_PUBLIC_VAPID_PUBLIC_KEY,
 * VAPID_PRIVATE_KEY, VAPID_SUBJECT) no se envía nada: las notificaciones quedan solo dentro de la app
 * y la UI lo dice. El service worker (public/sw.js) recibe un JSON { title, body, url }.
 */
export type PushPayload = { title: string; body: string; url: string };

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

export type PushSendResult =
  | { ok: true; statusCode: number }
  | {
      ok: false;
      /** La suscripción ya no existe (404/410): hay que borrarla. */
      gone: boolean;
      statusCode: number | null;
      code: string;
    };

export type VapidConfig = { publicKey: string; privateKey: string; subject: string };

export function vapidConfig(): VapidConfig | null {
  const env = serverEnv();
  const publicKey = publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return null;
  return { publicKey, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT };
}

export function isPushConfigured(): boolean {
  return vapidConfig() !== null;
}

/** Recorta el contenido a lo que cabe con holgura en un mensaje push (~4 KB cifrado). */
export function buildPushPayload(input: { title: string; body: string | null; url: string | null }): PushPayload {
  const url = input.url && input.url.startsWith("/") && !input.url.startsWith("//") ? input.url : "/app/notificaciones";
  return {
    title: input.title.slice(0, 120),
    body: (input.body ?? "").slice(0, 400),
    url,
  };
}

/** Clasifica un error de web-push sin exponer el contenido. */
export function classifyPushError(error: unknown): Extract<PushSendResult, { ok: false }> {
  const statusCode =
    error && typeof error === "object" && "statusCode" in error && typeof (error as { statusCode: unknown }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : null;
  if (statusCode === 404 || statusCode === 410) return { ok: false, gone: true, statusCode, code: "SUBSCRIPTION_GONE" };
  if (statusCode === 413) return { ok: false, gone: false, statusCode, code: "PAYLOAD_TOO_LARGE" };
  if (statusCode === 429) return { ok: false, gone: false, statusCode, code: "RATE_LIMITED" };
  if (statusCode !== null) return { ok: false, gone: false, statusCode, code: "PUSH_SERVICE_ERROR" };
  return { ok: false, gone: false, statusCode: null, code: "NETWORK_ERROR" };
}

export async function sendPush(target: PushTarget, payload: PushPayload, config: VapidConfig): Promise<PushSendResult> {
  try {
    const res = await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      {
        vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
        // Un recordatorio que llega un día tarde ya no sirve.
        TTL: 60 * 60 * 12,
        urgency: "normal",
        timeout: 10_000,
      },
    );
    return { ok: true, statusCode: res.statusCode };
  } catch (error) {
    return classifyPushError(error);
  }
}
