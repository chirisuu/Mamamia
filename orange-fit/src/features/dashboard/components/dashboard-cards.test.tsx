// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { buildBudgetBreakdown } from "../lib/budget";
import { CalorieCard } from "./calorie-card";
import { WeeklyChart } from "./weekly-chart";

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

describe("CalorieCard", () => {
  it("muestra el desglose base + ejercicio + ajustes − consumido", () => {
    const budget = buildBudgetBreakdown({ targetKcal: 2000, exerciseKcal: 250, countExercise: true, consumedKcal: 1500 });
    render(<CalorieCard budget={budget} consumedKcal={1500} />);
    const ring = screen.getByRole("group", { name: "Calorías de hoy" });
    expect(within(ring).getByText("750")).toBeInTheDocument();
    expect(screen.getByText("Meta base")).toBeInTheDocument();
    expect(screen.getByText("+ 250 kcal")).toBeInTheDocument();
    expect(screen.getByText("− 1,500 kcal")).toBeInTheDocument();
    expect(screen.getByText("Restante")).toBeInTheDocument();
  });

  it("sin meta invita a definirla", () => {
    render(<CalorieCard budget={null} consumedKcal={300} />);
    expect(screen.getByRole("link", { name: "Definir mi meta" })).toHaveAttribute("href", "/app/perfil/metas");
    expect(screen.getByText("Meta pendiente de definir")).toBeInTheDocument();
  });
});

describe("WeeklyChart", () => {
  it("expone una tabla accesible y distingue días sin registro", () => {
    render(
      <WeeklyChart
        data={[
          { date: "2026-10-12", label: "lun 12", consumed: null, target: 2000 },
          { date: "2026-10-13", label: "mar 13", consumed: 1800, target: 2000 },
        ]}
      />,
    );
    const table = screen.getByRole("table");
    expect(within(table).getByText("Sin registro")).toBeInTheDocument();
    expect(within(table).getByText("1,800 kcal")).toBeInTheDocument();
    expect(screen.getByText("Meta del día")).toBeInTheDocument();
  });
});
