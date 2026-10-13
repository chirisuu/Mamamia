import { describe, expect, it, vi } from "vitest";
import { classifyCameraError, pickNativeFormats } from "./camera";
import { BarcodeLookupError, fetchBarcode, isRetryableLookupError } from "./lookup-client";
import { isLoggableDate, mealChoiceKey, mealChoices, mealDisplayName } from "./meals";

describe("cámara", () => {
  it.each([
    ["NotAllowedError", "denied"],
    ["SecurityError", "denied"],
    ["NotFoundError", "no_camera"],
    ["OverconstrainedError", "no_camera"],
    ["NotReadableError", "in_use"],
    ["TypeError", "unsupported"],
    ["Whatever", "unknown"],
  ])("%s → %s", (name, expected) => {
    expect(classifyCameraError({ name })).toBe(expected);
  });

  it("sin nombre de error → unknown", () => {
    expect(classifyCameraError("boom")).toBe("unknown");
    expect(classifyCameraError(null)).toBe("unknown");
  });

  it("usa el detector nativo solo con formatos de producto", () => {
    expect(pickNativeFormats(["qr_code", "ean_13", "upc_a", "code_128"])).toEqual(["ean_13", "upc_a"]);
    expect(pickNativeFormats(["qr_code"])).toEqual([]);
  });
});

describe("comidas", () => {
  it("4 estándar + personalizadas sin repetir", () => {
    const m = mealChoices(["Pre-entreno", " Pre-entreno ", ""]);
    expect(m.map((x) => x.label)).toEqual(["Desayuno", "Almuerzo", "Cena", "Snacks", "Pre-entreno"]);
    expect(mealChoiceKey(m[4])).toBe("custom:Pre-entreno");
    expect(mealChoiceKey(m[1])).toBe("lunch");
  });

  it("nombres visibles", () => {
    expect(mealDisplayName("dinner", null)).toBe("Cena");
    expect(mealDisplayName("custom", "Lonche")).toBe("Lonche");
    expect(mealDisplayName("custom", null)).toBe("Comida personalizada");
  });

  it("fechas registrables: pasado y hasta mañana", () => {
    expect(isLoggableDate("2026-10-13", "2026-10-13")).toBe(true);
    expect(isLoggableDate("2026-10-14", "2026-10-13")).toBe(true);
    expect(isLoggableDate("2026-10-15", "2026-10-13")).toBe(false);
    expect(isLoggableDate("1999-12-31", "2026-10-13")).toBe(false);
    expect(isLoggableDate("2026-13-01", "2026-10-13")).toBe(false);
  });
});

describe("fetchBarcode", () => {
  const ok = { food: { id: "f" }, origin: "database", barcode: { code: "4006381333931", format: "ean13" } };

  it("devuelve el cuerpo en 200", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(ok), { status: 200 }));
    await expect(fetchBarcode("4006381333931", undefined, f)).resolves.toEqual(ok);
    expect(f).toHaveBeenCalledWith("/api/foods/barcode/4006381333931", expect.anything());
  });

  it("propaga status, código, mensaje y datos de precarga del servidor", async () => {
    const body = { error: { code: "INCOMPLETE_DATA", message: "Faltan datos", product: { name: "Inca Kola", brandName: null } } };
    const f = vi.fn(async () => new Response(JSON.stringify(body), { status: 422 }));
    const err = await fetchBarcode("4006381333931", undefined, f).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BarcodeLookupError);
    expect(err).toMatchObject({ status: 422, code: "INCOMPLETE_DATA", message: "Faltan datos", product: { name: "Inca Kola" } });
    expect(isRetryableLookupError(err)).toBe(false);
  });

  it("sin conexión → status 0 reintentable; respuesta sin JSON → mensaje genérico", async () => {
    const offline = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const err = await fetchBarcode("1", undefined, offline).catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 0, code: "NETWORK" });
    expect(isRetryableLookupError(err)).toBe(true);
    const html = vi.fn(async () => new Response("<html>", { status: 502 }));
    await expect(fetchBarcode("1", undefined, html)).rejects.toMatchObject({ status: 502, code: "UNKNOWN" });
  });
});
