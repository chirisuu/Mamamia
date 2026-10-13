/**
 * Ruta de regreso tras crear un alimento. Solo se aceptan rutas internas del registro
 * (evita redirecciones abiertas con `?volver=https://…`).
 */
const ALLOWED_PATHS = [/^\/app\/agregar(\/(buscar|codigo))?$/, /^\/app\/diario\/\d{4}-\d{2}-\d{2}$/];

export function safeReturnTo(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  try {
    const url = new URL(value, "http://local");
    if (url.origin !== "http://local") return null;
    if (!ALLOWED_PATHS.some((re) => re.test(url.pathname))) return null;
    // Se descarta un q previo: al volver se busca el alimento recién creado.
    url.searchParams.delete("q");
    const qs = url.searchParams.toString();
    return `${url.pathname}${qs ? `?${qs}` : ""}`;
  } catch {
    return null;
  }
}
