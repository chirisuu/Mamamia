import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Un archivo de servidor (sin "use client") no puede LLAMAR una función exportada por un módulo
 * "use client": Next la convierte en una referencia de cliente y lanza al renderizar en el
 * servidor. Ni tsc ni el build lo detectan (pasó con initials() en /app/perfil). Los componentes
 * (en mayúscula) sí se pueden renderizar; lo que se busca son llamadas a funciones en minúscula.
 */
const ROOT = path.resolve(__dirname, "../../src");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const isClient = (source: string) => /^\s*["']use client["'];?/.test(source);

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? path.join(ROOT, spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(from), spec) : null;
  if (!base) return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

describe("frontera servidor/cliente", () => {
  it("ningún archivo de servidor llama funciones de un módulo 'use client'", () => {
    const files = walk(ROOT);
    const sources = new Map(files.map((f) => [f, fs.readFileSync(f, "utf8")]));
    const problems: string[] = [];
    for (const [file, source] of sources) {
      if (isClient(source)) continue;
      for (const match of source.matchAll(/import\s+(?!type\b)\{([^}]+)\}\s+from\s+["']([^"']+)["']/g)) {
        const target = resolveImport(file, match[2]);
        if (!target || !isClient(sources.get(target) ?? fs.readFileSync(target, "utf8"))) continue;
        const names = match[1]
          .split(",")
          .map((part) => part.trim())
          .filter((part) => part && !part.startsWith("type "))
          .map((part) => (part.split(/\s+as\s+/)[1] ?? part).trim());
        for (const name of names) {
          if (!/^[a-z]/.test(name)) continue; // componentes y constantes en mayúscula se pasan, no se llaman
          if (new RegExp(`(?<![\\w.])${name}\\s*\\(`).test(source.replace(match[0], ""))) {
            problems.push(`${path.relative(ROOT, file)} llama ${name}() de ${match[2]} ("use client")`);
          }
        }
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });

  it("ningún archivo de servidor pasa funciones como prop a un componente 'use client'", () => {
    // Una función no se puede serializar hacia el cliente (pasó con format={(n) => …} en /admin/ia).
    // Se permiten las server actions en línea, que llevan "use server".
    const files = walk(ROOT);
    const sources = new Map(files.map((f) => [f, fs.readFileSync(f, "utf8")]));
    const problems: string[] = [];
    for (const [file, source] of sources) {
      if (isClient(source) || !file.endsWith(".tsx")) continue;
      const clientComponents: string[] = [];
      for (const match of source.matchAll(/import\s+(?!type\b)\{([^}]+)\}\s+from\s+["']([^"']+)["']/g)) {
        const target = resolveImport(file, match[2]);
        if (!target || !isClient(sources.get(target) ?? fs.readFileSync(target, "utf8"))) continue;
        for (const part of match[1].split(",")) {
          const name = (part.trim().split(/\s+as\s+/)[1] ?? part.trim()).trim();
          if (/^[A-Z]/.test(name)) clientComponents.push(name);
        }
      }
      for (const name of clientComponents) {
        const tag = new RegExp(`<${name}\\b[^<]*?(\\w+)=\\{\\s*(?:async\\s*)?(?:\\([^)]*\\)|\\w+)\\s*=>([\\s\\S]{0,80})`, "g");
        for (const m of source.matchAll(tag)) {
          if (/["']use server["']/.test(m[2])) continue;
          problems.push(`${path.relative(ROOT, file)} pasa ${m[1]}={() => …} a <${name}> ("use client")`);
        }
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
});
