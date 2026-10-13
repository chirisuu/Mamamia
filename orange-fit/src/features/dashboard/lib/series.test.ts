import { describe, expect, it } from "vitest";
import { computeStreaks } from "@/lib/nutrition";
import { buildDayIntakes, buildWeeklySeries, earliestTarget, targetForDate } from "./series";

const targets = [
  { effective_from: "2026-10-01", created_at: "2026-10-01T10:00:00Z", energy_kcal: 2000, protein_g: 120 },
  { effective_from: "2026-10-10", created_at: "2026-10-10T10:00:00Z", energy_kcal: 1800, protein_g: 110 },
  { effective_from: "2026-10-10", created_at: "2026-10-10T12:00:00Z", energy_kcal: 1900, protein_g: 115 },
];

describe("targetForDate", () => {
  it("toma la vigente con desempate por creación", () => {
    expect(targetForDate(targets, "2026-10-05")?.energy_kcal).toBe(2000);
    expect(targetForDate(targets, "2026-10-12")?.energy_kcal).toBe(1900);
    expect(targetForDate(targets, "2026-09-30")).toBeNull();
    expect(earliestTarget(targets)?.energy_kcal).toBe(2000);
  });
});

describe("buildWeeklySeries", () => {
  it("7 días que terminan hoy; sin registro es null, no 0", () => {
    const s = buildWeeklySeries(
      "2026-10-13",
      [
        { local_date: "2026-10-13", energy_kcal: 1500.6, protein_g: 90, items_count: 4 },
        { local_date: "2026-10-09", energy_kcal: 2100, protein_g: 100, items_count: 6 },
      ],
      targets,
    );
    expect(s.map((p) => p.date)).toEqual([
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
    ]);
    expect(s[6]).toMatchObject({ consumed: 1501, target: 1900 });
    expect(s[2]).toMatchObject({ consumed: 2100, target: 2000 });
    expect(s[0]!.consumed).toBeNull();
    expect(s[6]!.label).toMatch(/^mar 13$/);
  });
});

describe("buildDayIntakes + rachas", () => {
  it("la racha de registro no se rompe por comer de más", () => {
    const totals = [
      { local_date: "2026-10-11", energy_kcal: 3000, protein_g: 50, items_count: 5 },
      { local_date: "2026-10-12", energy_kcal: 1900, protein_g: 115, items_count: 5 },
      { local_date: "2026-10-13", energy_kcal: 1850, protein_g: 120, items_count: 3 },
    ];
    const streaks = computeStreaks(buildDayIntakes(totals, targets), "2026-10-13");
    expect(streaks.logging.current).toBe(3);
    expect(streaks.goals.current).toBe(2);
  });

  it("sin metas no hay historial", () => {
    expect(buildDayIntakes([{ local_date: "2026-10-13", energy_kcal: 100, protein_g: 1, items_count: 1 }], [])).toEqual([]);
  });

  it("días antes de la primera meta usan la primera", () => {
    const d = buildDayIntakes([{ local_date: "2026-09-20", energy_kcal: 100, protein_g: 1, items_count: 1 }], targets);
    expect(d[0]?.targetKcal).toBe(2000);
  });
});
