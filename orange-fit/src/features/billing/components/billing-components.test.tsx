// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { PriceOption } from "../catalog-view";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }) }));
const toastSuccess = vi.fn();
vi.mock("@/components/ui/sonner", () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a) } }));

const { PremiumCheckout } = await import("./premium-checkout");
const { ConfirmingPayment } = await import("./confirming-payment");
const { SubscriptionActions } = await import("./subscription-actions");
const { PricingTable } = await import("./pricing-table");

const assign = vi.fn();
const fetchMock = vi.fn();

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Object.defineProperty(window, "location", { value: { ...window.location, assign }, writable: true });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});
beforeEach(() => {
  for (const fn of [refresh, toastSuccess, assign, fetchMock]) fn.mockReset();
});
afterEach(cleanup);

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const prices: PriceOption[] = [
  { id: "pm", interval: "month", currency: "PEN", amountCents: 2990, trialDays: 7, stripeReady: false },
  { id: "py", interval: "year", currency: "PEN", amountCents: 19990, trialDays: 7, stripeReady: false },
  { id: "um", interval: "month", currency: "USD", amountCents: 799, trialDays: 7, stripeReady: true },
  { id: "uy", interval: "year", currency: "USD", amountCents: 5499, trialDays: 7, stripeReady: true },
];
const off = { available: false, reason: "Pagos pendientes de configurar." };
const on = { available: true, reason: null };

describe("PremiumCheckout", () => {
  it("sin proveedores: todo deshabilitado y lo dice (sin botón falso)", () => {
    render(<PremiumCheckout prices={prices} trialEligible providers={{ stripe: off, mercadopago: off }} />);
    const button = screen.getByRole("button", { name: "Pagos pendientes de configurar" });
    expect(button).toBeDisabled();
    expect(screen.getAllByText("Pagos pendientes de configurar.")).toHaveLength(2);
    const methods = within(screen.getByRole("radiogroup", { name: "Medio de pago" })).getAllByRole("radio");
    expect(methods).toHaveLength(2);
    for (const radio of methods) expect(radio).toBeDisabled();
  });

  it("Mercado Pago disponible: envía priceId + proveedor y va a la página de pago", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { url: "https://www.mercadopago.com.pe/checkout/x" }));
    render(<PremiumCheckout prices={prices} trialEligible providers={{ stripe: off, mercadopago: on }} />);
    expect(screen.getByText(/7 días de prueba gratis/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Empezar prueba gratis" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://www.mercadopago.com.pe/checkout/x"));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/billing/checkout");
    expect(JSON.parse(String(init.body))).toEqual({ priceId: "pm", provider: "mercadopago" });
  });

  it("anual con Stripe usa el precio en dólares; sin prueba si ya tuvo Premium", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { url: "https://checkout.stripe.com/c/pay/cs_x" }));
    render(<PremiumCheckout prices={prices} trialEligible={false} providers={{ stripe: on, mercadopago: off }} />);
    fireEvent.mouseDown(screen.getByRole("radio", { name: /Anual/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Anual/ }));
    await waitFor(() => expect(screen.getByRole("radio", { name: /Anual/ })).toHaveAttribute("aria-checked", "true"));
    expect(screen.queryByText(/prueba gratis/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar al pago" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({ priceId: "uy", provider: "stripe" });
  });

  it("muestra el error real del servidor (409 ya suscrita) con enlace a Suscripción", async () => {
    fetchMock.mockResolvedValueOnce(json(409, { error: { code: "ALREADY_SUBSCRIBED", message: "Ya tienes Premium." } }));
    render(<PremiumCheckout prices={prices} trialEligible providers={{ stripe: off, mercadopago: on }} />);
    fireEvent.click(screen.getByRole("button", { name: "Empezar prueba gratis" }));
    expect(await screen.findByText("Ya tienes Premium.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a mi suscripción" })).toHaveAttribute("href", "/app/perfil/suscripcion");
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("ConfirmingPayment", () => {
  it("cuando el servidor confirma, refresca la página (el 'listo' lo pinta el servidor)", async () => {
    fetchMock.mockResolvedValue(json(200, { state: "confirmed", label: "Prueba gratis" }));
    render(<ConfirmingPayment sessionId="cs_test_abcdefghij" preapprovalId={null} supportEmail={null} />);
    expect(screen.getByText("Estamos confirmando tu pago")).toBeInTheDocument();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({ sessionId: "cs_test_abcdefghij" });
  });

  it("si el proveedor reporta un problema, lo dice y no promete nada", async () => {
    fetchMock.mockResolvedValue(json(200, { state: "payment_issue", label: "Pago pendiente" }));
    render(<ConfirmingPayment sessionId={null} preapprovalId="2c938084abcdef" supportEmail={null} />);
    expect(await screen.findByText("El pago no se completó")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("sin conexión: tras varios fallos ofrece volver a revisar", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock.mockRejectedValue(new TypeError("offline"));
    render(<ConfirmingPayment sessionId={null} preapprovalId={null} supportEmail="ayuda@example.com" />);
    await vi.advanceTimersByTimeAsync(9000);
    expect(await screen.findByText("No pudimos revisar el estado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver a revisar" })).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("SubscriptionActions", () => {
  const base = {
    provider: "stripe" as const,
    status: "active" as const,
    canCancel: true,
    providerConfigured: true,
    accessUntil: "13 de noviembre de 2026",
    manageHref: null,
    supportEmail: null,
  };

  it("cancelar pide confirmación, explica hasta cuándo y llama a la API", async () => {
    fetchMock.mockResolvedValueOnce(json(200, { subscription: { hasAccess: true } }));
    render(<SubscriptionActions {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar renovación" }));
    expect(await screen.findByText(/Seguirás con Premium hasta el 13 de noviembre de 2026/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sí, cancelar renovación" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("/api/billing/cancel");
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("sin claves del proveedor: botones deshabilitados con el motivo", () => {
    render(<SubscriptionActions {...base} providerConfigured={false} supportEmail="ayuda@example.com" />);
    expect(screen.getByRole("button", { name: "Cancelar renovación" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Gestionar pago en Stripe/ })).toBeDisabled();
    expect(screen.getByText(/pendientes de configurar en el servidor/)).toBeInTheDocument();
  });

  it("Mercado Pago: enlace a su panel y el aviso de que los cobros se detienen ya", async () => {
    render(<SubscriptionActions {...base} provider="mercadopago" manageHref="https://www.mercadopago.com.pe/subscriptions" />);
    expect(screen.getByRole("link", { name: /Ver mi suscripción en Mercado Pago/ })).toHaveAttribute("href", "https://www.mercadopago.com.pe/subscriptions");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar renovación" }));
    expect(await screen.findByText(/Mercado Pago detendrá los cobros desde ahora/)).toBeInTheDocument();
  });
});

describe("PricingTable", () => {
  const card = (id: string, premium: boolean) => ({
    id,
    name: premium ? "Premium" : "Gratis",
    description: null,
    features: premium
      ? [
          { code: "macros", label: "Calorías y macros calculados para ti", premium: false },
          { code: "ai_photo", label: "Registro con foto e IA", premium: true },
        ]
      : [{ code: "macros", label: "Calorías y macros calculados para ti", premium: false }],
    aiLimits: premium ? ["120 registros con foto al mes"] : [],
  });

  it("mensual por defecto; al pasar a anual muestra el ahorro calculado", async () => {
    render(<PricingTable free={card("free", false)} premium={card("premium", true)} premiumPrices={prices} paymentsAvailable />);
    expect(screen.getByText(/S\/ 29\.90/)).toBeInTheDocument();
    expect(screen.getByText(/o .*7\.99 al mes con tarjeta internacional/)).toBeInTheDocument();
    const annual = screen.getByRole("radio", { name: /Anual · ahorra 44 %/ });
    fireEvent.mouseDown(annual);
    fireEvent.click(annual);
    expect(await screen.findByText(/S\/ 199\.90/)).toBeInTheDocument();
    expect(screen.getByText(/ahorras S\/ 158\.90/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Probar Premium gratis" })).toHaveAttribute("href", "/app/premium");
  });

  it("sin pagos configurados no hay botón activo para Premium", () => {
    render(<PricingTable free={card("free", false)} premium={card("premium", true)} premiumPrices={prices} paymentsAvailable={false} />);
    expect(screen.getByRole("button", { name: "Elegir Premium" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Empezar gratis" })).toHaveAttribute("href", "/onboarding");
  });
});

void React;
