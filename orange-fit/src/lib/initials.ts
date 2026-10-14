/**
 * Iniciales para el fallback del avatar: "María José" → "MJ". Vive fuera de
 * components/ui/avatar.tsx porque ese módulo es "use client" y las páginas de servidor no pueden
 * llamar funciones de un módulo de cliente (Next lanza en el render del servidor).
 */
export function initials(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}
