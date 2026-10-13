// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { buildMealSections } from "../lib/day-totals";
import type { DiaryItem } from "../types";

const duplicateItemAction = vi.fn(async () => ({ ok: true, data: { copied: 1 } }));
vi.mock("../actions", () => ({
  applyTemplateAction: vi.fn(),
  clearMealAction: vi.fn(),
  copyMealAction: vi.fn(),
  createCustomMealAction: vi.fn(),
  deleteCustomMealAction: vi.fn(),
  deleteItemAction: vi.fn(),
  deleteTemplateAction: vi.fn(),
  duplicateItemAction: (...args: unknown[]) => duplicateItemAction(...(args as [])),
  moveItemAction: vi.fn(),
  saveTemplateAction: vi.fn(),
  setFavoriteFoodAction: vi.fn(),
  updateItemQuantityAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { DiaryMeals } from "./diary-meals";

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

afterEach(cleanup);

const item: DiaryItem = {
  id: "22222222-2222-4222-8222-222222222222",
  mealLogId: "L",
  kind: "food",
  foodId: "f1",
  recipeId: null,
  recipeSlug: null,
  name: "Pan francés",
  brandName: null,
  quantity: 2,
  unit: "unidad",
  grams: 60,
  energyKcal: 168,
  proteinG: 5.4,
  carbsG: 33,
  fatG: 1.2,
  fiberG: null,
  sugarG: null,
  sodiumMg: null,
  source: "photo_ai",
  provenance: "Estimación con IA por foto (confianza 70 %) · Base curada · revisado por el equipo",
  isEstimate: true,
  isAi: true,
  food: null,
};

describe("DiaryMeals", () => {
  const meals = buildMealSections(
    [
      { id: "L", mealType: "breakfast", customName: null, createdAt: "2026-10-13T12:00:00Z" },
      { id: "C", mealType: "custom", customName: "Post entreno", createdAt: "2026-10-13T20:00:00Z" },
    ],
    [item],
  );

  it("muestra las comidas, el ítem con su procedencia y accesos para agregar", () => {
    render(<DiaryMeals date="2026-10-13" today="2026-10-13" maxDate="2026-10-14" meals={meals} templates={[]} />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Desayuno",
      "Almuerzo",
      "Cena",
      "Snacks",
      "Post entreno",
    ]);
    const breakfast = screen.getByRole("region", { name: "Desayuno" });
    expect(within(breakfast).getByText("Pan francés")).toBeInTheDocument();
    expect(within(breakfast).getByText("2 unidad (60 g)")).toBeInTheDocument();
    expect(within(breakfast).getByText(/Estimación con IA por foto/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Agregar a Almuerzo" })).toHaveAttribute(
      "href",
      "/app/agregar/buscar?fecha=2026-10-13&comida=lunch",
    );
    expect(screen.getByRole("link", { name: "Agregar a Post entreno" })).toHaveAttribute(
      "href",
      "/app/agregar/buscar?fecha=2026-10-13&comida=custom&nombre=Post+entreno",
    );
  });

  it("duplica desde el menú del ítem", async () => {
    render(<DiaryMeals date="2026-10-13" today="2026-10-13" maxDate="2026-10-14" meals={meals} templates={[]} />);
    const trigger = screen.getByRole("button", { name: "Acciones de Pan francés" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const option = await screen.findByRole("menuitem", { name: "Duplicar" });
    fireEvent.click(option);
    await waitFor(() => expect(duplicateItemAction).toHaveBeenCalledWith({ itemId: item.id }));
  });

  it("abre el diálogo para crear otra comida", async () => {
    render(<DiaryMeals date="2026-10-13" today="2026-10-13" maxDate="2026-10-14" meals={meals} templates={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar otra comida" }));
    expect(await screen.findByRole("dialog", { name: "Nueva comida" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear" })).toBeDisabled();
  });
});
