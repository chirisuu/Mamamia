import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNext } from "@/features/auth/redirect";

/** Retorno de OAuth (Google): canjea el código PKCE por la sesión y sigue a `next`. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const next = safeNext(params.get("next"));
  const to = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin));

  // El proveedor devuelve ?error=access_denied si la persona cancela.
  if (params.get("error")) return to(`/ingresar?error=oauth&next=${encodeURIComponent(next)}`);
  if (!code || !isSupabaseConfigured()) return to(`/ingresar?error=oauth&next=${encodeURIComponent(next)}`);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return to(`/ingresar?error=oauth&next=${encodeURIComponent(next)}`);
  return to(next);
}
