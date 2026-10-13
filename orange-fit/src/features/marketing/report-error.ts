/**
 * Envía un error de la interfaz a POST /api/errors (para el panel de errores del staff). Seguro de
 * usar desde cualquier pantalla de error (`error.tsx`) de cualquier módulo:
 *
 *   useEffect(() => { reportClientError(error); }, [error]);
 *
 * - Solo mensaje, ruta (sin query ni hash) y digest; el servidor agrega usuario y navegador.
 * - Un mismo error se reporta una sola vez por pestaña y hay un tope por sesión (evita bucles).
 * - Nunca lanza: si falla el envío, no hay nada más que hacer.
 */

const MAX_REPORTS_PER_TAB = 10;
const sent = new Set<string>();

export type ReportableError = { message?: string; digest?: string } | null | undefined;

export async function reportClientError(error: ReportableError, options: { route?: string } = {}): Promise<boolean> {
  if (typeof window === "undefined" || typeof fetch === "undefined") return false;
  try {
    const message = (error?.message || "Error sin mensaje").slice(0, 2000);
    const digest = error?.digest?.slice(0, 200) || undefined;
    const route = options.route ?? window.location.pathname;
    const key = `${digest ?? message}|${route}`;
    if (sent.has(key) || sent.size >= MAX_REPORTS_PER_TAB) return false;
    sent.add(key);

    const response = await fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, route, digest }),
      credentials: "same-origin",
      // Que el envío sobreviva si la persona sale de la página.
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Solo para pruebas. */
export function __resetReportedErrors() {
  sent.clear();
}
