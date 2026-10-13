// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PickerFood } from "../types";

const logFoodAction = vi.fn();
vi.mock("../actions", () => ({
  logFoodAction: (...args: unknown[]) => logFoodAction(...args),
  setFavoriteFoodAction: vi.fn(async () => ({ ok: true, data: { favorite: true } })),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { PortionPicker } from "./portion-picker";

beforeAll(() => {
  // vaul y Radix usan APIs que jsdom no trae.
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
  logFoodAction.mockReset();
});

const food: PickerFood = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Arroz blanco cocido",
  brandName: null,
  per100g: { energyKcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, fiberG: 0.4, sugarG: null, sodiumMg: 1 },
  densityGPerMl: null,
  portions: [{ id: "p1", label: "1/2 taza", quantity: 0.5, unit: "taza", gramWeight: 80, isDefault: true }],
  provenance: "Base curada · revisado por el equipo",
  isOwn: false,
  isFavorite: false,
};

describe("PortionPicker", () => {
  it("parte de la porción por defecto y muestra la vista previa calculada", () => {
    render(
      <PortionPicker food={food} open onOpenChange={() => undefined} localDate="2026-10-13" maxDate="2026-10-14" defaultMeal="lunch" />,
    );
    expect(screen.getByText("Arroz blanco cocido")).toBeInTheDocument();
    // 1/2 taza = 80 g → 104 kcal.
    expect(screen.getByRole("spinbutton", { name: "Cantidad" })).toHaveValue("0.5");
    expect(screen.getByText("104")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Agregar a Almuerzo/ })).toBeEnabled();
  });

  it("registra con los gramos de la porción y la comida elegida", async () => {
    logFoodAction.mockResolvedValue({ ok: true, data: { itemIds: ["x"], mealLabel: "Almuerzo", localDate: "2026-10-13" } });
    const onOpenChange = vi.fn();
    render(<PortionPicker food={food} open onOpenChange={onOpenChange} localDate="2026-10-13" maxDate="2026-10-14" defaultMeal="lunch" />);
    fireEvent.click(screen.getByRole("button", { name: "Aumentar Cantidad" }));
    expect(screen.getByRole("spinbutton", { name: "Cantidad" })).toHaveValue("1");
    fireEvent.click(screen.getByRole("button", { name: /Agregar a Almuerzo/ }));
    await waitFor(() => expect(logFoodAction).toHaveBeenCalledTimes(1));
    expect(logFoodAction).toHaveBeenCalledWith({
      localDate: "2026-10-13",
      mealType: "lunch",
      customName: null,
      foodId: food.id,
      grams: 160,
      quantity: 1,
      unit: "taza",
      source: "search",
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("no permite fechas después de mañana", () => {
    render(<PortionPicker food={food} open onOpenChange={() => undefined} localDate="2026-10-13" maxDate="2026-10-14" defaultMeal="dinner" />);
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-10-20" } });
    expect(screen.getByText("Elige una fecha hasta mañana.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Agregar a Cena/ })).toBeDisabled();
  });
});
