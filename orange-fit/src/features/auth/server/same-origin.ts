import "server-only";

/**
 * Los route handlers no tienen la verificación de origen de las server actions. Para POST que
 * cambian estado (salir, eliminar cuenta) hacemos lo mismo que Next: Origin debe coincidir con
 * Host / X-Forwarded-Host. Sin cabecera Origin (mismo origen en navegadores antiguos) se acepta.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
