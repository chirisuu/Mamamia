import { describe, expect, it } from "vitest";
import { expandUpcE, gtinCheckDigit, hasValidGtinCheckDigit, isValidUpcE, normalizeScannedBarcode, parseBarcode } from "./barcode";

describe("dígito verificador GTIN", () => {
  it("calcula el verificador con pesos 3/1 desde la derecha", () => {
    expect(gtinCheckDigit("400638133393")).toBe(1); // EAN-13 4006381333931
    expect(gtinCheckDigit("9638507")).toBe(4); // EAN-8 96385074
    expect(gtinCheckDigit("03600029145")).toBe(2); // UPC-A 036000291452
  });

  it("valida códigos completos", () => {
    expect(hasValidGtinCheckDigit("4006381333931")).toBe(true);
    expect(hasValidGtinCheckDigit("4006381333932")).toBe(false);
    expect(hasValidGtinCheckDigit("96385074")).toBe(true);
    expect(hasValidGtinCheckDigit("036000291452")).toBe(true);
    expect(hasValidGtinCheckDigit("12345")).toBe(false);
    expect(hasValidGtinCheckDigit("abc")).toBe(false);
  });
});

describe("UPC-E", () => {
  it("expande a UPC-A según el último dígito", () => {
    expect(expandUpcE("04252614")).toBe("042100005264"); // termina en 0–2
    expect(expandUpcE("01234508")).toBe("012000003458"); // termina en 0
    expect(expandUpcE("01234338")).toBe("012300000438"); // termina en 3
    expect(expandUpcE("01234448")).toBe("012340000048"); // termina en 4
    expect(expandUpcE("01234558")).toBe("012345000058"); // termina en 5–9
    expect(expandUpcE("21234567")).toBeNull(); // sistema numérico 2 no existe en UPC-E
  });

  it("valida con el verificador del UPC-A expandido", () => {
    expect(isValidUpcE("04252614")).toBe(true);
    expect(isValidUpcE("04252615")).toBe(false);
  });
});

describe("parseBarcode", () => {
  it("acepta EAN-13 e incluye la variante UPC-A si empieza con 0", () => {
    expect(parseBarcode("4006381333931")).toEqual({
      ok: true,
      code: "4006381333931",
      format: "ean13",
      lookupCodes: ["4006381333931"],
      offCode: "4006381333931",
    });
    const withZero = parseBarcode("0689544001010");
    expect(withZero.ok && withZero.lookupCodes).toEqual(["0689544001010", "689544001010"]);
  });

  it("acepta UPC-A y consulta OFF con el EAN-13 equivalente", () => {
    const r = parseBarcode("036000291452");
    expect(r).toMatchObject({ ok: true, format: "upca", lookupCodes: ["036000291452", "0036000291452"], offCode: "0036000291452" });
  });

  it("acepta EAN-8 y UPC-E", () => {
    expect(parseBarcode("96385074")).toMatchObject({ ok: true, format: "ean8", lookupCodes: ["96385074"] });
    const upce = parseBarcode("04252614");
    expect(upce).toMatchObject({ ok: true, format: "upce", offCode: "0042100005264" });
    expect(upce.ok && upce.lookupCodes).toEqual(["04252614", "042100005264", "0042100005264"]);
  });

  it("ignora espacios y guiones y acepta GTIN-14 con 0 inicial", () => {
    expect(parseBarcode(" 4006381-333931 ")).toMatchObject({ ok: true, code: "4006381333931" });
    expect(parseBarcode("04006381333931")).toMatchObject({ ok: true, code: "4006381333931", format: "ean13" });
  });

  it("rechaza vacío, letras, largos inválidos y verificador incorrecto con mensajes claros", () => {
    expect(parseBarcode("")).toMatchObject({ ok: false, error: "EMPTY" });
    expect(parseBarcode(null)).toMatchObject({ ok: false, error: "EMPTY" });
    expect(parseBarcode("ABC123")).toMatchObject({ ok: false, error: "NOT_NUMERIC" });
    expect(parseBarcode("123456789")).toMatchObject({ ok: false, error: "LENGTH" });
    expect(parseBarcode("14006381333931")).toMatchObject({ ok: false, error: "LENGTH" });
    const bad = parseBarcode("4006381333932");
    expect(bad).toMatchObject({ ok: false, error: "CHECK_DIGIT" });
    expect(!bad.ok && bad.message).toMatch(/último dígito/);
  });

  it("normalizeScannedBarcode descarta lecturas inválidas", () => {
    expect(normalizeScannedBarcode("4006381333931")).toBe("4006381333931");
    expect(normalizeScannedBarcode("4006381333")).toBeNull();
    expect(normalizeScannedBarcode("https://example.com")).toBeNull();
  });
});
