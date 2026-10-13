import { describe, expect, it } from "vitest";
import { callbackUrl, confirmUrl, safeNext } from "./redirect";
import { authErrorMessage, isRateLimited, RATE_LIMIT_MESSAGE } from "./errors";
import { loginSchema, newPasswordSchema, registerSchema } from "./schemas";
import { CONSENT_VERSION, isConsentActive, latestConsents, parseSignupConsents, type ConsentRow } from "./consents";

describe("safeNext", () => {
  it("acepta rutas internas con query y hash", () => {
    expect(safeNext("/app/diario?fecha=2026-10-13#cena")).toBe("/app/diario?fecha=2026-10-13#cena");
    expect(safeNext("/onboarding")).toBe("/onboarding");
  });

  it.each([
    ["https://malo.com/app"],
    ["//malo.com"],
    ["/\\malo.com"],
    ["javascript:alert(1)"],
    ["app"],
    [""],
    ["/app\n/x"],
    [undefined],
    [42],
  ])("rechaza %s", (value) => {
    expect(safeNext(value)).toBe("/app");
  });

  it("evita volver a pantallas de ingreso (bucles)", () => {
    expect(safeNext("/ingresar?next=/app")).toBe("/app");
    expect(safeNext("/auth/confirm")).toBe("/app");
    expect(safeNext("/registro")).toBe("/app");
    // Pero no confunde prefijos parecidos.
    expect(safeNext("/registros-viejos")).toBe("/registros-viejos");
  });

  it("usa el respaldo indicado", () => {
    expect(safeNext(null, "/nueva-clave")).toBe("/nueva-clave");
  });

  it("arma las URL de confirmación y callback con next saneado", () => {
    expect(confirmUrl("http://localhost:3000", "/onboarding")).toBe("http://localhost:3000/auth/confirm?next=%2Fonboarding");
    expect(confirmUrl("http://localhost:3000", "https://malo.com")).toBe("http://localhost:3000/auth/confirm?next=%2Fapp");
    expect(callbackUrl("https://orange.fit", null)).toBe("https://orange.fit/auth/callback");
  });
});

describe("authErrorMessage", () => {
  it("traduce los códigos conocidos", () => {
    expect(authErrorMessage({ code: "invalid_credentials", status: 400 }, "login")).toMatch(/no coinciden/);
    expect(authErrorMessage({ code: "email_not_confirmed", status: 400 }, "login")).toMatch(/confirmaste/);
    expect(authErrorMessage({ code: "over_request_rate_limit", status: 429 }, "login")).toBe(RATE_LIMIT_MESSAGE);
    expect(authErrorMessage({ code: "session_not_found" }, "update_password")).toMatch(/venció/);
    expect(authErrorMessage({ code: "session_not_found" }, "login")).toMatch(/sesión terminó/);
  });

  it("usa el status 429 aunque no haya código", () => {
    expect(authErrorMessage({ status: 429 }, "signup")).toBe(RATE_LIMIT_MESSAGE);
    expect(isRateLimited({ status: 429 })).toBe(true);
    expect(isRateLimited({ code: "over_email_send_rate_limit" })).toBe(true);
    expect(isRateLimited({ code: "invalid_credentials" })).toBe(false);
  });

  it("no muestra el texto en inglés del servidor", () => {
    const msg = authErrorMessage({ code: "something_new", status: 500, message: "Database error" }, "signup");
    expect(msg).not.toMatch(/Database/);
    expect(msg).toMatch(/No pudimos crear tu cuenta/);
  });

  it("reconoce la falta de conexión", () => {
    expect(authErrorMessage({ name: "AuthRetryableFetchError", status: 0 }, "login")).toMatch(/conexión/);
  });
});

describe("esquemas de autenticación", () => {
  it("normaliza el correo y exige contraseña al ingresar", () => {
    const parsed = loginSchema.parse({ email: "  Ana@Ejemplo.PE ", password: "x" });
    expect(parsed.email).toBe("ana@ejemplo.pe");
    expect(loginSchema.safeParse({ email: "ana@ejemplo.pe", password: "" }).success).toBe(false);
  });

  it("registro: contraseña de 8+, nombre y aceptación obligatoria", () => {
    const base = { displayName: "Ana", email: "ana@ejemplo.pe", password: "12345678", acceptTerms: true };
    expect(registerSchema.safeParse(base).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, password: "1234567" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, acceptTerms: false }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, displayName: "   " }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, email: "no-es-correo" }).success).toBe(false);
  });

  it("nueva contraseña: deben coincidir", () => {
    expect(newPasswordSchema.safeParse({ password: "abcdefgh", confirm: "abcdefgh" }).success).toBe(true);
    const bad = newPasswordSchema.safeParse({ password: "abcdefgh", confirm: "abcdefgx" });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.path).toEqual(["confirm"]);
  });
});

describe("consentimientos", () => {
  const row = (type: ConsentRow["consent_type"], granted: boolean, createdAt: string): ConsentRow => ({
    consent_type: type,
    granted,
    granted_at: createdAt,
    revoked_at: granted ? null : createdAt,
    created_at: createdAt,
    version: CONSENT_VERSION,
  });

  it("la fila más reciente por tipo manda", () => {
    const latest = latestConsents([
      row("marketing", true, "2026-10-01T10:00:00Z"),
      row("marketing", false, "2026-10-05T10:00:00Z"),
      row("health_data", true, "2026-10-01T10:00:00Z"),
    ]);
    expect(isConsentActive(latest, "marketing")).toBe(false);
    expect(isConsentActive(latest, "health_data")).toBe(true);
    expect(isConsentActive(latest, "ai_processing")).toBe(false);
  });

  it("lee la aceptación guardada al registrarse", () => {
    const meta = {
      display_name: "Ana",
      signup_consents: { version: "2026-10", terms: true, privacy: true, accepted_at: "2026-10-13T15:00:00.000Z" },
    };
    expect(parseSignupConsents(meta)?.version).toBe("2026-10");
    expect(parseSignupConsents({ signup_consents: { terms: false } })).toBeNull();
    expect(parseSignupConsents(null)).toBeNull();
  });
});
