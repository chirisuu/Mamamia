// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../actions", () => ({ logFoodAction: vi.fn(), setFavoriteFoodAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { FoodSearch } from "./food-search";

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
});

const apiFood = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Arroz blanco cocido",
  brandName: null,
  foodType: "generic",
  barcode: null,
  per100g: { energyKcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, fiberG: 0.4, sugarG: null, saturatedFatG: null, sodiumMg: 1 },
  source: "curated",
  sourceRef: null,
  verificationStatus: "curated",
  isOwn: false,
  densityGPerMl: null,
  portions: [{ id: "p1", label: "1 taza", quantity: 1, unit: "taza", gramWeight: 160, isDefault: true }],
};

function renderSearch() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FoodSearch
        localDate="2026-10-13"
        maxDate="2026-10-14"
        defaultMeal="lunch"
        defaultCustomName={null}
        mealOptions={[{ mealType: "lunch", customName: null, label: "Almuerzo" }]}
        recent={[]}
        favorites={[]}
      />
    </QueryClientProvider>,
  );
}

describe("FoodSearch", () => {
  it("busca contra /api/foods/search y abre el selector de porciones", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ foods: [apiFood] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    renderSearch();
    expect(screen.getByText("Aún no tienes recientes")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar alimento"), { target: { value: "arroz" } });
    const result = await screen.findByRole("button", { name: /Arroz blanco cocido/ });
    expect(fetchMock).toHaveBeenCalledWith("/api/foods/search?q=arroz&limit=20", expect.anything());
    fireEvent.click(result);
    expect(await screen.findByRole("button", { name: /Agregar a Almuerzo/ })).toBeInTheDocument();
    expect(screen.getByText("208")).toBeInTheDocument(); // 1 taza = 160 g → 208 kcal
  });

  it("explica el límite de búsquedas (429) sin inventar resultados", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { code: "RATE_LIMITED", message: "x" } }), { status: 429 })));
    renderSearch();
    fireEvent.change(screen.getByLabelText("Buscar alimento"), { target: { value: "pan" } });
    expect(await screen.findByText("Muchas búsquedas seguidas")).toBeInTheDocument();
  });

  it("sin resultados ofrece crear un alimento propio", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ foods: [] }), { status: 200 })));
    renderSearch();
    fireEvent.change(screen.getByLabelText("Buscar alimento"), { target: { value: "chifles" } });
    const link = await screen.findByRole("link", { name: /Crear alimento propio/ });
    expect(link.getAttribute("href")).toContain("/app/alimentos/nuevo?nombre=chifles");
  });
});
