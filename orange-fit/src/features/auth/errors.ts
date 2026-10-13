/**
 * Mensajes en español para los errores de Supabase Auth. Se decide por `code` (estable) y, si no
 * viene, por `status`. Nunca se muestra el mensaje en inglés del servidor tal cual.
 */
export type AuthContext = "login" | "signup" | "resend" | "reset" | "update_password" | "oauth" | "verify";

type AuthErrorLike = { code?: string | null; status?: number | null; message?: string | null; name?: string | null };

export const RATE_LIMIT_MESSAGE =
  "Hiciste demasiados intentos en poco tiempo. Espera unos minutos y vuelve a intentarlo.";

const BY_CODE: Record<string, string | ((ctx: AuthContext) => string)> = {
  invalid_credentials: "El correo o la contraseña no coinciden. Revisa e inténtalo otra vez.",
  email_not_confirmed:
    "Aún no confirmaste tu correo. Abre el enlace que te enviamos o pide uno nuevo.",
  over_request_rate_limit: RATE_LIMIT_MESSAGE,
  over_email_send_rate_limit:
    "Ya enviamos varios correos a esta dirección. Espera unos minutos antes de pedir otro.",
  user_already_exists: "Ya existe una cuenta con este correo. Ingresa o recupera tu contraseña.",
  email_exists: "Ya existe una cuenta con este correo. Ingresa o recupera tu contraseña.",
  weak_password: "La contraseña es muy débil. Usa al menos 8 caracteres y combina letras y números.",
  same_password: "La nueva contraseña debe ser distinta de la anterior.",
  email_address_invalid: "Ese correo no parece válido. Revísalo.",
  email_address_not_authorized: "No podemos enviar correos a esa dirección. Usa otro correo.",
  signup_disabled: "Por ahora no estamos aceptando registros nuevos.",
  email_provider_disabled: "El ingreso con correo está desactivado en este momento.",
  provider_disabled: "Ese método de ingreso no está activado.",
  oauth_provider_not_supported: "Ese método de ingreso no está activado.",
  user_banned: "Esta cuenta está suspendida. Escríbenos si crees que es un error.",
  otp_expired: "El enlace venció o ya se usó. Pide uno nuevo.",
  flow_state_expired: "El enlace venció. Vuelve a intentarlo desde el inicio.",
  flow_state_not_found: "No pudimos completar el ingreso. Vuelve a intentarlo desde este mismo navegador.",
  bad_code_verifier: "No pudimos completar el ingreso. Vuelve a intentarlo desde este mismo navegador.",
  session_not_found: (ctx) =>
    ctx === "update_password"
      ? "Tu enlace para cambiar la contraseña venció. Pide uno nuevo."
      : "Tu sesión terminó. Vuelve a ingresar.",
  session_expired: (ctx) =>
    ctx === "update_password"
      ? "Tu enlace para cambiar la contraseña venció. Pide uno nuevo."
      : "Tu sesión terminó. Vuelve a ingresar.",
  reauthentication_needed: "Por seguridad, vuelve a ingresar antes de cambiar tu contraseña.",
  captcha_failed: "No pudimos verificar que eres una persona. Inténtalo de nuevo.",
  request_timeout: "El servidor tardó demasiado en responder. Inténtalo de nuevo.",
  validation_failed: "Revisa los datos ingresados.",
};

const FALLBACK: Record<AuthContext, string> = {
  login: "No pudimos iniciar sesión. Inténtalo de nuevo en un momento.",
  signup: "No pudimos crear tu cuenta. Inténtalo de nuevo en un momento.",
  resend: "No pudimos reenviar el correo. Inténtalo de nuevo en un momento.",
  reset: "No pudimos enviar el enlace. Inténtalo de nuevo en un momento.",
  update_password: "No pudimos cambiar tu contraseña. Inténtalo de nuevo.",
  oauth: "No pudimos conectar con Google. Inténtalo de nuevo.",
  verify: "No pudimos verificar el enlace. Pide uno nuevo.",
};

export function authErrorMessage(error: AuthErrorLike | null | undefined, ctx: AuthContext): string {
  if (!error) return FALLBACK[ctx];
  const code = error.code ?? undefined;
  if (code && code in BY_CODE) {
    const entry = BY_CODE[code]!;
    return typeof entry === "function" ? entry(ctx) : entry;
  }
  if (error.status === 429) return RATE_LIMIT_MESSAGE;
  // Sin red o con Supabase caído, supabase-js devuelve AuthRetryableFetchError (status 0 o >= 500).
  if (error.name === "AuthRetryableFetchError" || error.status === 0) {
    return "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
  }
  if (ctx === "login" && error.status === 400) return BY_CODE.invalid_credentials as string;
  return FALLBACK[ctx];
}

export function isRateLimited(error: AuthErrorLike | null | undefined): boolean {
  return Boolean(
    error &&
      (error.status === 429 ||
        error.code === "over_request_rate_limit" ||
        error.code === "over_email_send_rate_limit"),
  );
}
