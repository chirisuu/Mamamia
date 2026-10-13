import { z } from "zod";

/**
 * Reportes de error del navegador (POST /api/errors → `error_reports`). Puro y compartido por el
 * cliente (pantallas de error) y el servidor (route handler).
 *
 * Nada sensible: la ruta va sin query ni hash (ahí viajan tokens: `?code=`, `token_hash`, enlaces
 * compartidos), y del mensaje se quitan correos, tokens largos y números de tarjeta/teléfono.
 */

/** Límites de las columnas de `error_reports` (checks de la migración 000008). */
export const ERROR_REPORT_LIMITS = { message: 2000, route: 500, digest: 200, userAgent: 500 } as const;

/** Tamaño máximo del cuerpo aceptado (bytes). */
export const MAX_ERROR_REPORT_BODY = 16 * 1024;

const trimmed = (max: number) => z.string().trim().max(max);

/** Entrada del cliente. Campos extra (p. ej. un user_id) se descartan: el usuario sale de la sesión. */
export const errorReportInputSchema = z.object({
  message: trimmed(8000).min(1, "Falta el mensaje del error."),
  route: trimmed(2048).optional().nullable(),
  digest: trimmed(400).optional().nullable(),
});

export type ErrorReportInput = z.infer<typeof errorReportInputSchema>;

export type ErrorReportRow = {
  message: string;
  route: string | null;
  digest: string | null;
  user_agent: string | null;
  user_id: string | null;
};

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const JWT = /\beyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{5,}/g;
const BEARER = /\bbearer\s+[^\s"',;]+/gi;
const QUERY_SECRET = /\b(access_token|refresh_token|token_hash|token|apikey|api_key|code|key|secret|password)=[^\s&"',;]+/gi;
/** Cadenas largas con letras Y dígitos (tokens, claves): un nombre de función largo no cae aquí. */
const LONG_SECRET = /\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{32,}\b/g;
const LONG_DIGITS = /\b\d(?:[ -]?\d){8,}\b/g;

/** Quita del texto lo que podría identificar a alguien o abrir una sesión. */
export function scrubErrorText(text: string): string {
  return text
    .replace(CONTROL_CHARS, "")
    .replace(EMAIL, "[correo]")
    .replace(JWT, "[token]")
    .replace(BEARER, "Bearer [oculto]")
    .replace(QUERY_SECRET, (_m, key: string) => `${key}=[oculto]`)
    .replace(LONG_SECRET, "[oculto]")
    .replace(LONG_DIGITS, "[número]");
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Ruta sin origen, query ni hash. Los segmentos que son secretos por sí mismos (token de un plan
 * compartido) se reemplazan, y los UUID se generalizan a "[id]".
 */
export function sanitizeErrorRoute(route: string | null | undefined): string | null {
  if (!route) return null;
  let pathname: string;
  try {
    pathname = new URL(route, "http://x.invalid").pathname;
  } catch {
    return null;
  }
  if (!pathname.startsWith("/")) return null;
  const clean = pathname
    .replace(/^\/compartido\/([^/]+)\/[^/]+/, "/compartido/$1/[token]")
    .replace(UUID, "[id]")
    .replace(CONTROL_CHARS, "");
  return truncate(clean, ERROR_REPORT_LIMITS.route);
}

/** Fila lista para insertar. `userId` y `userAgent` vienen del servidor, nunca del cuerpo. */
export function buildErrorReportRow(
  input: ErrorReportInput,
  context: { userId: string | null; userAgent: string | null },
): ErrorReportRow {
  const message = truncate(scrubErrorText(input.message).trim() || "Error sin mensaje", ERROR_REPORT_LIMITS.message);
  const digest = input.digest ? truncate(input.digest.replace(/[^\w:.-]/g, ""), ERROR_REPORT_LIMITS.digest) || null : null;
  const userAgent = context.userAgent ? truncate(context.userAgent.replace(CONTROL_CHARS, "").trim(), ERROR_REPORT_LIMITS.userAgent) || null : null;
  return {
    message,
    route: sanitizeErrorRoute(input.route),
    digest,
    user_agent: userAgent,
    user_id: context.userId,
  };
}

/**
 * IP del cliente para el límite anónimo de la BD (`check_rate_limit` usa x-forwarded-for). Solo
 * acepta algo con forma de IP; si no, null (la BD usa entonces la IP de quien la llama).
 */
export function clientIpFrom(headers: Headers): string | null {
  const candidate = (headers.get("x-forwarded-for")?.split(",")[0] ?? headers.get("x-real-ip") ?? "").trim();
  if (!candidate || candidate.length > 45) return null;
  return /^[0-9a-f.:]+$/i.test(candidate) && /[.:]/.test(candidate) ? candidate : null;
}
