/**
 * Importa alimentos de USDA FoodData Central al catálogo público (source 'usda', verificados por
 * venir de la fuente oficial, licencia de dominio público). Upsert por source_ref 'fdc:{fdcId}'.
 *
 *   npx tsx scripts/import-usda.ts --query "quinoa" --limit 20
 *   npx tsx scripts/import-usda.ts --fdc-ids 168917,168874
 *   npx tsx scripts/import-usda.ts --query "quinoa" --dry-run     (solo muestra lo que importaría)
 *
 * Variables (de .env.local o del entorno): FDC_API_KEY, NEXT_PUBLIC_SUPABASE_URL y
 * SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY). Sin FDC_API_KEY sale con error
 * USDA_NOT_CONFIGURED: no se inventan valores.
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/db/database.types";
import { getFdcFoods, importUsdaFoodsWithKey, mapUsdaFood, searchFdc, UsdaError } from "../src/lib/foods/usda-core";

function loadEnvFile(file: string): void {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

function usage(message?: string): never {
  if (message) console.error(`Error: ${message}\n`);
  console.error('Uso: npx tsx scripts/import-usda.ts (--query "texto" [--limit 20] | --fdc-ids 1,2,3) [--dry-run]');
  process.exit(2);
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFile(path.resolve(process.cwd(), ".env"));

  const { values } = parseArgs({
    options: {
      query: { type: "string", short: "q" },
      limit: { type: "string", short: "l" },
      "fdc-ids": { type: "string" },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: true,
  });
  if (values.help) usage();

  const query = values.query?.trim();
  const fdcIds = values["fdc-ids"]
    ? values["fdc-ids"].split(",").map((s) => Number(s.trim()))
    : undefined;
  if (fdcIds && fdcIds.some((n) => !Number.isInteger(n) || n <= 0)) usage("--fdc-ids debe ser una lista de números separados por comas.");
  if (!query && !fdcIds?.length) usage("indica --query o --fdc-ids.");
  const limit = values.limit ? Number(values.limit) : undefined;
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 200)) usage("--limit debe ser un entero entre 1 y 200.");

  const apiKey = process.env.FDC_API_KEY?.trim();

  if (values["dry-run"]) {
    if (!apiKey) throw new UsdaError("USDA_NOT_CONFIGURED", "Falta FDC_API_KEY: la importación desde USDA está pendiente de configurar.");
    const ids = fdcIds?.length ? fdcIds : (await searchFdc(query!, limit ?? 20, { apiKey })).map((f) => f.fdcId);
    const foods = await getFdcFoods(ids.slice(0, limit ?? ids.length), { apiKey });
    for (const f of foods) {
      const r = mapUsdaFood(f);
      if (r.ok) {
        const n = r.food.per100g;
        console.log(`fdc:${r.food.fdcId}\t${r.food.name}\t${n.energyKcal} kcal · P ${n.proteinG} · C ${n.carbsG} · G ${n.fatG} (por 100 g)`);
      } else {
        console.log(`fdc:${r.fdcId}\tOMITIDO: ${r.reason}`);
      }
    }
    console.log(`\n(simulacro: no se escribió nada en la base)`);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) {
    console.error("Error: faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para escribir en la base.");
    process.exit(1);
  }
  const admin = createClient<Database>(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const result = await importUsdaFoodsWithKey(admin, { query, fdcIds, limit }, { apiKey });
  console.log(`Insertados: ${result.inserted} · Actualizados: ${result.updated} · Omitidos: ${result.skipped} · Errores: ${result.errors.length}`);
  for (const r of result.skippedReasons) console.log(`  omitido  ${r}`);
  for (const e of result.errors) console.error(`  error    ${e}`);
  if (result.errors.length) process.exitCode = 1;
}

main().catch((error: unknown) => {
  if (error instanceof UsdaError) {
    console.error(`Error ${error.code}: ${error.message}`);
  } else {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }
  process.exit(1);
});
