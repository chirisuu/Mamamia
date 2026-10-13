import { describe, expect, it } from "vitest";
import {
  atwaterKcal,
  contentPageSchema,
  foodSchema,
  mergeFoodsSchema,
  numberOrNull,
  officialRecipeSchema,
  parseCodes,
  planPriceSchema,
  planSchema,
  recipeReviewSchema,
  referencePriceSchema,
  settingsSchema,
  setUserRoleSchema,
  usdaImportSchema,
  type FoodInput,
} from "./schemas";

const UUID = "11111111-1111-4111-8111-111111111111";
const UUID2 = "22222222-2222-4222-8222-222222222222";

const firstMessage = (r: { success: boolean; error?: { issues: Array<{ message: string; path: PropertyKey[] }> } }, path?: string) =>
  r.error?.issues.find((i) => (path ? i.path.join(".") === path : true))?.message;

describe("settingsSchema", () => {
  const base = {
    appName: "ORANGE FIT",
    supportEmail: "Soporte@Example.com ",
    defaultTrialDays: 7,
    maintenanceBanner: "  ",
    featureFlags: [
      { key: "payments_stripe", enabled: true },
      { key: "payments_mercadopago", enabled: false },
    ],
  };

  it("normaliza correo y textos vacíos", () => {
    const r = settingsSchema.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ supportEmail: "soporte@example.com", maintenanceBanner: null });
  });

  it("acepta correo vacío como «sin correo»", () => {
    expect(settingsSchema.parse({ ...base, supportEmail: "" }).supportEmail).toBeNull();
  });

  it("rechaza correo inválido, nombre corto y días fuera de rango", () => {
    expect(firstMessage(settingsSchema.safeParse({ ...base, supportEmail: "no-es-correo" }), "supportEmail")).toBe("Escribe un correo válido.");
    expect(settingsSchema.safeParse({ ...base, appName: "A" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...base, defaultTrialDays: 91 }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...base, defaultTrialDays: 1.5 }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...base, maintenanceBanner: "x".repeat(281) }).success).toBe(false);
  });

  it("rechaza claves de interruptor inválidas o repetidas", () => {
    expect(settingsSchema.safeParse({ ...base, featureFlags: [{ key: "Pagos-Stripe", enabled: true }] }).success).toBe(false);
    const dup = settingsSchema.safeParse({ ...base, featureFlags: [...base.featureFlags, { key: "payments_stripe", enabled: false }] });
    expect(dup.success).toBe(false);
    expect(firstMessage(dup, "featureFlags.2.key")).toBe("Esta clave está repetida.");
  });

  it("solo acepta booleanos en los interruptores", () => {
    expect(settingsSchema.safeParse({ ...base, featureFlags: [{ key: "payments_stripe", enabled: "true" }] }).success).toBe(false);
  });
});

describe("foodSchema", () => {
  const food: FoodInput = {
    name: "Quinua cocida",
    brandName: "",
    description: null,
    foodType: "generic",
    barcode: " 775-1234 5678 ",
    countryCodes: ["PE"],
    energyKcal: 120,
    proteinG: 4.4,
    carbsG: 21.3,
    fatG: 1.9,
    fiberG: 2.8,
    sugarG: 0.9,
    saturatedFatG: null,
    sodiumMg: null,
    densityGPerMl: null,
    source: "curated",
    sourceRef: "Tabla peruana de composición de alimentos 2017",
    sourceUrl: "",
    license: null,
    verificationStatus: "verified",
    isPublic: true,
    portions: [{ label: "1 taza", quantity: 1, unit: "taza", gramWeight: 185, isDefault: true }],
  };

  it("acepta un alimento válido y limpia el código de barras", () => {
    const r = foodSchema.safeParse(food);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ barcode: "77512345678", brandName: null, sourceUrl: null });
  });

  it("exige procedencia", () => {
    expect(foodSchema.safeParse({ ...food, sourceRef: "" }).success).toBe(false);
    expect(foodSchema.safeParse({ ...food, source: "user" }).success).toBe(false);
  });

  it("rechaza valores imposibles por 100 g", () => {
    expect(firstMessage(foodSchema.safeParse({ ...food, proteinG: 50, carbsG: 40, fatG: 20 }), "carbsG")).toMatch(/no pueden pasar de 100 g/);
    expect(foodSchema.safeParse({ ...food, energyKcal: 901 }).success).toBe(false);
    expect(foodSchema.safeParse({ ...food, proteinG: -1 }).success).toBe(false);
    expect(firstMessage(foodSchema.safeParse({ ...food, sugarG: 30 }), "sugarG")).toMatch(/azúcar/);
    expect(firstMessage(foodSchema.safeParse({ ...food, saturatedFatG: 5 }), "saturatedFatG")).toMatch(/saturada/);
  });

  it("exige los macros (vacío no es 0)", () => {
    expect(foodSchema.safeParse({ ...food, energyKcal: null as unknown as number }).success).toBe(false);
    expect(foodSchema.safeParse({ ...food, fiberG: null }).success).toBe(true);
  });

  it("valida código de barras, URL y porciones", () => {
    expect(foodSchema.safeParse({ ...food, barcode: "12345" }).success).toBe(false);
    expect(foodSchema.safeParse({ ...food, sourceUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(
      firstMessage(
        foodSchema.safeParse({
          ...food,
          portions: [
            { label: "1 taza", quantity: 1, unit: "taza", gramWeight: 185, isDefault: true },
            { label: "1 cda", quantity: 1, unit: "cda", gramWeight: 12, isDefault: true },
          ],
        }),
        "portions",
      ),
    ).toMatch(/Solo una porción/);
    expect(foodSchema.safeParse({ ...food, portions: [{ label: "x", quantity: 1, unit: "u", gramWeight: 0, isDefault: false }] }).success).toBe(false);
  });

  it("atwaterKcal usa 4/4/9", () => {
    expect(atwaterKcal({ proteinG: 10, carbsG: 20, fatG: 5 })).toBe(165);
  });
});

describe("planes y precios", () => {
  it("planSchema solo acepta funciones de pago conocidas y límites enteros", () => {
    const plan = {
      planId: "premium",
      name: "Premium",
      description: "",
      isActive: true,
      sortOrder: 1,
      premiumFeatures: ["ai_photo", "meal_plans"],
      aiLimits: { photo: 120, text: 300, voice: 300, chat: 400, plan: 0 },
    };
    expect(planSchema.safeParse(plan).success).toBe(true);
    expect(planSchema.safeParse({ ...plan, premiumFeatures: ["teletransporte"] }).success).toBe(false);
    expect(planSchema.safeParse({ ...plan, aiLimits: { ...plan.aiLimits, photo: -1 } }).success).toBe(false);
    expect(planSchema.safeParse({ ...plan, aiLimits: { ...plan.aiLimits, chat: 2.5 } }).success).toBe(false);
  });

  it("planPriceSchema valida céntimos, moneda e ids de Stripe", () => {
    const price = {
      planId: "premium",
      interval: "month",
      currencyCode: "pen",
      amountCents: 2990,
      trialDays: 7,
      stripePriceId: "",
      mercadopagoPlanId: null,
      isActive: true,
    } as const;
    const r = planPriceSchema.safeParse(price);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ currencyCode: "PEN", stripePriceId: null });
    expect(planPriceSchema.safeParse({ ...price, amountCents: 29.9 }).success).toBe(false);
    expect(planPriceSchema.safeParse({ ...price, currencyCode: "SOLES" }).success).toBe(false);
    expect(firstMessage(planPriceSchema.safeParse({ ...price, stripePriceId: "prod_123" }), "stripePriceId")).toMatch(/price_/);
    expect(planPriceSchema.safeParse({ ...price, stripePriceId: "price_1AbC" }).success).toBe(true);
    expect(planPriceSchema.safeParse({ ...price, interval: "week" }).success).toBe(false);
  });
});

describe("contenidos, recetas, roles y otros", () => {
  it("contentPageSchema exige slug limpio", () => {
    const page = { slug: "Terminos", title: "Términos", kind: "legal", status: "draft", sortOrder: 10, bodyMd: "# Hola" } as const;
    expect(contentPageSchema.parse(page).slug).toBe("terminos");
    expect(contentPageSchema.safeParse({ ...page, slug: "términos de uso" }).success).toBe(false);
    expect(contentPageSchema.safeParse({ ...page, slug: "-inicio" }).success).toBe(false);
    expect(contentPageSchema.safeParse({ ...page, kind: "blog" }).success).toBe(false);
  });

  it("rechazar una receta exige motivo", () => {
    expect(recipeReviewSchema.safeParse({ recipeId: UUID, decision: "reject", note: "no" }).success).toBe(false);
    expect(recipeReviewSchema.safeParse({ recipeId: UUID, decision: "reject", note: "Cambia el pollo casero por uno del catálogo." }).success).toBe(true);
    expect(recipeReviewSchema.safeParse({ recipeId: UUID, decision: "publish", note: "" }).success).toBe(true);
  });

  it("receta oficial: al menos un ingrediente, un paso y una comida", () => {
    const recipe = {
      title: "Quinua con manzana",
      servings: 2,
      steps: ["Cocina la quinua."],
      tags: ["Desayuno "],
      dietTags: ["vegetarian"],
      allergens: [],
      mealTypes: ["breakfast"],
      costCurrency: "PEN",
      status: "draft",
      ingredients: [{ foodId: UUID, grams: 100 }],
    } as const;
    const r = officialRecipeSchema.safeParse(recipe);
    expect(r.success).toBe(true);
    expect(r.data?.tags).toEqual(["desayuno"]);
    expect(officialRecipeSchema.safeParse({ ...recipe, ingredients: [] }).success).toBe(false);
    expect(officialRecipeSchema.safeParse({ ...recipe, steps: [] }).success).toBe(false);
    expect(officialRecipeSchema.safeParse({ ...recipe, mealTypes: [] }).success).toBe(false);
    expect(officialRecipeSchema.safeParse({ ...recipe, allergens: ["polen"] }).success).toBe(false);
    expect(officialRecipeSchema.safeParse({ ...recipe, status: "pending_review" }).success).toBe(false);
  });

  it("los roles otorgables no incluyen superadmin", () => {
    expect(setUserRoleSchema.safeParse({ userId: UUID, role: "editor", grant: true }).success).toBe(true);
    expect(setUserRoleSchema.safeParse({ userId: UUID, role: "superadmin", grant: true }).success).toBe(false);
    expect(setUserRoleSchema.safeParse({ userId: "x", role: "admin", grant: true }).success).toBe(false);
  });

  it("fusionar exige dos alimentos distintos", () => {
    expect(mergeFoodsSchema.safeParse({ keepId: UUID, dropId: UUID }).success).toBe(false);
    expect(mergeFoodsSchema.safeParse({ keepId: UUID, dropId: UUID2 }).success).toBe(true);
  });

  it("importación USDA: búsqueda o lista de FDC ID", () => {
    expect(usdaImportSchema.parse({ mode: "ids", fdcIds: "2346404, 168917 ;9", limit: 10 }).fdcIds).toEqual([2346404, 168917, 9]);
    expect(usdaImportSchema.safeParse({ mode: "ids", fdcIds: "abc", limit: 10 }).success).toBe(false);
    expect(usdaImportSchema.safeParse({ mode: "ids", fdcIds: "", limit: 10 }).success).toBe(false);
    expect(usdaImportSchema.safeParse({ mode: "query", query: "q", limit: 10 }).success).toBe(false);
    expect(usdaImportSchema.safeParse({ mode: "query", query: "quinoa", limit: 51 }).success).toBe(false);
    expect(usdaImportSchema.safeParse({ mode: "query", query: "quinoa", limit: 5 }).success).toBe(true);
  });

  it("precio referencial: fecha válida y fuente", () => {
    const price = { itemName: "Pollo entero", countryCode: "pe", currencyCode: "PEN", price: 11.9, perQuantity: 1, perUnit: "kg", source: "Mercado", observedOn: "2026-10-13" } as const;
    const r = referencePriceSchema.safeParse(price);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ countryCode: "PE", foodId: null });
    expect(referencePriceSchema.safeParse({ ...price, observedOn: "2026-02-30" }).success).toBe(false);
    expect(referencePriceSchema.safeParse({ ...price, source: "" }).success).toBe(false);
    expect(referencePriceSchema.safeParse({ ...price, perUnit: "saco" }).success).toBe(false);
  });
});

describe("utilidades de formulario", () => {
  it("numberOrNull: vacío → null, coma decimal y texto inválido → NaN", () => {
    expect(numberOrNull("")).toBeNull();
    expect(numberOrNull("  ")).toBeNull();
    expect(numberOrNull("12,5")).toBe(12.5);
    expect(numberOrNull(3)).toBe(3);
    expect(Number.isNaN(numberOrNull("abc"))).toBe(true);
  });

  it("parseCodes normaliza y quita repetidos", () => {
    expect(parseCodes("pe, us ;PE  cl")).toEqual(["PE", "US", "CL"]);
  });
});
