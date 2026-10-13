/**
 * Destinos seguros tras ingresar, confirmar el correo o salir. `next` llega por la URL, así que
 * solo se aceptan rutas internas: nunca `//otro-sitio`, `https://…` ni `javascript:`.
 */
export const DEFAULT_AFTER_LOGIN = "/app";

const BASE = "http://orange-fit.invalid";

/** Rutas a las que no tiene sentido volver después de autenticarse (provocarían un bucle). */
const NO_RETURN_PATHS = ["/ingresar", "/registro", "/verificar", "/recuperar", "/auth"];

function isNoReturnPath(path: string): boolean {
  return NO_RETURN_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export function safeNext(value: unknown, fallback: string = DEFAULT_AFTER_LOGIN): string {
  if (typeof value !== "string") return fallback;
  const raw = value.trim();
  if (!raw || raw.length > 512) return fallback;
  // Solo rutas relativas a la raíz. "//x" y "/\x" los navegadores los tratan como otro host.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  // Caracteres de control (incluidos tab y saltos de línea, que algunos navegadores ignoran).
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;
  if (isNoReturnPath(url.pathname)) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** URL absoluta de /auth/confirm con el destino posterior ya saneado. */
export function confirmUrl(siteUrl: string, next?: string | null): string {
  const url = new URL("/auth/confirm", siteUrl);
  if (next) url.searchParams.set("next", safeNext(next));
  return url.toString();
}

/** URL absoluta de /auth/callback (OAuth) con el destino posterior ya saneado. */
export function callbackUrl(siteUrl: string, next?: string | null): string {
  const url = new URL("/auth/callback", siteUrl);
  if (next) url.searchParams.set("next", safeNext(next));
  return url.toString();
}

/**
 * Las plantillas de correo (supabase/templates) mandan el destino dentro de `redirect_to`
 * (`…/auth/confirm?next=…`). Devuelve ese `next` sin sanear: pásalo por `safeNext`.
 */
export function nextFromRedirectTo(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).searchParams.get("next");
  } catch {
    return null;
  }
}
