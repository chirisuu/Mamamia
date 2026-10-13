import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNext } from "@/features/auth/redirect";
import { recordSignupConsents } from "@/features/auth/server/signup-consents";

const OTP_TYPES = new Set<string>(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

/**
 * Enlaces de los correos de Supabase (confirmación de cuenta, recuperación de contraseña).
 * - Plantilla recomendada: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…&next=…`
 *   → verifyOtp (funciona aunque el correo se abra en otro navegador).
 * - Plantilla por defecto de Supabase (PKCE): llega `?code=…` → exchangeCodeForSession.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  const code = params.get("code");
  const rawNext = params.get("next");
  const isRecovery = type === "recovery" || rawNext === "/nueva-clave";
  const next = safeNext(rawNext, isRecovery ? "/nueva-clave" : "/app");
  const failure = isRecovery ? "/recuperar?error=enlace" : "/verificar?error=enlace";
  const to = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin));

  if (!isSupabaseConfigured()) return to(failure);
  const supabase = await createSupabaseServerClient();

  let ok = false;
  if (tokenHash && type && OTP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }
  if (!ok) return to(failure);

  const { data } = await supabase.auth.getUser();
  if (data.user) {
    // Si falla no bloquea el ingreso: el onboarding vuelve a pedir términos y privacidad.
    await recordSignupConsents(supabase, data.user).catch(() => undefined);
  }
  return to(next);
}
