import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { parseSharedPlan } from "./shared";
import { buildPlanPdf, pdfFileName, planPdfData, toWinAnsi } from "./pdf";
import type { DraftItem, PlanParams } from "./types";

const params: PlanParams = {
  version: 1,
  seed: "abc",
  mealsPerDay: 3,
  targetKcal: 1800,
  proteinG: 110,
  targetSource: "auto",
  floorApplied: false,
  avoidAllergens: [],
  dietPattern: null,
  weeklyBudget: null,
  currency: "PEN",
  maxPrepMinutes: null,
  regenerations: 0,
  generation: null,
};

const item = (over: Partial<DraftItem>): DraftItem => ({
  key: "k",
  id: "i",
  dayIndex: 0,
  slotIndex: 0,
  kind: "recipe",
  recipeId: "r",
  foodId: null,
  name: "Receta",
  slug: null,
  servings: 1,
  grams: null,
  kcal: 500,
  proteinG: 30,
  carbsG: 50,
  fatG: 15,
  cost: null,
  ...over,
});

describe("toWinAnsi", () => {
  it("conserva tildes, ñ, ¿ y ¡ y reemplaza lo que Helvetica no puede dibujar", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const charset = new Set(font.getCharacterSet());
    expect(toWinAnsi("Ají de gallina, ñoquis y piña ¿sí? ¡Ñandú!", charset)).toBe("Ají de gallina, ñoquis y piña ¿sí? ¡Ñandú!");
    expect(toWinAnsi("≥ 20 g → listo 🍳 ≈ ok", charset)).toBe(">= 20 g -> listo  ~ ok");
    expect(toWinAnsi("línea\nnueva\tcon tab", charset)).toBe("línea nueva con tab");
    expect(toWinAnsi("Ș ă", charset)).toBe("S a");
    // El resultado siempre se puede codificar.
    expect(() => font.encodeText(toWinAnsi("中文 ✓ — · €", charset))).not.toThrow();
  });
});

describe("buildPlanPdf", () => {
  it("construye el PDF sin errores con nombres con tildes y ñ, varias páginas y totales", async () => {
    const items: DraftItem[] = [];
    for (let d = 0; d < 7; d++) {
      items.push(
        item({ key: `${d}a`, dayIndex: d, slotIndex: 0, name: "Avena con plátano, chía y canela — versión ligera para el desayuno de la semana" }),
        item({ key: `${d}b`, dayIndex: d, slotIndex: 1, name: "Ají de gallina con ñame ≥ 20 g de proteína 🍗", servings: 1.5, kcal: 650 }),
        item({ key: `${d}c`, dayIndex: d, slotIndex: 2, kind: "food", recipeId: null, foodId: "f", name: "Piña en cubos", servings: null, grams: 150, kcal: 75 }),
      );
    }
    const data = planPdfData({ name: "Semana de otoño: niños y señoras", startDate: "2026-10-13", days: 7, params, items }, "ORANGE FIT");
    expect(data.days).toHaveLength(7);
    expect(data.days[0]!.totals.kcal).toBe(1225);
    expect(data.days[0]!.rows[1]!.amount).toBe("1.50 porciones");
    expect(data.days[0]!.rows[2]!.amount).toBe("150 g");
    expect(data.subtitle).toMatch(/Meta diaria: 1,800 kcal y 110 g de proteína/);

    const bytes = await buildPlanPdf(data);
    expect(bytes.byteLength).toBeGreaterThan(1000);
    const parsed = await PDFDocument.load(bytes);
    expect(parsed.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(parsed.getTitle()).toContain("Semana de otoño: niños y señoras");
  });

  it("un plan vacío también se exporta", async () => {
    const bytes = await buildPlanPdf(planPdfData({ name: "Vacío", startDate: "2026-10-13", days: 1, params: { ...params, targetKcal: null }, items: [] }, "App"));
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it("nombre de archivo seguro", () => {
    expect(pdfFileName("Mi plan: Ñandú & café!")).toBe("plan-mi-plan-nandu-cafe.pdf");
    expect(pdfFileName("¿?")).toBe("plan-comidas.pdf");
  });
});

describe("parseSharedPlan", () => {
  it("lee el JSON de get_shared_plan sin datos personales y agrupa por día", () => {
    const view = parseSharedPlan({
      name: "Semana",
      start_date: "2026-10-13",
      days: 2,
      shared_at: "2026-10-13T10:00:00Z",
      items: [
        { day_index: 0, meal_type: "lunch", position: 10, recipe: { title: "Seco de res", slug: null }, food: null, servings: 1, grams: null, energy_kcal: 600, protein_g: 40, carbs_g: 50, fat_g: 20 },
        { day_index: 0, meal_type: "breakfast", position: 0, recipe: null, food: { name: "Plátano" }, servings: null, grams: 120, energy_kcal: 107, protein_g: 1.3, carbs_g: 27, fat_g: 0.4 },
      ],
    });
    expect(view?.dayList).toHaveLength(2);
    expect(view?.dayList[0]!.meals.map((m) => m.title)).toEqual(["Plátano", "Seco de res"]);
    expect(view?.dayList[0]!.totals.kcal).toBe(707);
    expect(view?.dayList[1]!.meals).toEqual([]);
    expect(parseSharedPlan(null)).toBeNull();
    expect(parseSharedPlan({ name: "x", start_date: "mal" })).toBeNull();
  });
});
