import { describe, expect, it } from "vitest";
import { manualFloor, manualTargetsSchema, reviewManualTargets, type ManualTargetsContext } from "./manual-targets";

const ctx: ManualTargetsContext = { sex: "female", bmr: 1390, tdee: 1910, deficitBlocked: false, cautious: false };
const macros = (kcal: number) => ({ proteinG: 120, fatG: 50, carbsG: Math.round((kcal - 4 * 120 - 9 * 50) / 4) });

describe("revisión de metas manuales", () => {
  it("una meta razonable no tiene errores ni avisos", () => {
    expect(reviewManualTargets({ energyKcal: 1600, ...macros(1600) }, ctx)).toEqual({ errors: [], warnings: [] });
  });

  it("bloquea por debajo del piso (1200 mujer, 1500 hombre; 1500 si no se sabe)", () => {
    expect(manualFloor("female")).toBe(1200);
    expect(manualFloor("male")).toBe(1500);
    expect(manualFloor(null)).toBe(1500);
    const r = reviewManualTargets({ energyKcal: 1100, ...macros(1100) }, ctx);
    expect(r.errors.map((e) => e.code)).toEqual(["below_floor"]);
    const male = reviewManualTargets({ energyKcal: 1400, ...macros(1400) }, { ...ctx, sex: "male", bmr: 1700, tdee: 2400 });
    expect(male.errors.map((e) => e.code)).toEqual(["below_floor"]);
  });

  it("avisa bajo el metabolismo basal y con déficit mayor al 25 %", () => {
    const r = reviewManualTargets({ energyKcal: 1300, ...macros(1300) }, ctx);
    expect(r.errors).toEqual([]);
    expect(r.warnings.map((w) => w.code)).toEqual(["below_bmr", "large_deficit"]);
  });

  it("respeta el bloqueo de déficit del cribado (menores, embarazo…)", () => {
    const r = reviewManualTargets({ energyKcal: 1700, ...macros(1700) }, { ...ctx, deficitBlocked: true });
    expect(r.errors.map((e) => e.code)).toEqual(["deficit_blocked"]);
    expect(reviewManualTargets({ energyKcal: 1950, ...macros(1950) }, { ...ctx, deficitBlocked: true }).errors).toEqual([]);
  });

  it("para el profesional los bloqueos pasan a ser avisos", () => {
    const r = reviewManualTargets({ energyKcal: 1100, ...macros(1100) }, ctx, { byProfessional: true });
    expect(r.errors).toEqual([]);
    expect(r.warnings.map((w) => w.code)).toContain("below_floor");
  });

  it("avisa si los macros no cuadran con las calorías", () => {
    const r = reviewManualTargets({ energyKcal: 1800, proteinG: 100, carbsG: 100, fatG: 40 }, ctx);
    expect(r.warnings.map((w) => w.code)).toEqual(["macro_mismatch"]);
  });

  it("avisa superávit grande, y con precaución desde el 10 %", () => {
    expect(reviewManualTargets({ energyKcal: 2400, ...macros(2400) }, ctx).warnings.map((w) => w.code)).toEqual(["large_surplus"]);
    expect(
      reviewManualTargets({ energyKcal: 2150, ...macros(2150) }, { ...ctx, cautious: true }).warnings.map((w) => w.code),
    ).toEqual(["cautious_surplus"]);
  });

  it("el esquema aplica los rangos de la base", () => {
    const ok = { energyKcal: 1800, proteinG: 120, carbsG: 200, fatG: 60, fiberG: 25, waterMl: 2000, notes: null };
    expect(manualTargetsSchema.safeParse(ok).success).toBe(true);
    expect(manualTargetsSchema.safeParse({ ...ok, energyKcal: 400 }).success).toBe(false);
    expect(manualTargetsSchema.safeParse({ ...ok, proteinG: 12.5 }).success).toBe(false);
    expect(manualTargetsSchema.safeParse({ ...ok, fiberG: null, waterMl: null }).success).toBe(true);
  });
});
