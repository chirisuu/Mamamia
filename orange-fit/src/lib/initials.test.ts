import { describe, expect, it } from "vitest";
import { initials } from "./initials";

describe("initials", () => {
  it("toma la primera letra de hasta dos palabras", () => {
    expect(initials("María José Pérez")).toBe("MJ");
    expect(initials("  ana  ")).toBe("A");
  });

  it("vacío sin nombre", () => {
    expect(initials(null)).toBe("");
    expect(initials("")).toBe("");
  });

  it("no viene de un módulo de cliente (las páginas de servidor lo llaman)", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(new URL("./initials.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/^["']use client["']/m);
  });
});
