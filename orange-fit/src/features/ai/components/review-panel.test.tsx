// @vitest-environment jsdom
/**
 * Nada se registra sin confirmación: la revisión de lo que propuso la IA solo llama a
 * `confirmAiItemsAction` cuando la persona toca «Registrar», con los ítems marcados.
 */
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { photoReviewItems } from "../lib/review";
import { testFood } from "../lib/__fixtures__/foods";

const confirmAiItemsAction = vi.fn();
vi.mock("../actions", () => ({
  confirmAiItemsAction: (...args: unknown[]) => confirmAiItemsAction(...args),
  grantAiConsentAction: vi.fn(),
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import { ReviewPanel } from "./review-panel";

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
  confirmAiItemsAction.mockReset();
  push.mockReset();
});

const REQUEST_ID = "6f1c2b9e-1d2a-4f3b-9c8d-7e6f5a4b3c2d";
const arroz = testFood({ id: "11111111-1111-4111-8111-111111111111", name: "Arroz blanco cocido" });
const items = photoReviewItems([
  {
    key: "p0",
    nameEs: "arroz blanco cocido",
    preparation: null,
    estimatedGrams: { min: 120, best: 150, max: 200 },
    confidence: 0.8,
    visibleEvidence: "Granos blancos",
    matches: [arroz],
  },
  { key: "p1", nameEs: "salsa misteriosa", preparation: null, estimatedGrams: { min: 10, best: 20, max: 40 }, confidence: 0.3, visibleEvidence: null, matches: [] },
]);

function renderPanel() {
  return render(
    <ReviewPanel
      requestId={REQUEST_ID}
      source="photo_ai"
      initialItems={items}
      localDate="2026-10-13"
      maxDate="2026-10-14"
      defaultMeal="lunch"
      defaultCustomName={null}
      mealOptions={[{ mealType: "lunch", customName: null, label: "Almuerzo" }]}
      uncertaintyNote="No se ve si lleva aceite."
      onDiscard={vi.fn()}
    />,
  );
}

describe("ReviewPanel", () => {
  it("muestra los candidatos, la confianza, la nota y «sin dato verificado», sin registrar nada", () => {
    renderPanel();
    expect(screen.getByText("arroz blanco cocido")).toBeInTheDocument();
    expect(screen.getByText(/Confianza alta · 80 %/)).toBeInTheDocument();
    expect(screen.getByText("No se ve si lleva aceite.")).toBeInTheDocument();
    expect(screen.getByText("Sin dato verificado")).toBeInTheDocument();
    // 150 g × 130 kcal/100 g de la base
    expect(screen.getAllByText(/195/).length).toBeGreaterThan(0);
    expect(confirmAiItemsAction).not.toHaveBeenCalled();
  });

  it("solo al confirmar registra, con los ítems marcados, la estimación y la confianza", async () => {
    confirmAiItemsAction.mockResolvedValue({ ok: true, data: { localDate: "2026-10-13", mealLabel: "Almuerzo", count: 1 } });
    renderPanel();
    expect(confirmAiItemsAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Registrar en Almuerzo" }));
    await waitFor(() => expect(confirmAiItemsAction).toHaveBeenCalledTimes(1));
    expect(confirmAiItemsAction).toHaveBeenCalledWith({
      requestId: REQUEST_ID,
      source: "photo_ai",
      localDate: "2026-10-13",
      mealType: "lunch",
      customName: null,
      items: [{ foodId: arroz.id, grams: 150, quantity: 150, unit: "g", confidence: 0.8, origin: "ai" }],
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/app/diario/2026-10-13"));
  });

  it("si la persona desmarca todo, no se puede registrar", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("checkbox", { name: /arroz blanco cocido/ }));
    expect(screen.getByRole("button", { name: "Registrar en Almuerzo" })).toBeDisabled();
    expect(confirmAiItemsAction).not.toHaveBeenCalled();
  });
});
