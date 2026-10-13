// @vitest-environment jsdom
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NumberStepper, parseDraft } from "@/components/ui/number-stepper";

afterEach(cleanup);

function Controlled(props: { initial: number | null; min?: number; max?: number; step?: number; onChange?: (n: number) => void }) {
  const [value, setValue] = React.useState<number | null>(props.initial);
  return (
    <NumberStepper
      label="Cantidad"
      unit="g"
      value={value}
      min={props.min}
      max={props.max}
      step={props.step}
      onValueChange={(next) => {
        setValue(next);
        props.onChange?.(next);
      }}
    />
  );
}

describe("NumberStepper", () => {
  it("suma y resta con los botones respetando step y límites", () => {
    render(<Controlled initial={95} max={100} step={5} />);
    const input = screen.getByRole("spinbutton", { name: "Cantidad" });
    const plus = screen.getByRole("button", { name: "Aumentar Cantidad" });
    const minus = screen.getByRole("button", { name: "Disminuir Cantidad" });

    expect(input).toHaveValue("95");
    expect(input).toHaveAttribute("inputmode", "numeric");
    fireEvent.click(plus);
    expect(input).toHaveValue("100");
    expect(plus).toBeDisabled();
    fireEvent.click(minus);
    expect(input).toHaveValue("95");
    expect(input).toHaveAttribute("aria-valuetext", "95 g");
  });

  it("acepta coma decimal al escribir y ajusta al rango al confirmar", () => {
    const onChange = vi.fn();
    render(<Controlled initial={1} min={0.5} max={10} step={0.5} onChange={onChange} />);
    const input = screen.getByRole("spinbutton", { name: "Cantidad" });
    expect(input).toHaveAttribute("inputmode", "decimal");

    fireEvent.change(input, { target: { value: "2,5" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith(2.5);
    expect(input).toHaveValue("2.5");

    fireEvent.change(input, { target: { value: "40" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith(10);
    expect(input).toHaveValue("10");

    // Letras no se aceptan; el valor se conserva.
    fireEvent.change(input, { target: { value: "abc" } });
    expect(input).toHaveValue("10");
  });

  it("flechas del teclado y campo vacío", () => {
    const onChange = vi.fn();
    render(<Controlled initial={null} min={0} step={1} onChange={onChange} />);
    const input = screen.getByRole("spinbutton", { name: "Cantidad" });
    expect(input).toHaveValue("");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(onChange).toHaveBeenLastCalledWith(1);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(screen.getByRole("button", { name: "Disminuir Cantidad" })).toBeDisabled();
  });

  it("parseDraft normaliza coma y rechaza basura", () => {
    expect(parseDraft(" 12,5 ")).toBe(12.5);
    expect(parseDraft("")).toBeNull();
    expect(parseDraft(".")).toBeNull();
    expect(parseDraft("1e")).toBeNull();
  });
});
