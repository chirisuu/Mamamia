import { describe, expect, it, vi } from "vitest";
import found from "./__fixtures__/off-product-found.json";
import incomplete from "./__fixtures__/off-product-incomplete.json";
import kjOnly from "./__fixtures__/off-product-kj-only.json";
import notFound from "./__fixtures__/off-product-not-found.json";
import {
  fetchOffProduct,
  kjToKcal,
  mapOffProduct,
  normalizeBrandName,
  offApiUrl,
  offDescription,
  offNumber,
  OffError,
  offUserAgent,
  OFF_LICENSE,
  type OffProduct,
} from "./open-food-facts";

const UA = offUserAgent("soporte@orangefit.test");

/** fetch simulado: OFF no es accesible desde el contenedor, así que solo se prueba con respuestas grabadas. */
function fakeFetch(status: number, body: unknown) {
  return vi.fn(async (input: string, init?: RequestInit) => {
    void input;
    void init;
    return new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
}

describe("fetchOffProduct (fetch simulado)", () => {
  it("pide la API v2 con los campos acordados y un User-Agent identificable", async () => {
    const fetchImpl = fakeFetch(200, found);
    const r = await fetchOffProduct("7751271011235", { userAgent: UA, fetchImpl });
    expect(r.status).toBe("found");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(offApiUrl("7751271011235"));
    expect(url).toContain("/api/v2/product/7751271011235?fields=code,product_name,product_name_es,brands,nutriments,serving_size,quantity");
    expect((init?.headers as Record<string, string>)["User-Agent"]).toBe("OrangeFit/0.1 (soporte@orangefit.test)");
  });

  it("acepta el formato nuevo de status ('success')", async () => {
    const r = await fetchOffProduct("7802215505218", { userAgent: UA, fetchImpl: fakeFetch(200, kjOnly) });
    expect(r.status).toBe("found");
  });

  it("status 0 o HTTP 404 → no encontrado (sin inventar nada)", async () => {
    await expect(fetchOffProduct("2000000000008", { userAgent: UA, fetchImpl: fakeFetch(200, notFound) })).resolves.toEqual({ status: "not_found" });
    await expect(fetchOffProduct("2000000000008", { userAgent: UA, fetchImpl: fakeFetch(404, notFound) })).resolves.toEqual({ status: "not_found" });
  });

  it("errores reales: 5xx, 429, red caída, JSON ilegible y tiempo agotado", async () => {
    await expect(fetchOffProduct("1", { userAgent: UA, fetchImpl: fakeFetch(503, "down") })).rejects.toMatchObject({ code: "OFF_UNAVAILABLE", status: 503 });
    await expect(fetchOffProduct("1", { userAgent: UA, fetchImpl: fakeFetch(429, {}) })).rejects.toMatchObject({ code: "OFF_RATE_LIMITED" });
    await expect(fetchOffProduct("1", { userAgent: UA, fetchImpl: fakeFetch(200, "<html>") })).rejects.toMatchObject({ code: "OFF_BAD_RESPONSE" });
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(fetchOffProduct("1", { userAgent: UA, fetchImpl: offline })).rejects.toBeInstanceOf(OffError);
    await expect(fetchOffProduct("1", { userAgent: UA, fetchImpl: offline })).rejects.toMatchObject({ code: "OFF_UNAVAILABLE" });

    const hanging = (_url: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    await expect(fetchOffProduct("1", { userAgent: UA, fetchImpl: hanging, timeoutMs: 20 })).rejects.toMatchObject({ code: "OFF_TIMEOUT" });
  });

  it("el User-Agent nunca queda sin contacto ni rompe la cabecera", () => {
    expect(offUserAgent(null)).toBe("OrangeFit/0.1 (sin contacto configurado)");
    expect(offUserAgent("a@b.pe\r\nX: y")).toBe("OrangeFit/0.1 (a@b.pe  X: y)");
  });
});

describe("mapOffProduct", () => {
  it("mapea por 100 g con sodio en mg, marca normalizada y porciones en gramos", () => {
    const r = mapOffProduct(found.product as OffProduct, "7751271011235");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.food).toMatchObject({
      barcode: "7751271011235",
      name: "Leche evaporada entera",
      brandName: "Gloria",
      per100g: { energyKcal: 132, proteinG: 6.4, carbsG: 10, fatG: 7.5, fiberG: 0, sugarG: 10, saturatedFatG: 4.6, sodiumMg: 120 },
      energyFromKj: false,
      sodiumFromSalt: false,
      servingGrams: 30,
      packageGrams: 400,
      sourceRef: "off:7751271011235",
      sourceUrl: "https://world.openfoodfacts.org/product/7751271011235",
      license: OFF_LICENSE,
    });
    expect(r.food.notes).toEqual([]);
  });

  it("si solo hay kJ convierte a kcal (÷ 4.184) y lo anota; sodio desde la sal; números como texto", () => {
    const r = mapOffProduct(kjOnly.product as OffProduct, "7802215505218");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.food.per100g.energyKcal).toBe(kjToKcal(2042));
    expect(r.food.per100g.energyKcal).toBeCloseTo(488.05, 2);
    expect(r.food.energyFromKj).toBe(true);
    expect(r.food.per100g.carbsG).toBe(68.5);
    expect(r.food.per100g.fatG).toBe(21);
    expect(r.food.per100g.sodiumMg).toBe(300); // 0.75 g de sal ÷ 2.5 = 0.3 g de sodio
    expect(r.food.sodiumFromSalt).toBe(true);
    expect(r.food.per100g.fiberG).toBeNull(); // OFF no la trae: no se inventa
    expect(r.food.name).toBe("Galletas de chocolate rellenas");
    expect(r.food.brandName).toBe("Costa");
    expect(r.food.servingGrams).toBe(36);
    expect(r.food.packageGrams).toBeNull(); // "6 x 36 g" es un multipack: no hay peso de envase único
    expect(r.food.notes).toEqual(["Energía calculada desde kJ (÷ 4.184).", "Sodio estimado desde la sal (÷ 2.5)."]);
    expect(offDescription(r.food)).toContain("Energía calculada desde kJ");
  });

  it("sin valores por 100 g (solo por porción) no es válido y devuelve nombre y marca para precargar", () => {
    const r = mapOffProduct(incomplete.product as OffProduct, "7750182002350");
    expect(r).toEqual({
      ok: false,
      reason: "missing_nutrients",
      missing: ["energía", "proteína", "carbohidratos", "grasa"],
      name: "Inca Kola",
      brandName: "Inca Kola",
    });
  });

  it("rechaza datos fuera de rango o incoherentes y sin nombre", () => {
    const base = { product_name: "X", nutriments: { "energy-kcal_100g": 2000, proteins_100g: 1, carbohydrates_100g: 1, fat_100g: 1 } };
    expect(mapOffProduct(base, "1")).toMatchObject({ ok: false, reason: "out_of_range" });
    // 400 kcal de macros declarados con 30 kcal: probablemente mezcla porción/100 g.
    const low = { product_name: "X", nutriments: { "energy-kcal_100g": 30, proteins_100g: 10, carbohydrates_100g: 60, fat_100g: 10 } };
    expect(mapOffProduct(low, "1")).toMatchObject({ ok: false, reason: "inconsistent" });
    expect(mapOffProduct({ nutriments: {} }, "1")).toMatchObject({ ok: false, reason: "missing_name" });
    const sum = { product_name: "X", nutriments: { "energy-kcal_100g": 500, proteins_100g: 50, carbohydrates_100g: 50, fat_100g: 20 } };
    expect(mapOffProduct(sum, "1")).toMatchObject({ ok: false, reason: "out_of_range" });
  });

  it("descarta subcomponentes imposibles en vez de guardarlos", () => {
    const p = {
      product_name: "Yogur",
      nutriments: { "energy-kcal_100g": 60, proteins_100g: 3, carbohydrates_100g: 8, fat_100g: 2, sugars_100g: 12, "saturated-fat_100g": 5 },
    };
    const r = mapOffProduct(p, "1");
    expect(r.ok && r.food.per100g.sugarG).toBeNull();
    expect(r.ok && r.food.per100g.saturatedFatG).toBeNull();
    expect(r.ok && r.food.notes.length).toBe(2);
  });

  it("usa el código que devuelve OFF si es válido", () => {
    const p = { code: "0036000291452", product_name: "X", nutriments: { "energy-kcal_100g": 10, proteins_100g: 0, carbohydrates_100g: 2, fat_100g: 0 } };
    expect(mapOffProduct(p, "036000291452")).toMatchObject({ ok: true, food: { barcode: "0036000291452" } });
  });
});

describe("utilidades OFF", () => {
  it("offNumber acepta números y texto con coma; descarta negativos y basura", () => {
    expect(offNumber(3.5)).toBe(3.5);
    expect(offNumber("3,5")).toBe(3.5);
    expect(offNumber(" 7 ")).toBe(7);
    expect(offNumber(-1)).toBeNull();
    expect(offNumber("abc")).toBeNull();
    expect(offNumber("")).toBeNull();
    expect(offNumber(null)).toBeNull();
  });

  it("kJ → kcal", () => {
    expect(kjToKcal(4.184)).toBe(1);
    expect(kjToKcal(552)).toBeCloseTo(131.93, 2);
  });

  it("normalizeBrandName toma la primera marca y corrige mayúsculas/minúsculas", () => {
    expect(normalizeBrandName("GLORIA,Gloria S.A.")).toBe("Gloria");
    expect(normalizeBrandName("san fernando")).toBe("San Fernando");
    expect(normalizeBrandName("nestlé, Nestlé Perú")).toBe("Nestlé");
    expect(normalizeBrandName("McCain")).toBe("McCain");
    expect(normalizeBrandName("3M")).toBe("3M");
    expect(normalizeBrandName(" , ")).toBeNull();
    expect(normalizeBrandName(undefined)).toBeNull();
  });
});
