import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

const PROTECTED_PREFIXES = ["/app", "/admin"];

/**
 * Refresca la sesión de Supabase en cada request y protege las áreas privadas.
 * La autorización real (roles, propiedad de datos) se vuelve a comprobar en el
 * servidor y en RLS: esto solo evita pintar pantallas privadas sin sesión.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // No poner lógica entre createServerClient y getClaims: puede cerrar sesiones al azar.
  const { data } = await supabase.auth.getClaims();
  const isAuthed = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;

  if (!isAuthed && PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    const login = request.nextUrl.clone();
    login.pathname = "/ingresar";
    login.searchParams.set("next", path + request.nextUrl.search);
    const redirect = NextResponse.redirect(login);
    for (const c of response.cookies.getAll()) redirect.cookies.set(c);
    return redirect;
  }
  return response;
}
