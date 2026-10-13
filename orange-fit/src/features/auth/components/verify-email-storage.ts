/**
 * El correo recién registrado pasa a /verificar por sessionStorage (no por la URL), para que no
 * quede en el historial ni en los registros del servidor.
 */
const KEY = "orangefit:verify-email";

export function rememberVerifyEmail(email: string): void {
  try {
    sessionStorage.setItem(KEY, email);
  } catch {
    // Modo privado o almacenamiento bloqueado: /verificar pedirá el correo.
  }
}

export function readVerifyEmail(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
