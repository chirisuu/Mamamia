// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { BarcodeLookupResponse } from "@/lib/foods/api-types";

const logBarcodeFoodAction = vi.fn();
vi.mock("../actions", () => ({ logBarcodeFoodAction: (...args: unknown[]) => logBarcodeFoodAction(...args) }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { BarcodeFlow } from "./barcode-flow";
import { ManualCodeForm } from "./manual-code-form";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  logBarcodeFoodAction.mockReset();
});

const CODE = "7751271011235";

const found: BarcodeLookupResponse = {
  origin: "open_food_facts",
  barcode: { code: CODE, format: "ean13" },
  food: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Leche evaporada entera",
    brandName: "Gloria",
    foodType: "branded",
    barcode: CODE,
    per100g: { energyKcal: 132, proteinG: 6.4, carbsG: 10, fatG: 7.5, fiberG: null, sugarG: 10, saturatedFatG: 4.6, sodiumMg: 120 },
    source: "open_food_facts",
    sourceRef: `off:${CODE}`,
    verificationStatus: "unverified",
    isOwn: false,
    densityGPerMl: null,
    portions: [{ id: "p1", label: "1 porción (30 g)", quantity: 1, unit: "porción", gramWeight: 30, isDefault: true }],
    micronutrients: [],
    description: "Datos de Open Food Facts (licencia ODbL), sin verificar contra la etiqueta.",
    sourceUrl: `https://world.openfoodfacts.org/product/${CODE}`,
    license: "ODbL — © colaboradores de Open Food Facts",
  },
};

function renderFlow(initialCode: string | null = CODE) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BarcodeFlow
        localDate="2026-10-13"
        isToday
        meals={[
          { mealType: "breakfast", customName: null, label: "Desayuno" },
          { mealType: "lunch", customName: null, label: "Almuerzo" },
        ]}
        defaultMeal={{ mealType: "lunch", customName: null }}
        initialCode={initialCode}
        targetQuery="fecha=2026-10-13&comida=lunch"
      />
    </QueryClientProvider>,
  );
}

describe("BarcodeFlow", () => {
  it("muestra el producto con su procedencia y registra la porción por defecto con la acción del escáner", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(found), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    logBarcodeFoodAction.mockResolvedValue({ ok: true, data: { itemIds: ["x"], localDate: "2026-10-13", mealLabel: "Almuerzo" } });
    renderFlow();

    expect(await screen.findByRole("heading", { name: "Leche evaporada entera" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`/api/foods/barcode/${CODE}`, expect.anything());
    expect(screen.getByText("Open Food Facts · pendiente de verificación")).toBeInTheDocument();
    expect(screen.getByText(/Datos de Open Food Facts, licencia ODbL/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver la fuente/ })).toHaveAttribute("href", found.food.sourceUrl);
    expect(screen.getAllByText("sin dato").length).toBeGreaterThan(0); // fibra: no se inventa

    // 1 porción = 30 g → 132 × 0.3 = 39.6 kcal → "40"
    expect(screen.getByText("40")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Agregar a Almuerzo/ }));
    await waitFor(() => expect(logBarcodeFoodAction).toHaveBeenCalledTimes(1));
    expect(logBarcodeFoodAction).toHaveBeenCalledWith({
      localDate: "2026-10-13",
      mealType: "lunch",
      customName: null,
      foodId: found.food.id,
      grams: 30,
      quantity: 1,
      unit: "porción",
    });
    expect(await screen.findByText("Listo: agregado a Almuerzo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver el diario/ })).toHaveAttribute("href", "/app/diario/2026-10-13");
  });

  it("si no existe ofrece crear el alimento propio con el código y la vuelta al escáner", async () => {
    const body = { error: { code: "NOT_FOUND", message: "No encontramos este producto ni en nuestra base ni en Open Food Facts." } };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 404 })));
    renderFlow();

    expect(await screen.findByText("No encontramos este producto")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Crear alimento propio/ });
    const href = new URL(link.getAttribute("href")!, "http://local");
    expect(href.pathname).toBe("/app/alimentos/nuevo");
    expect(href.searchParams.get("codigo")).toBe(CODE);
    expect(href.searchParams.get("volver")).toBe(`/app/agregar/codigo?fecha=2026-10-13&comida=lunch&codigo=${CODE}`);
  });

  it("un 502 de Open Food Facts se muestra como error real con reintento", async () => {
    const body = { error: { code: "UPSTREAM_ERROR", message: "No está en nuestra base y no pudimos consultar Open Food Facts." } };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);
    renderFlow();
    // Un 5xx se reintenta una vez sola (con espera) antes de mostrar el error.
    expect(await screen.findByText("Open Food Facts no respondió", undefined, { timeout: 4000 })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: /Reintentar/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Agregar a/ })).not.toBeInTheDocument();
  });

  it("sin código muestra la explicación de la cámara y la entrada manual", () => {
    renderFlow(null);
    expect(screen.getByText(/No tomamos fotos ni guardamos/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Activar cámara/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Número del código de barras")).toBeInTheDocument();
  });
});

describe("BarcodeScanner (errores de cámara)", () => {
  it("sin soporte de cámara lo explica y ofrece escribir el código", async () => {
    renderFlow(null);
    fireEvent.click(screen.getByRole("button", { name: /Activar cámara/ }));
    expect(await screen.findByText("Tu navegador no permite usar la cámara aquí")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Escribir el código/ })).toBeInTheDocument();
  });

  it("permiso denegado → mensaje con instrucciones y reintento", async () => {
    const denied = Object.assign(new Error("denied"), { name: "NotAllowedError" });
    const getUserMedia = vi.fn(async () => {
      throw denied;
    });
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
    try {
      renderFlow(null);
      fireEvent.click(screen.getByRole("button", { name: /Activar cámara/ }));
      expect(await screen.findByText("No tenemos permiso para usar la cámara")).toBeInTheDocument();
      expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ video: expect.objectContaining({ facingMode: { ideal: "environment" } }) }));
      expect(screen.getByRole("button", { name: /Reintentar/ })).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
      Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
    }
  });
});

describe("ManualCodeForm", () => {
  it("valida el dígito verificador antes de buscar", () => {
    const onSubmit = vi.fn();
    render(<ManualCodeForm onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Número del código de barras");
    fireEvent.change(input, { target: { value: "4006381333932" } });
    fireEvent.click(screen.getByRole("button", { name: /Buscar/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(/último dígito/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "4006 3813 3393 1" } });
    fireEvent.click(screen.getByRole("button", { name: /Buscar/ }));
    expect(onSubmit).toHaveBeenCalledWith("4006381333931");
  });
});
