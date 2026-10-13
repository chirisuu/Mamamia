import { describe, expect, it } from "vitest";
import { computeReminders, pendingMeal, type ReminderInput } from "./reminders";

const base: ReminderInput = {
  hour: 9,
  today: "2026-10-13",
  loggedMeals: [],
  waterMl: 0,
  waterTargetMl: 2000,
  lastWeightDate: "2026-10-12",
  showWeightReminders: true,
  hasTarget: true,
};

describe("pendingMeal", () => {
  it("según la hora local, solo la comida que ya pasó", () => {
    expect(pendingMeal(9, [])).toBeNull();
    expect(pendingMeal(10, [])).toBe("breakfast");
    expect(pendingMeal(12, ["breakfast"])).toBeNull();
    expect(pendingMeal(15, ["breakfast"])).toBe("lunch");
    expect(pendingMeal(16, ["breakfast", "lunch"])).toBeNull();
    expect(pendingMeal(21, ["breakfast", "lunch"])).toBe("dinner");
    expect(pendingMeal(22, ["dinner"])).toBeNull();
  });

  it("si ya almorzó no insiste con el desayuno", () => {
    expect(pendingMeal(13, ["lunch"])).toBeNull();
  });
});

describe("computeReminders", () => {
  it("temprano y con todo al día no hay recordatorios", () => {
    expect(computeReminders(base)).toEqual([]);
  });

  it("almuerzo pendiente con enlace al buscador en esa comida", () => {
    const r = computeReminders({ ...base, hour: 16, loggedMeals: ["breakfast"], waterMl: 1500 });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: "meal", title: "Aún no registras el almuerzo", href: "/app/agregar/buscar?comida=lunch" });
    expect(r[0]!.body).toContain("no pasa nada");
  });

  it("agua por debajo de la mitad después de las 14 h", () => {
    const r = computeReminders({ ...base, hour: 14, loggedMeals: ["breakfast", "lunch"], waterMl: 750 });
    expect(r.map((x) => x.id)).toEqual(["water"]);
    expect(r[0]!.title).toBe("Llevas 750 ml de 2.00 L de agua");
    expect(computeReminders({ ...base, hour: 14, loggedMeals: ["lunch"], waterMl: 1000 })).toEqual([]);
    expect(computeReminders({ ...base, hour: 18, loggedMeals: ["lunch"], waterTargetMl: null })).toEqual([]);
  });

  it("peso: después de 7 días o si nunca se registró, salvo perfil sensible", () => {
    expect(computeReminders({ ...base, lastWeightDate: "2026-10-06" })[0]).toMatchObject({
      id: "weight",
      title: "Tu último pesaje fue hace 7 días",
    });
    expect(computeReminders({ ...base, lastWeightDate: null })[0]!.title).toBe("Aún no registras tu peso");
    expect(computeReminders({ ...base, lastWeightDate: null, showWeightReminders: false })).toEqual([]);
  });

  it("sin meta, primero invita a definirla", () => {
    expect(computeReminders({ ...base, hasTarget: false })[0]).toMatchObject({ id: "target", href: "/app/perfil/metas" });
  });
});
