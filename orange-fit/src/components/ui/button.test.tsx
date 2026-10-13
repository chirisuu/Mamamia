// @vitest-environment jsdom
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";

afterEach(cleanup);

describe("Button", () => {
  it("llama a onClick y aplica la variante", () => {
    const onClick = vi.fn();
    render(
      <Button variant="secondary" onClick={onClick}>
        Guardar
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Guardar" });
    expect(button).toHaveAttribute("data-slot", "button");
    expect(button.className).toContain("bg-secondary");
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("en loading se deshabilita, marca aria-busy y no dispara onClick", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Guardar
      </Button>,
    );
    const button = screen.getByRole("button", { name: /Guardar/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector("[data-slot=spinner]")).not.toBeNull();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("con asChild renderiza el hijo (enlace) con los estilos y aria-disabled al cargar", () => {
    render(
      <Button asChild loading>
        <a href="/app/diario">Ir al diario</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: /Ir al diario/ });
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("href", "/app/diario");
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link.className).toContain("bg-primary");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
