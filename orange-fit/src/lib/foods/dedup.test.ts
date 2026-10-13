import { describe, expect, it } from "vitest";
import { findDuplicatePairs, macroCloseness, normalizeFoodName, normalizeText, scoreDuplicate, trigrams, trigramSimilarity, type DuplicateFood } from "./dedup";

const food = (name: string, kcal: number, p: number, c: number, f: number, extra: Partial<DuplicateFood> = {}): DuplicateFood & { id: string } => ({
  id: name,
  name,
  brandName: null,
  barcode: null,
  per100g: { energyKcal: kcal, proteinG: p, carbsG: c, fatG: f },
  ...extra,
});

describe("normalización", () => {
  it("normalizeText quita tildes, baja a minúsculas y colapsa espacios", () => {
    expect(normalizeText("  Ají   AMARILLO ")).toBe("aji amarillo");
    expect(normalizeText("Ñandú")).toBe("nandu");
  });

  it("normalizeFoodName además quita puntuación y unifica unidades", () => {
    expect(normalizeFoodName("Arroz blanco, cocido (sin sal)")).toBe("arroz blanco cocido sin sal");
    expect(normalizeFoodName("Yogur 1L")).toBe("yogur 1 l");
    expect(normalizeFoodName("Avena 500gr.")).toBe("avena 500 g");
    expect(normalizeFoodName("Leche 0.5% grasa")).toBe("leche 0 5 % grasa");
  });
});

describe("trigramas (como pg_trgm)", () => {
  it("rellena cada palabra con dos espacios delante y uno detrás", () => {
    expect([...trigrams("Cat")].sort()).toEqual(["  c", " ca", "at ", "cat"].sort());
  });

  it("similitud 1 para textos iguales (normalizados) y baja para distintos", () => {
    expect(trigramSimilarity("Plátano", "platano")).toBe(1);
    expect(trigramSimilarity("arroz blanco cocido", "arroz blanco, cocido")).toBe(1);
    expect(trigramSimilarity("pechuga de pollo", "palta")).toBeLessThan(0.2);
    expect(trigramSimilarity("", "algo")).toBe(0);
  });
});

describe("puntaje de duplicado", () => {
  it("macroCloseness es 1 con valores iguales y baja con diferencias grandes", () => {
    expect(macroCloseness(food("a", 130, 2.7, 28, 0.3), food("b", 130, 2.7, 28, 0.3))).toBe(1);
    expect(macroCloseness(food("a", 130, 2.7, 28, 0.3), food("b", 600, 25, 10, 50))).toBeLessThan(0.3);
  });

  it("marcas distintas o códigos distintos penalizan; misma marca suma", () => {
    const a = food("Galleta soda", 430, 9, 70, 12, { brandName: "Field" });
    const same = scoreDuplicate(a, { ...a, brandName: "FIELD" });
    const other = scoreDuplicate(a, { ...a, brandName: "Costa" });
    expect(same.brand).toBe("same");
    expect(other.brand).toBe("different");
    expect(same.similarity).toBe(1);
    // Misma ficha con otra marca queda bajo el umbral por defecto (0.8): son productos distintos.
    expect(other.similarity).toBeCloseTo(0.7, 5);
    expect(scoreDuplicate({ ...a, barcode: "1" }, { ...a, barcode: "2" }).similarity).toBeLessThan(0.8);
  });
});

describe("findDuplicatePairs", () => {
  const catalog = [
    food("Arroz blanco cocido", 130, 2.7, 28.2, 0.3),
    food("Arroz blanco, cocido", 129, 2.7, 28, 0.3),
    food("Arroz integral cocido", 123, 2.7, 25.6, 1),
    food("Pechuga de pollo a la plancha", 165, 31, 0, 3.6),
    food("Pechuga de pollo, a la plancha", 165, 31, 0, 3.6),
    food("Palta", 160, 2, 8.5, 14.7),
    food("Queso fresco", 264, 17, 3, 20, { brandName: "Gloria" }),
    food("Queso fresco", 270, 18, 2, 21, { brandName: "Laive" }),
  ];

  it("encuentra los pares casi idénticos y no los parecidos de verdad distintos", () => {
    const pairs = findDuplicatePairs(catalog);
    const names = pairs.map((p) => [p.a.name, p.b.name]);
    expect(names).toContainEqual(["Arroz blanco cocido", "Arroz blanco, cocido"]);
    expect(names).toContainEqual(["Pechuga de pollo a la plancha", "Pechuga de pollo, a la plancha"]);
    // Integral ≠ blanco (otro alimento) y quesos de marcas distintas: no son duplicados.
    expect(names.some(([a, b]) => a.includes("integral") || b.includes("integral"))).toBe(false);
    expect(names.some(([a]) => a === "Queso fresco")).toBe(false);
    expect(pairs.every((p) => p.similarity >= 0.8)).toBe(true);
    expect(pairs[0].similarity).toBeGreaterThanOrEqual(pairs[pairs.length - 1].similarity);
  });

  it("respeta el umbral y el límite", () => {
    expect(findDuplicatePairs(catalog, { threshold: 0.99, limit: 10 }).length).toBeLessThanOrEqual(2);
    expect(findDuplicatePairs(catalog, { threshold: 0, limit: 1 })).toHaveLength(1);
    expect(findDuplicatePairs([])).toEqual([]);
  });
});
