import { describe, expect, it } from "vitest";
import {
  ERROR_REPORT_LIMITS,
  buildErrorReportRow,
  clientIpFrom,
  errorReportInputSchema,
  sanitizeErrorRoute,
  scrubErrorText,
} from "./error-report";

describe("errorReportInputSchema", () => {
  it("exige mensaje y acepta ruta y digest opcionales", () => {
    expect(errorReportInputSchema.safeParse({ message: "Falló" }).success).toBe(true);
    expect(errorReportInputSchema.safeParse({ message: "Falló", route: "/app", digest: "123" }).success).toBe(true);
    expect(errorReportInputSchema.safeParse({ message: "Falló", route: null, digest: null }).success).toBe(true);
    expect(errorReportInputSchema.safeParse({}).success).toBe(false);
    expect(errorReportInputSchema.safeParse({ message: "   " }).success).toBe(false);
    expect(errorReportInputSchema.safeParse({ message: 42 }).success).toBe(false);
    expect(errorReportInputSchema.safeParse(null).success).toBe(false);
  });

  it("rechaza textos absurdamente largos (antes de truncar)", () => {
    expect(errorReportInputSchema.safeParse({ message: "x".repeat(8001) }).success).toBe(false);
    expect(errorReportInputSchema.safeParse({ message: "x", route: "/".repeat(2049) }).success).toBe(false);
  });

  it("descarta campos extra como user_id o status (el usuario sale de la sesión)", () => {
    const parsed = errorReportInputSchema.parse({ message: "x", user_id: "otro", status: "resolved" });
    expect(parsed).toEqual({ message: "x" });
  });
});

describe("scrubErrorText", () => {
  it("oculta correos, tokens, claves y números largos", () => {
    const out = scrubErrorText(
      "Fallo para ana.perez+test@correo.pe con eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abcdefghijk " +
        "Bearer sk_live_123 en /auth/confirm?token_hash=abc123&type=email y code=XYZ987 " +
        "clave 8f14e45fceea167a5a36dedd4bea2543a1b2c3d4 tarjeta 4111 1111 1111 1111 cel 987654321",
    );
    expect(out).not.toContain("ana.perez");
    expect(out).toContain("[correo]");
    expect(out).not.toContain("eyJhbGci");
    expect(out).not.toContain("sk_live_123");
    expect(out).toContain("token_hash=[oculto]");
    expect(out).toContain("code=[oculto]");
    expect(out).not.toContain("8f14e45fceea167a5a36dedd4bea2543");
    expect(out).not.toContain("4111");
    expect(out).not.toContain("987654321");
  });

  it("deja intactos los mensajes técnicos normales", () => {
    const msg = "TypeError: Cannot read properties of undefined (reading 'energyKcal') at useDailyTotalsForSelectedDate";
    expect(scrubErrorText(msg)).toBe(msg);
  });

  it("quita caracteres de control", () => {
    expect(scrubErrorText("a\u0000b\u0007c\nd")).toBe("abc\nd");
  });
});

describe("sanitizeErrorRoute", () => {
  it("quita origen, query y hash", () => {
    expect(sanitizeErrorRoute("https://orange.example/auth/confirm?token_hash=abc&type=email#x")).toBe("/auth/confirm");
    expect(sanitizeErrorRoute("/app/diario/2026-10-13?vista=semana")).toBe("/app/diario/2026-10-13");
  });

  it("oculta el token de los enlaces compartidos y generaliza ids", () => {
    expect(sanitizeErrorRoute("/compartido/plan/Zx9-secret-token")).toBe("/compartido/plan/[token]");
    expect(sanitizeErrorRoute("/app/perfil/profesional/pacientes/3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe(
      "/app/perfil/profesional/pacientes/[id]",
    );
  });

  it("vacío o inválido → null; largo → truncado", () => {
    expect(sanitizeErrorRoute(undefined)).toBeNull();
    expect(sanitizeErrorRoute("")).toBeNull();
    expect(sanitizeErrorRoute(`/${"a".repeat(900)}`)!.length).toBe(ERROR_REPORT_LIMITS.route);
  });
});

describe("buildErrorReportRow", () => {
  it("toma usuario y navegador del contexto, trunca y limpia", () => {
    const row = buildErrorReportRow(
      { message: `Error de ${"x".repeat(3000)} con yo@correo.pe`, route: "/app?x=1", digest: "12345<script>" },
      { userId: "u-1", userAgent: `Mozilla/5.0 ${"y".repeat(800)}` },
    );
    expect(row.user_id).toBe("u-1");
    expect(row.message.length).toBe(ERROR_REPORT_LIMITS.message);
    expect(row.route).toBe("/app");
    expect(row.digest).toBe("12345script");
    expect(row.user_agent!.length).toBe(ERROR_REPORT_LIMITS.userAgent);
  });

  it("sin sesión ni cabeceras", () => {
    expect(buildErrorReportRow({ message: "x" }, { userId: null, userAgent: null })).toEqual({
      message: "x",
      route: null,
      digest: null,
      user_agent: null,
      user_id: null,
    });
  });
});

describe("clientIpFrom", () => {
  it("toma la primera IP de x-forwarded-for o x-real-ip", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIpFrom(new Headers({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1");
  });

  it("ignora valores que no parecen IP", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "evil<script>" }))).toBeNull();
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "localhost" }))).toBeNull();
    expect(clientIpFrom(new Headers())).toBeNull();
  });
});
