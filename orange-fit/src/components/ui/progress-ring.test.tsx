// @vitest-environment jsdom
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProgressRing, getRingState } from "@/components/ui/progress-ring";

afterEach(cleanup);

describe("getRingState", () => {
  it("calcula restante y fracción bajo la meta", () => {
    const s = getRingState(1500, 2000);
    expect(s).toMatchObject({ hasGoal: true, remaining: 500, over: false, overAmount: 0, fraction: 0.75, overFraction: 0 });
  });

  it("marca exceso sin restante negativo y limita la vuelta extra a 1", () => {
    const s = getRingState(2300, 2000);
    expect(s).toMatchObject({ over: true, remaining: 0, overAmount: 300, fraction: 1 });
    expect(s.overFraction).toBeCloseTo(0.15);
    expect(getRingState(5000, 2000).overFraction).toBe(1);
  });

  it("sin meta válida no inventa restante", () => {
    expect(getRingState(800, null)).toMatchObject({ hasGoal: false, remaining: 0, fraction: 0 });
    expect(getRingState(800, 0).hasGoal).toBe(false);
    expect(getRingState(-50, 2000).consumed).toBe(0);
  });
});

describe("ProgressRing", () => {
  it("muestra restante, consumido y meta", () => {
    render(<ProgressRing consumed={1500} goal={2000} />);
    const group = screen.getByRole("group", { name: "Calorías de hoy" });
    expect(group).toHaveAttribute("data-state", "under");
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("kcal restantes")).toBeInTheDocument();
    expect(screen.getByText("1,500 de 2,000 kcal")).toBeInTheDocument();
    expect(group.querySelector('[data-ring="progress"]')).not.toBeNull();
    expect(group.querySelector('[data-ring="over"]')).toBeNull();
  });

  it("al pasarse usa tono neutro (sin destructive) y lo dice sin culpa", () => {
    render(<ProgressRing consumed={2300} goal={2000} />);
    const group = screen.getByRole("group", { name: "Calorías de hoy" });
    expect(group).toHaveAttribute("data-state", "over");
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.getByText("kcal sobre tu meta")).toBeInTheDocument();
    const over = group.querySelector('[data-ring="over"]');
    expect(over).not.toBeNull();
    expect(over?.getAttribute("class")).toContain("stroke-foreground");
    expect(group.innerHTML).not.toMatch(/destructive|red-/);
  });

  it("sin meta muestra lo consumido y que la meta está pendiente", () => {
    render(<ProgressRing consumed={820} goal={null} />);
    expect(screen.getByRole("group")).toHaveAttribute("data-state", "no-goal");
    expect(screen.getByText("820")).toBeInTheDocument();
    expect(screen.getByText("Meta pendiente de definir")).toBeInTheDocument();
  });
});
