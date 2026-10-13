import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/database.types";
import { publicEnv } from "@/lib/env";

/**
 * Cliente de servidor ligado a la sesión del usuario (cookies). Usa la clave
 * anónima: las políticas RLS deciden qué puede ver y tocar.
 */
export async function createSupabaseServerClient() {
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL || !publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase no está configurado.");
  }
  const cookieStore = await cookies();
  return createServerClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Llamado desde un Server Component: el refresco de sesión lo hace proxy.ts.
        }
      },
    },
  });
}
