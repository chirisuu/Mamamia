import { z } from "zod";

/**
 * Variables de entorno. Las públicas (NEXT_PUBLIC_*) llegan al navegador; el
 * resto solo existe en el servidor. Nada aquí tiene valores por defecto secretos:
 * si falta una credencial, la función correspondiente queda "pendiente de
 * configurar" y la UI lo dice, en vez de fingir que funciona.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).optional(),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || undefined,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || undefined,
});

/** Nombre por defecto; el nombre vigente se lee de app_settings (editable en /admin). */
export const DEFAULT_APP_NAME = publicEnv.NEXT_PUBLIC_APP_NAME ?? "ORANGE FIT";

export function siteUrl(): string {
  return publicEnv.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_URL && publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
