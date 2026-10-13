import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { FoodSummary } from "@/lib/foods/types";

const mocks = vi.hoisted(() => ({ searchFoods: vi.fn(), withPortions: vi.fn() }));
vi.mock("@/lib/foods/search", () => ({ searchFoods: mocks.searchFoods }));
vi.mock("@/lib/foods/details", () => ({ withPortions: mocks.withPortions }));

import { findFoodMatches, matchCandidates, searchQueryVariants } from "./matching";

const supabase = {} as SupabaseClient<Database>;

function food(id: string, name: string): FoodSummary {
  return {
    id,
    name,
    brandName: null,
    foodType: "generic",
    barcode: null,
    per100g: { energyKcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, fiberG: 0.4, sugarG: null, saturatedFatG: null, sodiumMg: null },
    source: "curated",
    sourceRef: null,
    verificationStatus: "verified",
    isOwn: false,
    densityGPerMl: null,
  };
}

describe("searchQueryVariants", () => {
  it("va de lo específico a lo general, sin repetir", () => {
    expect(searchQueryVariants("pechuga de pollo a la plancha")).toEqual(["pechuga de pollo a la plancha", "pechuga de pollo", "pechuga"]);
    expect(searchQueryVariants("papa sancochada")).toEqual(["papa sancochada", "papa"]);
    expect(searchQueryVariants("palta")).toEqual(["palta"]);
    expect(searchQueryVariants("arroz blanco cocido")).toEqual(["arroz blanco cocido", "arroz blanco", "arroz"]);
  });
});

describe("findFoodMatches", () => {
  beforeEach(() => {
    mocks.searchFoods.mockReset();
    mocks.withPortions.mockReset();
    mocks.withPortions.mockImplementation(async (_s: unknown, foods: FoodSummary[]) => foods.map((f) => ({ ...f, portions: [] })));
  });

  it("devuelve como máximo 3 coincidencias de la base, con porciones", async () => {
    mocks.searchFoods.mockResolvedValueOnce([food("1", "Arroz blanco cocido"), food("2", "Arroz integral cocido"), food("3", "Arroz chaufa"), food("4", "Arroz con leche")]);
    const res = await findFoodMatches(supabase, "arroz blanco cocido");
    expect(res.map((f) => f.id)).toEqual(["1", "2", "3"]);
    expect(res[0]).toHaveProperty("portions");
    expect(mocks.searchFoods).toHaveBeenCalledWith(supabase, "arroz blanco cocido", 3);
  });

  it("si no hay resultados prueba variantes más generales", async () => {
    mocks.searchFoods.mockResolvedValueOnce([]).mockResolvedValueOnce([food("9", "Pollo, pechuga")]);
    const res = await findFoodMatches(supabase, "pechuga de pollo a la plancha");
    expect(mocks.searchFoods.mock.calls.map((c) => c[1])).toEqual(["pechuga de pollo a la plancha", "pechuga de pollo"]);
    expect(res.map((f) => f.id)).toEqual(["9"]);
  });

  it("sin coincidencias → lista vacía (la UI dice «sin dato verificado»)", async () => {
    mocks.searchFoods.mockResolvedValue([]);
    await expect(findFoodMatches(supabase, "plato inventado raro")).resolves.toEqual([]);
    expect(mocks.withPortions).not.toHaveBeenCalled();
  });

  it("matchCandidates conserva el orden de los candidatos", async () => {
    mocks.searchFoods.mockImplementation(async (_s: unknown, q: string) => (q === "palta" ? [food("p", "Palta")] : q === "pan" ? [food("b", "Pan francés")] : []));
    const res = await matchCandidates(supabase, ["palta", "zzz", "pan"]);
    expect(res.map((list) => list.map((f) => f.id))).toEqual([["p"], [], ["b"]]);
  });
});
