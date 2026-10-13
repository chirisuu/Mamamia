"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/database.types";
import { publicEnv } from "@/lib/env";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Cliente de navegador: solo la clave anónima; todo acceso queda sujeto a RLS. */
export function createSupabaseBrowserClient() {
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL || !publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase no está configurado (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  }
  browserClient ??= createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return browserClient;
}
