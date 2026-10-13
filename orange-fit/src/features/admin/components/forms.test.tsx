// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const saveSettingsAction = vi.fn();
const saveContentPageAction = vi.fn();
const saveFoodAction = vi.fn();
vi.mock("../actions/settings", () => ({ saveSettingsAction: (...a: unknown[]) => saveSettingsAction(...a) }));
vi.mock("../actions/content", () => ({ saveContentPageAction: (...a: unknown[]) => saveContentPageAction(...a) }));
vi.mock("../actions/foods", () => ({ saveFoodAction: (...a: unknown[]) => saveFoodAction(...a) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ContentEditor } from "./content-editor";
import { EMPTY_FOOD, FoodForm } from "./food-form";
import { SettingsForm } from "./settings-form";

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  saveSettingsAction.mockReset();
  saveContentPageAction.mockReset();
  saveFoodAction.mockReset();
});

const settings = {
  appName: "ORANGE FIT",
  supportEmail: "soporte@example.com",
  defaultTrialDays: 7,
  maintenanceBanner: "",
  featureFlags: [
    { key: "ai_photo", enabled: true },
    { key: "payments_mercadopago", enabled: false },
    { key: "payments_stripe", enabled: true },
  ],
};

describe("SettingsForm", () => {
  it("muestra los medios de pago con su estado real y permite encender Mercado Pago", async () => {
    saveSettingsAction.mockResolvedValue({ ok: true, data: { changed: ["feature_flags"] } });
    render(<SettingsForm initial={settings} paymentsConfigured={{ stripe: false, mercadopago: true }} />);
    expect(screen.getByText("Medios de pago")).toBeInTheDocument();
    expect(screen.getByText(/Credenciales pendientes de configurar/)).toBeInTheDocument();
    expect(screen.getByText(/Configurado, pero apagado/)).toBeInTheDocument();
    // Los de pagos no aparecen en la lista genérica (no se pueden borrar).
    expect(screen.queryByRole("button", { name: "Quitar payments_mercadopago" })).toBeNull();
    expect(screen.getByRole("button", { name: "Quitar ai_photo" })).toBeInTheDocument();
    expect(screen.getByText("Sin efecto todavía")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: "Mercado Pago" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar configuración" }));
    await waitFor(() => expect(saveSettingsAction).toHaveBeenCalledTimes(1));
    const sent = saveSettingsAction.mock.calls[0][0] as typeof settings;
    expect(sent.featureFlags.find((f) => f.key === "payments_mercadopago")?.enabled).toBe(true);
    expect(sent.featureFlags.find((f) => f.key === "payments_stripe")?.enabled).toBe(true);
  });

  it("no envía si el correo es inválido", async () => {
    render(<SettingsForm initial={{ ...settings, supportEmail: "no-es-correo" }} paymentsConfigured={{ stripe: true, mercadopago: true }} />);
    fireEvent.click(screen.getByRole("button", { name: "Guardar configuración" }));
    expect(await screen.findByText("Escribe un correo válido.")).toBeInTheDocument();
    expect(saveSettingsAction).not.toHaveBeenCalled();
  });
});

describe("ContentEditor", () => {
  it("la vista previa no ejecuta HTML y el servidor recibe el markdown tal cual", async () => {
    saveContentPageAction.mockResolvedValue({ ok: true, data: { id: "x", slug: "faq-x" } });
    const { container } = render(<ContentEditor initial={{ id: null, slug: "", title: "", kind: "faq", status: "draft", sortOrder: 10, bodyMd: "" }} />);
    fireEvent.change(screen.getByLabelText("Pregunta"), { target: { value: "¿Es segura?" } });
    fireEvent.change(screen.getByLabelText("Dirección (slug)"), { target: { value: "faq-segura" } });
    const body = '**Sí**. <img src=x onerror="alert(1)"> [mal](javascript:alert(1))';
    fireEvent.change(screen.getByLabelText("Texto (markdown)"), { target: { value: body } });
    await waitFor(() => expect(container.querySelector("[data-slot=markdown] strong")?.textContent).toBe("Sí"));
    expect(container.querySelector("[data-slot=markdown] img")).toBeNull();
    expect(container.querySelector("[data-slot=markdown] a")).toBeNull();
    expect(screen.getByText(/se muestra en \/faq/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Crear contenido" }));
    await waitFor(() => expect(saveContentPageAction).toHaveBeenCalledTimes(1));
    expect(saveContentPageAction.mock.calls[0][0]).toMatchObject({ slug: "faq-segura", title: "¿Es segura?", kind: "faq", bodyMd: body });
  });
});

describe("FoodForm", () => {
  it("exige procedencia y macros antes de enviar, y avisa si la energía no cuadra", async () => {
    render(<FoodForm initial={EMPTY_FOOD} />);
    fireEvent.click(screen.getByRole("button", { name: "Crear alimento" }));
    expect(await screen.findByText(/Indica de dónde salen los valores/)).toBeInTheDocument();
    expect(saveFoodAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/^Energía/), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText(/^Proteína/), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/^Carbohidratos/), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText(/^Grasa \(g\)/), { target: { value: "1" } });
    expect(await screen.findByText("Revisa la energía")).toBeInTheDocument();
  });
});
