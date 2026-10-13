import { describe, expect, it, vi } from "vitest";
import details from "./__fixtures__/usda-foods-details.json";
import search from "./__fixtures__/usda-search-quinoa.json";
import {
  convertMassUnit,
  getFdcFoods,
  importUsdaFoodsWithKey,
  indexNutrients,
  mapFdcPortion,
  mapUsdaFood,
  searchFdc,
  UsdaError,
  USDA_LICENSE,
  type FdcFood,
} from "./usda-core";
import { importUsdaFoods } from "./usda";

const foods = details as unknown as FdcFood[];
const byId = (id: number) => foods.find((f) => f.fdcId === id)!;

/** Unidades de `nutrient_definitions` (seed 00_base.sql). */
const DEFINITIONS: Record<string, string> = {
  vitamin_a_rae: "µg",
  vitamin_c: "mg",
  thiamin: "mg",
  folate_dfe: "µg",
  calcium: "mg",
  iron: "mg",
  magnesium: "mg",
  phosphorus: "mg",
  potassium: "mg",
  zinc: "mg",
  selenium: "µg",
  cholesterol: "mg",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("mapUsdaFood", () => {
  it("SR Legacy: núcleo por id de nutriente, micronutrientes definidos y porción en español", () => {
    const r = mapUsdaFood(byId(168917), DEFINITIONS);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.food).toMatchObject({
      fdcId: 168917,
      name: "Quinoa, cooked",
      brandName: null,
      foodType: "generic",
      barcode: null,
      per100g: { energyKcal: 120, proteinG: 4.4, carbsG: 21.3, fatG: 1.92, fiberG: 2.8, sugarG: 0.87, saturatedFatG: 0.23, sodiumMg: 7 },
      energyFromKj: false,
      sourceRef: "fdc:168917",
      sourceUrl: "https://fdc.nal.usda.gov/food-details/168917/nutrients",
      license: USDA_LICENSE,
    });
    expect(r.food.micronutrients).toEqual({
      calcium: 17,
      iron: 1.49,
      magnesium: 64,
      phosphorus: 152,
      potassium: 172,
      zinc: 1.09,
      selenium: 2.8,
      vitamin_c: 0,
      thiamin: 0.107,
      folate_dfe: 42,
      cholesterol: 0,
    });
    // La vitamina A en UI no se convierte (no es masa): queda fuera en vez de inventar un factor.
    expect(r.food.micronutrients.vitamin_a_rae).toBeUndefined();
    expect(r.food.portions).toEqual([{ label: "1 taza", quantity: 1, unit: "taza", gramWeight: 185, isDefault: true }]);
  });

  it("Foundation sin 1008 usa la energía Atwater (2047) y descarta 'Quantity not specified'", () => {
    const r = mapUsdaFood(byId(321358), DEFINITIONS);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.food.per100g).toMatchObject({ energyKcal: 229, proteinG: 7.35, fatG: 17.1, carbsG: 14.9, fiberG: 5.4, sodiumMg: 426, sugarG: null });
    expect(r.food.portions).toEqual([{ label: "1 cda.", quantity: 1, unit: "cda", gramWeight: 15, isDefault: true }]);
    expect(r.food.micronutrients).toEqual({ iron: 2.41 });
  });

  it("Branded: marca, código de barras válido y porción de la etiqueta", () => {
    const r = mapUsdaFood(byId(2021234), DEFINITIONS);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.food).toMatchObject({ foodType: "branded", brandName: "FAGE", barcode: "689544001010" });
    expect(r.food.portions).toEqual([{ label: "1 porción (1 container, 170 g)", quantity: 1, unit: "porción", gramWeight: 170, isDefault: true }]);
  });

  it("sin proteína (u otro macro) se omite con su motivo", () => {
    expect(mapUsdaFood(byId(999001), DEFINITIONS)).toEqual({ ok: false, fdcId: 999001, reason: "faltan energía o macronutrientes" });
  });

  it("acepta el formato abreviado de la búsqueda (nutrientId/value)", () => {
    const r = mapUsdaFood(search.foods[0] as unknown as FdcFood);
    expect(r).toMatchObject({ ok: true, food: { per100g: { energyKcal: 120, proteinG: 4.4, carbsG: 21.3, fatG: 1.92, fiberG: null } } });
  });

  it("si solo hay kJ convierte a kcal y lo anota", () => {
    const food: FdcFood = {
      fdcId: 1,
      description: "Test",
      dataType: "Foundation",
      foodNutrients: [
        { nutrient: { id: 1062, number: "268", unitName: "kJ" }, amount: 418.4 },
        { nutrient: { id: 1003, number: "203", unitName: "g" }, amount: 1 },
        { nutrient: { id: 1004, number: "204", unitName: "g" }, amount: 1 },
        { nutrient: { id: 1005, number: "205", unitName: "g" }, amount: 20 },
      ],
    };
    const r = mapUsdaFood(food);
    expect(r).toMatchObject({ ok: true, food: { energyFromKj: true, per100g: { energyKcal: 100 } } });
    expect(r.ok && r.food.description).toContain("Energía calculada desde kJ");
  });
});

describe("piezas del mapeo USDA", () => {
  it("convertMassUnit entre g, mg y µg; null para IU", () => {
    expect(convertMassUnit(1, "g", "mg")).toBe(1000);
    expect(convertMassUnit(1500, "UG", "mg")).toBeCloseTo(1.5);
    expect(convertMassUnit(2, "mg", "µg")).toBeCloseTo(2000);
    expect(convertMassUnit(5, "IU", "µg")).toBeNull();
  });

  it("indexNutrients indexa por id y por número", () => {
    const idx = indexNutrients({ foodNutrients: [{ number: "203", amount: 4, unitName: "g" }] });
    expect(idx.byNumber.get("203")).toEqual({ amount: 4, unit: "g" });
  });

  it("mapFdcPortion traduce unidades comunes y conserva el resto", () => {
    expect(mapFdcPortion({ amount: 1, modifier: "large (2-1/4\" dia)", gramWeight: 50, measureUnit: { name: "undetermined" } })).toEqual({
      label: '1 unidad grande ((2-1/4" dia))',
      quantity: 1,
      unit: "unidad",
      gramWeight: 50,
    });
    expect(mapFdcPortion({ amount: 0.5, portionDescription: "1/2 cup, chopped", gramWeight: 80 })).toMatchObject({ label: "0.5 taza (chopped)", unit: "taza" });
    expect(mapFdcPortion({ amount: 1, modifier: "wedge", gramWeight: 30 })).toMatchObject({ label: "1 wedge", unit: "wedge" });
    expect(mapFdcPortion({ amount: 1, modifier: "cup", gramWeight: 0 })).toBeNull();
  });
});

describe("cliente FDC (fetch simulado)", () => {
  it("busca con la clave, el tamaño de página y solo Foundation + SR Legacy", async () => {
    const fetchImpl = vi.fn(async (url: string) => (url ? jsonResponse(search) : jsonResponse(null, 500)));
    const r = await searchFdc("quinoa", 2, { apiKey: "k-123", fetchImpl });
    expect(r.map((f) => f.fdcId)).toEqual([168917, 168874]);
    const url = new URL(fetchImpl.mock.calls[0][0]);
    expect(url.pathname).toBe("/fdc/v1/foods/search");
    expect(url.searchParams.get("query")).toBe("quinoa");
    expect(url.searchParams.get("pageSize")).toBe("2");
    expect(url.searchParams.get("dataType")).toBe("Foundation,SR Legacy");
    expect(url.searchParams.get("api_key")).toBe("k-123");
  });

  it("pide el detalle en lotes de 20 ids", async () => {
    const fetchImpl = vi.fn(async (url: string) => (url ? jsonResponse([]) : jsonResponse(null, 500)));
    await getFdcFoods(
      Array.from({ length: 25 }, (_, i) => i + 1),
      { apiKey: "k", fetchImpl },
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const first = new URL(fetchImpl.mock.calls[0][0]);
    expect(first.pathname).toBe("/fdc/v1/foods");
    expect(first.searchParams.get("fdcIds")?.split(",")).toHaveLength(20);
  });

  it("un 403 se informa sin filtrar la clave", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: { code: "API_KEY_INVALID" } }, 403));
    const err = await searchFdc("x", 1, { apiKey: "secreta", fetchImpl }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UsdaError);
    expect(err).toMatchObject({ code: "USDA_HTTP_ERROR", status: 403 });
    expect((err as Error).message).not.toContain("secreta");
  });
});

describe("importUsdaFoods sin clave", () => {
  it("lanza USDA_NOT_CONFIGURED antes de tocar la base o la red", async () => {
    const admin = { from: vi.fn(), rpc: vi.fn() };
    const fetchImpl = vi.fn();
    await expect(
      importUsdaFoodsWithKey(admin as never, { query: "quinoa" }, { apiKey: undefined, fetchImpl }),
    ).rejects.toMatchObject({ code: "USDA_NOT_CONFIGURED" });
    expect(admin.from).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("el contrato 3 (usda.ts) lee FDC_API_KEY del entorno del servidor", async () => {
    const previous = process.env.FDC_API_KEY;
    delete process.env.FDC_API_KEY;
    try {
      await expect(importUsdaFoods({} as never, { query: "quinoa" })).rejects.toMatchObject({ code: "USDA_NOT_CONFIGURED" });
    } finally {
      if (previous !== undefined) process.env.FDC_API_KEY = previous;
    }
  });

  it("valida la entrada", async () => {
    await expect(importUsdaFoodsWithKey({} as never, {}, { apiKey: "k" })).rejects.toMatchObject({ code: "USDA_INVALID_INPUT" });
    await expect(importUsdaFoodsWithKey({} as never, { query: "x" }, { apiKey: "k" })).rejects.toMatchObject({ code: "USDA_INVALID_INPUT" });
  });
});
