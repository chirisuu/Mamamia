import { describe, expect, it } from "vitest";
import { decimalField, parseDecimal } from "./form-numbers";

describe("parseDecimal", () => {
  it("acepta coma o punto y rechaza texto", () => {
    expect(parseDecimal("12,5")).toBe(12.5);
    expect(parseDecimal(" 30 ")).toBe(30);
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("-3")).toBeNull();
    expect(parseDecimal("1e3")).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
  });
});

describe("decimalField", () => {
  it("valida obligatorios, positivos y máximos", () => {
    expect(decimalField({ required: true }).safeParse("").success).toBe(false);
    expect(decimalField().safeParse("").success).toBe(true);
    expect(decimalField({ positive: true }).safeParse("0").success).toBe(false);
    expect(decimalField({ max: 900 }).safeParse("901").success).toBe(false);
    expect(decimalField({ max: 900 }).safeParse("250,5").success).toBe(true);
  });
});
