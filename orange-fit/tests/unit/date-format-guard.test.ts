import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Las fechas se pintan en servidor (UTC) y en el navegador (zona del usuario). Sin timeZone
 * explícita salen días distintos cerca de medianoche: fecha equivocada e error de hidratación
 * (pasó en /app/perfil/privacidad). Usa formatInstantDate / formatShortDate de src/lib/format.ts.
 */
const ROOT = path.resolve(__dirname, "../../src");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe("fechas con zona horaria explícita", () => {
  it("todo toLocaleDateString / toLocaleTimeString lleva timeZone", () => {
    const problems: string[] = [];
    for (const file of walk(ROOT)) {
      const source = fs.readFileSync(file, "utf8");
      for (const m of source.matchAll(/\.toLocale(?:Date|Time)String\(([^)]*(?:\([^)]*\)[^)]*)*)\)/g)) {
        if (!/timeZone/.test(m[1])) {
          const line = source.slice(0, m.index).split("\n").length;
          problems.push(`${path.relative(ROOT, file)}:${line} ${m[0].slice(0, 80)}`);
        }
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
});
