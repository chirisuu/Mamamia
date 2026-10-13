import { describe, expect, it } from "vitest";
import { baseProvenance, itemProvenance } from "./provenance";

describe("baseProvenance", () => {
  it("prefiere el alimento vigente", () => {
    expect(baseProvenance("usda:unverified", { source: "curated", verificationStatus: "verified" })).toBe(
      "Base curada · verificado",
    );
  });

  it("interpreta el texto guardado por addItemsToMeal", () => {
    expect(baseProvenance("usda:verified · FDC 123")).toBe("USDA FoodData Central · verificado");
    expect(baseProvenance("user:unverified")).toBe("Creado por ti · pendiente de verificación");
    expect(baseProvenance("recipe:calculated_from_ingredients")).toBe("Receta · calculada desde sus ingredientes");
    expect(baseProvenance("user_entered")).toBe("Valores ingresados por ti");
  });

  it("no inventa procedencias desconocidas", () => {
    expect(baseProvenance(null)).toBe("Procedencia no registrada");
    expect(baseProvenance("algo:raro")).toBe("Procedencia no registrada");
  });
});

describe("itemProvenance", () => {
  it("marca la IA con su confianza", () => {
    const p = itemProvenance({ source: "photo_ai", dataProvenance: "curated:curated", isEstimate: true, confidence: 0.8 });
    expect(p).toEqual({
      label: "Estimación con IA por foto (confianza 80 %) · Base curada · revisado por el equipo",
      isAi: true,
      isEstimate: true,
    });
  });

  it("los manuales son estimaciones del usuario", () => {
    const p = itemProvenance({ source: "manual", dataProvenance: "user_entered", isEstimate: true, confidence: null });
    expect(p.label).toBe("Estimación ingresada por ti");
    expect(p.isEstimate).toBe(true);
    expect(p.isAi).toBe(false);
  });

  it("un alimento de la base no es estimación", () => {
    const p = itemProvenance({ source: "search", dataProvenance: "usda:verified", isEstimate: false, confidence: null });
    expect(p).toEqual({ label: "USDA FoodData Central · verificado", isAi: false, isEstimate: false });
  });
});
