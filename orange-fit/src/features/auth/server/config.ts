import "server-only";
import { siteUrl } from "@/lib/env";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Primer valor de un parámetro de búsqueda (Next entrega string | string[]). */
export function firstParam(params: Record<string, string | string[] | undefined>, key: string): string | null {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Configuración de las pantallas de ingreso. Google solo aparece con
 * NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true (y el proveedor activo en Supabase Auth).
 */
export function authUiConfig() {
  return {
    siteUrl: siteUrl(),
    googleEnabled: process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true",
  };
}
