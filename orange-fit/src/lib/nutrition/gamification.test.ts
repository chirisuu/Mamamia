import { describe, expect, it } from "vitest";
import { NutritionInputError } from "./errors";
import type { ChallengeDefinition, DailyHabitRecord } from "./gamification";
import {
  aggregateHabitDays,
  challengeDayValue,
  earliestChallengeCompletion,
  evaluateBadge,
  evaluateBadges,
  evaluateChallenge,
  parseBadgeCriteria,
} from "./gamification";

describe("parseBadgeCriteria (formato de supabase/seed)", () => {
  it.each([
    [{ type: "meal_log_items_total", min: 1 }],
    [{ type: "logging_days", days: 7 }],
    [{ type: "water_goal_days", days: 5 }],
    [{ type: "protein_goal_days", days: 5 }],
    [{ type: "vegetable_days", days: 5 }],
    [{ type: "recipes_created", min: 1 }],
    [{ type: "weight_logs_total", min: 1 }],
    [{ type: "log_source_used", source: "barcode", min: 1 }],
    [{ type: "meal_plans_created", min: 1 }],
    [{ type: "challenges_completed", min: 1 }],
  ])("acepta %j", (raw) => {
    expect(parseBadgeCriteria(raw)).toEqual(raw);
  });

  it.each([
    [null],
    ["logging_days"],
    [[]],
    [{}],
    [{ type: 3 }],
    [{ type: "unknown", min: 1 }],
    [{ type: "logging_days", min: 7 }],
    [{ type: "meal_log_items_total", min: 0 }],
    [{ type: "meal_log_items_total", min: 1.5 }],
    [{ type: "log_source_used", source: "", min: 1 }],
    [{ type: "log_source_used", source: "barcode" }],
  ])("rechaza %j", (raw) => {
    expect(parseBadgeCriteria(raw)).toBeNull();
  });
});

describe("evaluateBadge", () => {
  it("progreso hacia días distintos (no consecutivos)", () => {
    expect(evaluateBadge({ type: "logging_days", days: 7 }, { loggingDays: 5 })).toEqual({
      supported: true,
      earned: false,
      current: 5,
      target: 7,
      progress: 0.714,
    });
    expect(evaluateBadge({ type: "logging_days", days: 7 }, { loggingDays: 9 })).toMatchObject({ earned: true, progress: 1 });
  });

  it("conteos y origen de registro", () => {
    expect(evaluateBadge({ type: "meal_log_items_total", min: 1 }, { mealLogItemsTotal: 1 }).earned).toBe(true);
    expect(evaluateBadge({ type: "log_source_used", source: "barcode", min: 1 }, { logSourceCounts: { barcode: 2 } }).earned).toBe(true);
    expect(evaluateBadge({ type: "log_source_used", source: "barcode", min: 1 }, {}).earned).toBe(false);
    expect(evaluateBadge({ type: "challenges_completed", min: 1 }, { challengesCompleted: Number.NaN }).current).toBe(0);
  });

  it("criterio desconocido: no se otorga", () => {
    expect(evaluateBadge({ type: "streak_30" }, { loggingDays: 100 })).toEqual({
      supported: false,
      earned: false,
      current: 0,
      target: 0,
      progress: 0,
    });
  });
});

describe("evaluateBadges", () => {
  const badges = [
    { code: "first_log", criteria: { type: "meal_log_items_total", min: 1 } },
    { code: "logging_days_7", criteria: { type: "logging_days", days: 7 } },
    { code: "hydration_days_5", criteria: { type: "water_goal_days", days: 5 } },
    { code: "raro", criteria: { type: "otro" } },
  ];

  it("devuelve las recién ganadas y nunca quita una ya ganada", () => {
    const r = evaluateBadges(badges, { mealLogItemsTotal: 3, loggingDays: 7, waterGoalDays: 1 }, ["first_log", "hydration_days_5"]);
    expect(r.newlyEarned).toEqual(["logging_days_7"]);
    const hydration = r.results.find((x) => x.code === "hydration_days_5")!;
    expect(hydration).toMatchObject({ earned: true, progress: 1, alreadyEarned: true });
    expect(r.results.find((x) => x.code === "raro")!.supported).toBe(false);
    expect(evaluateBadges(badges, {}).newlyEarned).toEqual([]);
  });
});

describe("aggregateHabitDays", () => {
  it("cuenta días distintos por hábito; proteína con ≥ 90 % de la meta", () => {
    const days: DailyHabitRecord[] = [
      { date: "2026-10-01", itemsLogged: 3, waterMl: 2000, waterTargetMl: 2000, proteinG: 108, proteinTargetG: 120, vegetableServings: 2 },
      { date: "2026-10-01", itemsLogged: 1 },
      { date: "2026-10-02", itemsLogged: 0, waterMl: 1500, waterTargetMl: 2000, proteinG: 100, proteinTargetG: 120 },
      { date: "2026-10-03", itemsLogged: 2, waterMl: 3000, waterTargetMl: null, proteinG: 200, proteinTargetG: null },
    ];
    expect(aggregateHabitDays(days)).toEqual({ loggingDays: 2, waterGoalDays: 1, proteinGoalDays: 1, vegetableDays: 1 });
    expect(aggregateHabitDays([])).toEqual({ loggingDays: 0, waterGoalDays: 0, proteinGoalDays: 0, vegetableDays: 0 });
  });
});

describe("retos", () => {
  const water: ChallengeDefinition = { kind: "water", targetValue: 2000, durationDays: 3 };

  it("challengeDayValue según el tipo", () => {
    const d: DailyHabitRecord = {
      date: "2026-10-01",
      waterMl: 1800,
      itemsLogged: 2,
      proteinG: 90,
      proteinTargetG: 120,
      vegetableServings: 3,
      activityMinutes: 40,
    };
    expect(challengeDayValue("water", d)).toBe(1800);
    expect(challengeDayValue("logging", d)).toBe(2);
    expect(challengeDayValue("protein", d)).toBe(75);
    expect(challengeDayValue("vegetables", d)).toBe(3);
    expect(challengeDayValue("activity", d)).toBe(40);
    expect(challengeDayValue("protein", { date: "2026-10-01", proteinG: 90 })).toBe(0);
  });

  it("suma días que cumplen desde el inicio; saltarse un día no reinicia", () => {
    const days: DailyHabitRecord[] = [
      { date: "2026-09-30", waterMl: 3000 }, // antes de empezar: no cuenta
      { date: "2026-10-01", waterMl: 2000 },
      { date: "2026-10-02", waterMl: 500 }, // no se logró: no pasa nada
      { date: "2026-10-03", waterMl: 2500 },
      { date: "2026-10-03", waterMl: 2500 }, // mismo día repetido: cuenta una vez
    ];
    const p = evaluateChallenge(water, { startedOn: "2026-10-01", today: "2026-10-03", days });
    expect(p).toMatchObject({ qualifyingDays: 2, requiredDays: 3, remainingDays: 1, progress: 0.667, completed: false, completedOn: null });
    expect(p.message).toContain("no pasa nada");
    expect(p.message).not.toMatch(/fall|perd/i);
  });

  it("se completa el día en que se suma el último día necesario", () => {
    const days: DailyHabitRecord[] = ["2026-10-01", "2026-10-03", "2026-10-05", "2026-10-06"].map((date) => ({ date, waterMl: 2100 }));
    const p = evaluateChallenge(water, { startedOn: "2026-10-01", today: "2026-10-10", days });
    expect(p).toMatchObject({ completed: true, completedOn: "2026-10-05", qualifyingDays: 3, progress: 1, remainingDays: 0 });
    expect(p.message).toBe("¡Reto completado! Sumaste 3 días.");
    expect(
      evaluateChallenge({ ...water, durationDays: 1 }, { startedOn: "2026-10-01", today: "2026-10-10", days }).message,
    ).toBe("¡Reto completado! Sumaste 1 día.");
  });

  it("ignora días futuros y da un mensaje de inicio amable", () => {
    const p = evaluateChallenge(water, { startedOn: "2026-10-01", today: "2026-10-01", days: [{ date: "2026-10-02", waterMl: 5000 }] });
    expect(p.qualifyingDays).toBe(0);
    expect(p.message).toContain("Cada día que lo logres suma");
  });

  it("valida el reto y las fechas", () => {
    expect(() => evaluateChallenge(water, { startedOn: "x", today: "2026-10-01", days: [] })).toThrow(NutritionInputError);
    expect(() => evaluateChallenge(water, { startedOn: "2026-10-01", today: "y", days: [] })).toThrow(NutritionInputError);
    expect(() => evaluateChallenge({ ...water, targetValue: 0 }, { startedOn: "2026-10-01", today: "2026-10-01", days: [] })).toThrow(
      NutritionInputError,
    );
    expect(() => evaluateChallenge({ ...water, durationDays: 1.5 }, { startedOn: "2026-10-01", today: "2026-10-01", days: [] })).toThrow(
      NutritionInputError,
    );
  });

  it("earliestChallengeCompletion", () => {
    const p = evaluateChallenge(water, { startedOn: "2026-10-01", today: "2026-10-03", days: [{ date: "2026-10-01", waterMl: 2000 }] });
    expect(earliestChallengeCompletion(p, "2026-10-03", false)).toBe("2026-10-04");
    expect(earliestChallengeCompletion(p, "2026-10-03", true)).toBe("2026-10-05");
    const done = evaluateChallenge({ ...water, durationDays: 1 }, { startedOn: "2026-10-01", today: "2026-10-03", days: [{ date: "2026-10-01", waterMl: 2000 }] });
    expect(earliestChallengeCompletion(done, "2026-10-03", true)).toBe("2026-10-01");
  });
});
