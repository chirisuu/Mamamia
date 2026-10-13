import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Respuesta JSON de error con el formato común `{ error: { code, message } }`. */
export function apiError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export function apiOk<T>(body: T, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Compara `Authorization: Bearer <secreto>` en tiempo constante. */
export function hasBearerSecret(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return false;
  const given = Buffer.from(match[1]!, "utf8");
  const expected = Buffer.from(secret, "utf8");
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}
