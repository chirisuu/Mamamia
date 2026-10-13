import { describe, expect, it } from "vitest";
import {
  GOAL_LABELS,
  isActivityLevel,
  isDietPattern,
  isGoal,
  isHealthFlag,
  isMealType,
  isSex,
  MEAL_TYPE_LABELS,
  MEAL_TYPES,
  GOALS,
  parseHealthFlags,
} from "./types";

describe("guardas de tipos", () => {
  it("reconocen valores válidos y rechazan otros", () => {
    expect(isSex("female")).toBe(true);
    expect(isSex("other")).toBe(false);
    expect(isActivityLevel("very_active")).toBe(true);
    expect(isActivityLevel("extreme")).toBe(false);
    expect(isGoal("recomposition")).toBe(true);
    expect(isGoal("bulk")).toBe(false);
    expect(isHealthFlag("kidney_disease")).toBe(true);
    expect(isHealthFlag("asthma")).toBe(false);
    expect(isMealType("snack")).toBe(true);
    expect(isMealType("brunch")).toBe(false);
    expect(isDietPattern("pescatarian")).toBe(true);
    expect(isDietPattern("paleo")).toBe(false);
  });

  it("todas las comidas y objetivos tienen etiqueta en español", () => {
    for (const m of MEAL_TYPES) expect(MEAL_TYPE_LABELS[m]).toBeTruthy();
    for (const g of GOALS) expect(GOAL_LABELS[g]).toBeTruthy();
  });
});

describe("parseHealthFlags", () => {
  it("descarta valores desconocidos y duplicados", () => {
    expect(parseHealthFlags(["pregnant", "foo", "pregnant", "kidney_disease"])).toEqual(["pregnant", "kidney_disease"]);
  });

  it("acepta null o undefined", () => {
    expect(parseHealthFlags(null)).toEqual([]);
    expect(parseHealthFlags(undefined)).toEqual([]);
  });
});
