// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EMPTY_CONSENTS, ONBOARDING_STORAGE_KEY } from "../schemas";

const push = vi.fn();
const completeOnboarding = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  unstable_rethrow: () => undefined,
}));
vi.mock("../actions", () => ({
  completeOnboarding: (...args: unknown[]) => completeOnboarding(...args),
  grantHealthConsentAgain: vi.fn(),
}));
// Sin animaciones en jsdom: cada paso se monta al instante.
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    section: ({ children, initial, animate, exit, transition, custom, ...rest }: Record<string, unknown> & { children: React.ReactNode }) => {
      void initial;
      void animate;
      void exit;
      void transition;
      void custom;
      return <section {...(rest as React.ComponentProps<"section">)}>{children}</section>;
    },
  },
}));

beforeAll(() => {
  // Radix usa ResizeObserver y scrollTo no existe en jsdom.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.scrollTo = () => undefined;
});

beforeEach(() => {
  localStorage.clear();
  push.mockReset();
  completeOnboarding.mockReset();
});
afterEach(cleanup);

async function renderWizard(isAuthenticated: boolean) {
  const { OnboardingWizard } = await import("./wizard");
  return render(
    <OnboardingWizard
      appName="ORANGE FIT"
      isAuthenticated={isAuthenticated}
      accountEmail={isAuthenticated ? "ana@example.com" : null}
      initialAnswers={{}}
      initialConsents={{ ...EMPTY_CONSENTS }}
      initialStepId="intro"
      hasProgress={false}
      today="2026-10-13"
      timezone="America/Lima"
      redo={false}
    />,
  );
}

const next = () => fireEvent.click(screen.getByRole("button", { name: /^(Empezar|Siguiente|Continuar)$/ }));
const choose = (name: RegExp) => fireEvent.click(screen.getByRole("radio", { name }));
const heading = () => screen.getByRole("heading", { level: 1 }).textContent;

async function walkToConsents(container: HTMLElement) {
  expect(heading()).toBe("Armemos tu plan");
  next();
  // Sin nombre no avanza y lo dice.
  next();
  expect(screen.getByRole("alert").textContent).toBe("Escribe tu nombre.");
  fireEvent.change(screen.getByRole("textbox", { name: "¿Cómo te llamas?" }), { target: { value: "Ana" } });
  next();
  expect(heading()).toBe("¿Cuándo naciste?");
  fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: "1994-05-20" } });
  expect(screen.getByText("Tienes 32 años.")).toBeInTheDocument();
  next();
  choose(/Mujer/);
  next();
  expect(heading()).toBe("¿Cuánto mides?");
  expect(screen.getByRole("spinbutton", { name: "Estatura" })).toHaveValue("158");
  next();
  next(); // peso 62 kg por defecto
  next(); // peso objetivo = peso actual
  choose(/Ligero/);
  next();
  next(); // 0 sesiones
  choose(/Perder grasa/);
  next();
  expect(heading()).toBe("¿A qué ritmo quieres bajar?");
  // 0.5 % de 62 kg = 0.31 kg/semana, visible en la opción.
  expect(screen.getByRole("radio", { name: /Moderado/ }).textContent).toContain("0.31 kg menos");
  next();
  expect(screen.getByRole("alert").textContent).toBe("Elige un ritmo.");
  choose(/Moderado/);
  next();
  choose(/Como de todo/);
  next();
  fireEvent.click(screen.getAllByRole("button", { name: "Maní" })[0]!);
  next(); // alergias
  next(); // restricciones
  next(); // país y moneda (Perú / PEN)
  fireEvent.click(screen.getByRole("button", { name: /Prefiero no indicarlo/ }));
  next();
  choose(/3 comidas/);
  next();
  choose(/Recién empiezo/);
  next();
  expect(heading()).toBe("¿Alguna de estas situaciones aplica a ti?");
  next();
  expect(heading()).toBe("Ana, este es tu punto de partida");
  expect(screen.getByText("Cómo lo calculamos")).toBeInTheDocument();
  expect(screen.getByText(/reemplazan la evaluación de un profesional/)).toBeInTheDocument();
  next();
  expect(heading()).toBe("Tu permiso para guardar tu plan");
}

describe("asistente de onboarding", () => {
  it("sin sesión: recorre todas las preguntas, exige los permisos y lleva a crear la cuenta", async () => {
    const { container } = await renderWizard(false);
    await walkToConsents(container);

    fireEvent.click(screen.getByRole("button", { name: "Crea tu cuenta para guardar tu plan" }));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert").map((a) => a.textContent)).toEqual([
      "Debes aceptar los términos y la política de privacidad.",
      "Sin este permiso no podemos guardar tus datos de salud ni tu plan.",
    ]);

    fireEvent.click(screen.getByRole("checkbox", { name: /He leído y acepto/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Autorizo de forma expresa/ }));
    fireEvent.click(screen.getByRole("button", { name: "Crea tu cuenta para guardar tu plan" }));
    expect(push).toHaveBeenCalledWith("/registro?from=onboarding");

    const draft = JSON.parse(localStorage.getItem(ONBOARDING_STORAGE_KEY)!);
    expect(draft.stage).toBe("awaiting_account");
    expect(draft.answers).toMatchObject({ displayName: "Ana", goal: "lose_fat", weeklyRateKg: 0.31, allergies: ["mani"], weeklyBudget: null });
    expect(draft.consents).toEqual({ termsPrivacy: true, healthData: true, aiProcessing: false, marketing: false });
  });

  it("con sesión: guarda con completeOnboarding y, si falla, muestra el error y conserva el borrador", async () => {
    completeOnboarding.mockResolvedValue({ ok: false, error: { code: "DB_ERROR", message: "No pudimos guardar tu plan." } });
    const { container } = await renderWizard(true);
    await walkToConsents(container);
    fireEvent.click(screen.getByRole("checkbox", { name: /He leído y acepto/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Autorizo de forma expresa/ }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar mi plan" }));
    expect(await screen.findByText("No pudimos guardar tu plan.")).toBeInTheDocument();
    expect(completeOnboarding).toHaveBeenCalledTimes(1);
    const [submission] = completeOnboarding.mock.calls[0] as [{ answers: Record<string, unknown>; timezone: string }];
    expect(submission.timezone).toBe("America/Lima");
    expect(submission.answers).toMatchObject({ displayName: "Ana", birthDate: "1994-05-20", heightCm: 158, weightKg: 62 });
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).not.toBeNull();
  });
});
