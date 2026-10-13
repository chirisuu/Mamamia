import { beforeEach, describe, expect, it, vi } from "vitest";
import found from "@/lib/foods/__fixtures__/off-product-found.json";
import incomplete from "@/lib/foods/__fixtures__/off-product-incomplete.json";
import { parseBarcode } from "@/lib/foods/barcode";
import { OffError, type OffFetchResult, type OffProduct } from "@/lib/foods/open-food-facts";

const findFoodByBarcodes = vi.fn();
const getFoodDetail = vi.fn();
const saveOffFood = vi.fn();

vi.mock("@/lib/foods/details", () => ({
  findFoodByBarcodes: (...a: unknown[]) => findFoodByBarcodes(...a),
  getFoodDetail: (...a: unknown[]) => getFoodDetail(...a),
}));
vi.mock("@/lib/foods/off-import", () => ({
  saveOffFood: (...a: unknown[]) => saveOffFood(...a),
  OffSaveError: class OffSaveError extends Error {},
}));

import { lookupBarcode, type BarcodeLookupDeps } from "./barcode-lookup";

const CODE = "7751271011235";
const parsed = (() => {
  const p = parseBarcode(CODE);
  if (!p.ok) throw new Error("código de prueba inválido");
  return p;
})();

const detail = { id: "food-1", name: "Leche evaporada entera" };
const adminRpc = vi.fn(async () => ({ data: true, error: null }));
const admin = { rpc: adminRpc } as unknown as BarcodeLookupDeps["supabase"];

function deps(over: Partial<BarcodeLookupDeps> = {}): BarcodeLookupDeps {
  return {
    supabase: {} as BarcodeLookupDeps["supabase"],
    userId: "user-1",
    getAdmin: () => admin,
    fetchOff: vi.fn(async (): Promise<OffFetchResult> => ({ status: "found", product: found.product as OffProduct })),
    ...over,
  };
}

beforeEach(() => {
  findFoodByBarcodes.mockReset().mockResolvedValue({ status: "none" });
  getFoodDetail.mockReset().mockResolvedValue(detail);
  saveOffFood.mockReset().mockResolvedValue({ id: "food-1", created: true });
  adminRpc.mockClear();
});

describe("lookupBarcode (OFF simulado)", () => {
  it("si está en la base no consulta OFF", async () => {
    findFoodByBarcodes.mockResolvedValue({ status: "found", food: detail, matchedCode: CODE });
    const d = deps();
    const r = await lookupBarcode(parsed, d);
    expect(r).toEqual({ kind: "ok", body: { food: detail, origin: "database", barcode: { code: CODE, format: "ean13" } } });
    expect(d.fetchOff).not.toHaveBeenCalled();
    expect(findFoodByBarcodes).toHaveBeenCalledWith(d.supabase, parsed.lookupCodes, "user-1");
  });

  it("solo rechazados → 404 REJECTED sin ir a OFF", async () => {
    findFoodByBarcodes.mockResolvedValue({ status: "rejected", matchedCode: CODE });
    const d = deps();
    expect(await lookupBarcode(parsed, d)).toMatchObject({ kind: "error", status: 404, code: "REJECTED" });
    expect(d.fetchOff).not.toHaveBeenCalled();
  });

  it("OFF lo tiene con datos válidos → se guarda con el cliente admin y se devuelve", async () => {
    const r = await lookupBarcode(parsed, deps());
    expect(r).toMatchObject({ kind: "ok", body: { origin: "open_food_facts", food: detail } });
    expect(saveOffFood).toHaveBeenCalledWith(admin, expect.objectContaining({ barcode: CODE, name: "Leche evaporada entera", brandName: "Gloria" }));
    expect(adminRpc).toHaveBeenCalledWith("check_rate_limit", { bucket: "off_api:global", max_hits: 90, window_seconds: 60 });
  });

  it("sin service role → 503 explicando que no se puede guardar (no guarda nada)", async () => {
    const r = await lookupBarcode(parsed, deps({ getAdmin: () => null }));
    expect(r).toMatchObject({ kind: "error", status: 503, code: "NOT_CONFIGURED" });
    expect(r.kind === "error" && r.message).toMatch(/no podemos guardarlo/);
    expect(saveOffFood).not.toHaveBeenCalled();
  });

  it("OFF no lo tiene → 404 NOT_FOUND", async () => {
    const r = await lookupBarcode(parsed, deps({ fetchOff: async () => ({ status: "not_found" }) }));
    expect(r).toMatchObject({ kind: "error", status: 404, code: "NOT_FOUND" });
  });

  it("OFF no responde → 502 (tiempo agotado y caída)", async () => {
    const timeout = await lookupBarcode(parsed, deps({ fetchOff: async () => Promise.reject(new OffError("OFF_TIMEOUT", "Open Food Facts no respondió a tiempo.")) }));
    expect(timeout).toMatchObject({ kind: "error", status: 502, code: "UPSTREAM_TIMEOUT" });
    const down = await lookupBarcode(parsed, deps({ fetchOff: async () => Promise.reject(new OffError("OFF_UNAVAILABLE", "x", 500)) }));
    expect(down).toMatchObject({ kind: "error", status: 502, code: "UPSTREAM_ERROR" });
    expect(saveOffFood).not.toHaveBeenCalled();
  });

  it("OFF sin datos mínimos por 100 g → 422 con nombre y marca para precargar", async () => {
    const r = await lookupBarcode(parsed, deps({ fetchOff: async () => ({ status: "found", product: incomplete.product as OffProduct }) }));
    expect(r).toMatchObject({ kind: "error", status: 422, code: "INCOMPLETE_DATA", product: { name: "Inca Kola", brandName: "Inca Kola" } });
    expect(saveOffFood).not.toHaveBeenCalled();
  });

  it("límite global de OFF alcanzado → 503 UPSTREAM_BUSY sin consultar", async () => {
    adminRpc.mockResolvedValueOnce({ data: false, error: null });
    const d = deps();
    expect(await lookupBarcode(parsed, d)).toMatchObject({ kind: "error", status: 503, code: "UPSTREAM_BUSY" });
    expect(d.fetchOff).not.toHaveBeenCalled();
  });
});
