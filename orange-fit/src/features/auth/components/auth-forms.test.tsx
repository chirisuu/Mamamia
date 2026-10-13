// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const replace = vi.fn();
const push = vi.fn();
const refresh = vi.fn();
const auth = {
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resend: vi.fn(),
  signInWithOAuth: vi.fn(),
};

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push, refresh }) }));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({ auth }) }));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
beforeEach(() => {
  for (const fn of [replace, push, refresh, ...Object.values(auth)]) fn.mockReset();
  sessionStorage.clear();
});
afterEach(cleanup);

describe("LoginForm", () => {
  it("ingresa y vuelve a `next`", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    const { LoginForm } = await import("./login-form");
    render(<LoginForm next="/app/diario" siteUrl="http://localhost:3000" googleEnabled={false} />);
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "Ana@Ejemplo.pe" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "secreta123" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app/diario"));
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "ana@ejemplo.pe", password: "secreta123" });
    // Sin la variable de entorno no se ofrece Google.
    expect(screen.queryByRole("button", { name: /Google/ })).toBeNull();
  });

  it("explica credenciales inválidas y correo sin verificar (con reenvío)", async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: { code: "invalid_credentials", status: 400 } });
    const { LoginForm } = await import("./login-form");
    render(<LoginForm next="/app" siteUrl="http://localhost:3000" googleEnabled />);
    expect(screen.getByRole("button", { name: /Continuar con Google/ })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "ana@ejemplo.pe" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByText(/no coinciden/)).toBeInTheDocument();

    auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: { code: "email_not_confirmed", status: 400 } });
    auth.resend.mockResolvedValue({ error: null });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Reenviar correo de verificación" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/verificar?reenviado=1"));
    expect(auth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "ana@ejemplo.pe",
      options: { emailRedirectTo: "http://localhost:3000/auth/confirm?next=%2Fapp" },
    });
    expect(sessionStorage.getItem("orangefit:verify-email")).toBe("ana@ejemplo.pe");
  });

  it("demasiados intentos", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { code: "over_request_rate_limit", status: 429 } });
    const { LoginForm } = await import("./login-form");
    render(<LoginForm next="/app" siteUrl="http://localhost:3000" googleEnabled={false} />);
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "ana@ejemplo.pe" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByText(/demasiados intentos/)).toBeInTheDocument();
  });
});

describe("RegisterForm", () => {
  it("valida, registra con emailRedirectTo a /auth/confirm y guarda la aceptación en metadatos", async () => {
    auth.signUp.mockResolvedValue({ data: { user: { id: "u1" }, session: null }, error: null });
    const { RegisterForm } = await import("./register-form");
    render(<RegisterForm next="/app" siteUrl="http://localhost:3000" googleEnabled={false} fromOnboarding />);

    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta y guardar mi plan" }));
    expect(await screen.findByText("Escribe tu nombre.")).toBeInTheDocument();
    expect(screen.getByText(/Debes aceptar los términos/)).toBeInTheDocument();
    expect(auth.signUp).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("¿Cómo te llamas?"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "ana@ejemplo.pe" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "1234567" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta y guardar mi plan" }));
    expect(await screen.findByText("Usa al menos 8 caracteres.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "12345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta y guardar mi plan" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/verificar?from=onboarding"));
    const call = auth.signUp.mock.calls[0]![0] as {
      email: string;
      options: { emailRedirectTo: string; data: { display_name: string; signup_consents: Record<string, unknown> } };
    };
    expect(call.email).toBe("ana@ejemplo.pe");
    expect(call.options.emailRedirectTo).toBe("http://localhost:3000/auth/confirm?next=%2Fonboarding");
    expect(call.options.data.display_name).toBe("Ana");
    expect(call.options.data.signup_consents).toMatchObject({ version: "2026-10", terms: true, privacy: true });
  });
});

describe("ManualTargetsForm (revisión en vivo)", () => {
  it("bloquea bajo el piso y pide confirmar avisos", async () => {
    vi.doMock("@/features/profile/actions", () => ({ saveManualTargets: vi.fn(), proposeProfessionalTarget: vi.fn() }));
    const { ManualTargetsForm } = await import("@/features/profile/components/manual-targets-form");
    render(
      <ManualTargetsForm
        context={{ sex: "female", bmr: 1390, tdee: 1910, deficitBlocked: false, cautious: false }}
        defaults={{ energyKcal: 1600, proteinG: 120, carbsG: 167, fatG: 50, fiberG: 22, waterMl: 2000 }}
      />,
    );
    const kcal = screen.getByLabelText(/Calorías/);
    const save = screen.getByRole("button", { name: "Guardar meta manual" });
    expect(save).toBeEnabled();
    fireEvent.change(kcal, { target: { value: "1100" } });
    expect(screen.getByText(/No podemos guardar metas por debajo de 1,200 kcal/)).toBeInTheDocument();
    expect(save).toBeDisabled();
    fireEvent.change(kcal, { target: { value: "1300" } });
    expect(screen.getByText(/metabolismo basal estimado/)).toBeInTheDocument();
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /Leí los avisos/ }));
    expect(save).toBeEnabled();
  });
});
