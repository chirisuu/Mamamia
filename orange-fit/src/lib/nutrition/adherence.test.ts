import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import type { DayIntake } from "./adherence";
import { computeStreaks, dayStatus, weeklyAdherence } from "./adherence";
import { NutritionInputError } from "./errors";

const day = (date: string, patch: Partial<DayIntake> = {}): DayIntake => ({
  date,
  logged: true,
  energyKcal: 2000,
  proteinG: 120,
  targetKcal: 2000,
  targetProteinG: 120,
  ...patch,
});

describe("dayStatus", () => {
  it("sin registro: nada se cumple y no hay porcentajes", () => {
    expect(dayStatus(day("2026-10-13", { logged: false }))).toEqual({
      date: "2026-10-13",
      logged: false,
      kcalOnTarget: false,
      proteinOnTarget: false,
      goalsMet: false,
      kcalDeviationPct: null,
      proteinPct: null,
    });
  });

  it("kcal dentro de ±10 % (bordes incluidos)", () => {
    expect(dayStatus(day("2026-10-13", { energyKcal: 2200 })).kcalOnTarget).toBe(true);
    expect(dayStatus(day("2026-10-13", { energyKcal: 1800 })).kcalOnTarget).toBe(true);
    expect(dayStatus(day("2026-10-13", { energyKcal: 2201 })).kcalOnTarget).toBe(false);
    expect(dayStatus(day("2026-10-13", { energyKcal: 1799 })).kcalDeviationPct).toBe(-10.1);
  });

  it("proteína ≥ 90 % de la meta", () => {
    expect(dayStatus(day("2026-10-13", { proteinG: 108 })).proteinOnTarget).toBe(true);
    expect(dayStatus(day("2026-10-13", { proteinG: 107 })).proteinOnTarget).toBe(false);
    expect(dayStatus(day("2026-10-13", { proteinG: 108 })).proteinPct).toBe(90);
  });

  it("sin meta de proteína, la proteína no bloquea las metas", () => {
    const s = dayStatus(day("2026-10-13", { targetProteinG: 0, proteinG: 0 }));
    expect(s.proteinOnTarget).toBe(true);
    expect(s.proteinPct).toBeNull();
    expect(s.goalsMet).toBe(true);
  });

  it("valida las entradas", () => {
    expect(() => dayStatus(day("2026-10-13", { targetKcal: 0 }))).toThrow(NutritionInputError);
    expect(() => dayStatus(day("2026-10-13", { energyKcal: -1 }))).toThrow(NutritionInputError);
    expect(() => dayStatus(day("13/10/2026"))).toThrow("AAAA-MM-DD");
  });
});

describe("computeStreaks", () => {
  const today = "2026-10-13";
  const range = (from: string, n: number, patch: Partial<DayIntake> = {}) =>
    Array.from({ length: n }, (_, i) => day(addDays(from, i), patch));

  it("hoy suma si ya registró", () => {
    const s = computeStreaks(range("2026-10-10", 4), today);
    expect(s.logging).toEqual({ current: 4, longest: 4, todayCounts: true });
    expect(s.goals.current).toBe(4);
  });

  it("si hoy aún no registra, la racha sigue viva desde ayer", () => {
    const s = computeStreaks(range("2026-10-10", 3), today);
    expect(s.logging).toEqual({ current: 3, longest: 3, todayCounts: false });
  });

  it("un día sin registro corta la racha; la más larga se conserva", () => {
    const days = [...range("2026-10-01", 5), ...range("2026-10-07", 7)].filter((d) => d.date !== "2026-10-10");
    const s = computeStreaks(days, today);
    expect(s.logging.current).toBe(3); // 11, 12, 13
    expect(s.logging.longest).toBe(5); // 1–5
  });

  it("comer más NO rompe la racha de registro (sí la de metas)", () => {
    const days = range("2026-10-10", 4);
    days[1] = day("2026-10-11", { energyKcal: 4000 });
    const s = computeStreaks(days, today);
    expect(s.logging.current).toBe(4);
    expect(s.goals.current).toBe(2);
    expect(s.goals.longest).toBe(2);
  });

  it("la meta de hoy cuenta solo si ya se cumple", () => {
    const days = [...range("2026-10-10", 3), day(today, { energyKcal: 600 })];
    const s = computeStreaks(days, today);
    expect(s.goals).toEqual({ current: 3, longest: 3, todayCounts: false });
    expect(s.logging.todayCounts).toBe(true);
  });

  it("ignora fechas futuras y funciona sin datos", () => {
    const s = computeStreaks([day("2026-10-20")], today);
    expect(s.logging).toEqual({ current: 0, longest: 0, todayCounts: false });
    expect(computeStreaks([], today).goals.current).toBe(0);
  });

  it("días registrados sin cumplir metas en medio", () => {
    const days = [day("2026-10-08"), day("2026-10-09", { logged: false }), day("2026-10-10")];
    expect(computeStreaks(days, "2026-10-10").logging).toEqual({ current: 1, longest: 1, todayCounts: true });
  });

  it("valida la fecha de hoy", () => {
    expect(() => computeStreaks([], "hoy")).toThrow(NutritionInputError);
  });
});

describe("weeklyAdherence", () => {
  const days = [
    day("2026-10-12"),
    day("2026-10-13", { energyKcal: 2600 }),
    day("2026-10-14", { logged: false }),
    day("2026-10-15"),
  ];

  it("cuenta solo los días ya transcurridos de la semana (lunes a domingo)", () => {
    const w = weeklyAdherence(days, "2026-10-14", "2026-10-14");
    expect(w.weekStart).toBe("2026-10-12");
    expect(w.weekEnd).toBe("2026-10-18");
    expect(w.daysElapsed).toBe(3);
    expect(w.daysLogged).toBe(2);
    expect(w.loggingPct).toBe(66.7);
    expect(w.daysKcalOnTarget).toBe(1);
    expect(w.daysProteinOnTarget).toBe(2);
    expect(w.daysGoalsMet).toBe(1);
    expect(w.goalsPct).toBe(33.3);
    expect(w.kcalPct).toBe(33.3);
    expect(w.proteinPct).toBe(66.7);
    expect(w.days.map((d) => d.date)).toEqual(["2026-10-12", "2026-10-13", "2026-10-14"]);
  });

  it("semana pasada completa", () => {
    const w = weeklyAdherence(days, "2026-10-12", "2026-10-30");
    expect(w.daysElapsed).toBe(7);
    expect(w.daysLogged).toBe(3);
  });

  it("semana futura: 0 días y 0 %", () => {
    const w = weeklyAdherence(days, "2026-11-02", "2026-10-14");
    expect(w.daysElapsed).toBe(0);
    expect(w.loggingPct).toBe(0);
  });

  it("valida fechas", () => {
    expect(() => weeklyAdherence(days, "x", "2026-10-14")).toThrow(NutritionInputError);
    expect(() => weeklyAdherence(days, "2026-10-14", "x")).toThrow(NutritionInputError);
  });
});
