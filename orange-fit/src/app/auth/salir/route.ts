import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isSameOrigin } from "@/features/auth/server/same-origin";

/** Cierra la sesión de este dispositivo (POST desde un <form>) y vuelve a la portada. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Origen no permitido." } }, { status: 403 });
  }
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    // scope local: solo este dispositivo. Aunque el servidor de Auth falle, se borran las cookies.
    await supabase.auth.signOut({ scope: "local" });
  }
  revalidatePath("/", "layout");
  // 303: el navegador sigue con GET a la portada.
  return NextResponse.redirect(new URL("/", request.nextUrl.origin), { status: 303 });
}
