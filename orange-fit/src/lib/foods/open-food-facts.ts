/**
 * Open Food Facts (API v2): consulta de un producto por código de barras y mapeo a nuestro
 * formato por 100 g. Sin secretos ni I/O propio: `fetch` se inyecta (las pruebas usan uno simulado).
 *
 * OFF es colaborativa: lo que se importa entra como `unverified`, con su licencia ODbL y la URL del
 * producto para la atribución. Nunca se completa un dato que OFF no tenga.
 */
import { roundDecimals } from "@/lib/nutrition";
import { normalizeText } from "./dedup";
import { parseGramsFromLabel } from "./units-portions";

export const OFF_FIELDS = "code,product_name,product_name_es,brands,nutriments,serving_size,quantity";
export const OFF_LICENSE = "ODbL — © colaboradores de Open Food Facts";
export const OFF_TIMEOUT_MS = 6000;

export const offApiUrl = (code: string) =>
  `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}?fields=${OFF_FIELDS}`;
export const offProductUrl = (code: string) => `https://world.openfoodfacts.org/product/${encodeURIComponent(code)}`;

/** User-Agent identificable que pide OFF: nombre/versión y un contacto (correo de soporte o sitio). */
export function offUserAgent(contact: string | null | undefined): string {
  const c = (contact ?? "").replace(/[\r\n()]/g, " ").trim();
  return `OrangeFit/0.1 (${c || "sin contacto configurado"})`;
}

export type OffNutriments = Record<string, unknown>;

export type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_es?: string;
  brands?: string;
  nutriments?: OffNutriments;
  serving_size?: string;
  quantity?: string;
};

export type OffErrorCode = "OFF_TIMEOUT" | "OFF_UNAVAILABLE" | "OFF_RATE_LIMITED" | "OFF_BAD_RESPONSE";

export class OffError extends Error {
  constructor(
    public readonly code: OffErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "OffError";
  }
}

export type OffFetchResult = { status: "found"; product: OffProduct } | { status: "not_found" };

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const isFoundStatus = (status: unknown) =>
  status === 1 || status === "1" || status === "success" || status === "success_with_warnings";

/**
 * Consulta un producto. Devuelve `not_found` si OFF responde que no existe (404 o status 0).
 * Lanza `OffError` si OFF no responde, tarda más de `timeoutMs`, limita la tasa o responde algo
 * que no es JSON: el llamador debe mostrar ese error real, no inventar un producto.
 */
export async function fetchOffProduct(
  code: string,
  opts: { userAgent: string; fetchImpl?: FetchLike; timeoutMs?: number; signal?: AbortSignal },
): Promise<OffFetchResult> {
  const fetchImpl: FetchLike = opts.fetchImpl ?? ((input, init) => fetch(input, init));
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? OFF_TIMEOUT_MS);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;

  let res: Response;
  try {
    res = await fetchImpl(offApiUrl(code), {
      method: "GET",
      headers: { "User-Agent": opts.userAgent, Accept: "application/json" },
      signal,
      cache: "no-store",
    });
  } catch (error) {
    if (timeout.aborted || (error instanceof Error && error.name === "TimeoutError")) {
      throw new OffError("OFF_TIMEOUT", "Open Food Facts no respondió a tiempo.");
    }
    throw new OffError("OFF_UNAVAILABLE", "No pudimos conectarnos con Open Food Facts.");
  }

  if (res.status === 429) throw new OffError("OFF_RATE_LIMITED", "Open Food Facts está limitando las consultas.", 429);
  if (res.status === 404) return { status: "not_found" };
  if (!res.ok) throw new OffError("OFF_UNAVAILABLE", `Open Food Facts respondió con un error (${res.status}).`, res.status);

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new OffError("OFF_BAD_RESPONSE", "Open Food Facts respondió con datos ilegibles.", res.status);
  }
  if (!body || typeof body !== "object") throw new OffError("OFF_BAD_RESPONSE", "Open Food Facts respondió con datos ilegibles.");
  const { status, product } = body as { status?: unknown; product?: unknown };
  if (!isFoundStatus(status) || !product || typeof product !== "object") return { status: "not_found" };
  return { status: "found", product: product as OffProduct };
}

/** Número de un campo de OFF (a veces vienen como texto, con coma decimal). Negativos o basura → null. */
export function offNumber(value: unknown): number | null {
  let n: number;
  if (typeof value === "number") n = value;
  else if (typeof value === "string" && value.trim() !== "") n = Number(value.trim().replace(",", "."));
  else return null;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** kJ → kcal (1 kcal = 4.184 kJ). */
export const kjToKcal = (kj: number) => roundDecimals(kj / 4.184, 2);

const titleCase = (s: string) => s.replace(/(^|[\s\-/'(])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());

/**
 * Marca legible a partir de `brands` de OFF ("gloria,Gloria S.A." → "Gloria"): toma la primera,
 * limpia espacios y, si viene toda en minúsculas o mayúsculas, la pasa a tipo título.
 */
export function normalizeBrandName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const first = raw
    .split(",")
    .map((b) => b.replace(/^["'\s]+|["'\s]+$/g, "").replace(/\s+/g, " ").trim())
    .find((b) => b.length > 0);
  if (!first) return null;
  let name = first;
  const letters = name.replace(/[^\p{L}]/gu, "");
  if (letters.length > 0 && (name === name.toLowerCase() || (name === name.toUpperCase() && letters.length > 3))) {
    name = titleCase(name.toLowerCase());
  }
  return name.slice(0, 120);
}

export type OffPer100g = {
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarG: number | null;
  saturatedFatG: number | null;
  sodiumMg: number | null;
};

export type OffMappedFood = {
  barcode: string;
  name: string;
  brandName: string | null;
  per100g: OffPer100g;
  energyFromKj: boolean;
  sodiumFromSalt: boolean;
  /** Porción declarada en la etiqueta, en gramos (null si no hay o solo está en ml). */
  servingGrams: number | null;
  /** Contenido del envase en gramos (null si no hay, está en ml o es muy grande). */
  packageGrams: number | null;
  quantityText: string | null;
  /** Notas de datos en español (conversiones o datos descartados). */
  notes: string[];
  sourceRef: string;
  sourceUrl: string;
  license: string;
};

export type OffMapFailure = {
  ok: false;
  reason: "missing_name" | "missing_nutrients" | "out_of_range" | "inconsistent";
  missing: string[];
  name: string | null;
  brandName: string | null;
};

export type OffMapResult = { ok: true; food: OffMappedFood } | OffMapFailure;

const cleanName = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, 200);

/**
 * Mapea un producto de OFF a valores por 100 g. Exige nombre, energía, proteína, carbohidratos y
 * grasa por 100 g (si solo hay kJ se convierte y se anota). Los opcionales que falten quedan en null.
 */
export function mapOffProduct(product: OffProduct, requestedCode: string): OffMapResult {
  const name = cleanName(product.product_name_es) || cleanName(product.product_name);
  const brandName = normalizeBrandName(product.brands);
  const code = typeof product.code === "string" && /^\d{6,14}$/.test(product.code) ? product.code : requestedCode;
  const n = product.nutriments ?? {};
  const fail = (reason: OffMapFailure["reason"], missing: string[] = []): OffMapFailure => ({
    ok: false,
    reason,
    missing,
    name: name || null,
    brandName,
  });

  if (!name) return fail("missing_name", ["nombre"]);

  const notes: string[] = [];
  let energyKcal = offNumber(n["energy-kcal_100g"]);
  let energyFromKj = false;
  if (energyKcal == null) {
    // energy_100g de OFF siempre está en kJ.
    const kj = offNumber(n["energy-kj_100g"]) ?? offNumber(n["energy_100g"]);
    if (kj != null) {
      energyKcal = kjToKcal(kj);
      energyFromKj = true;
      notes.push("Energía calculada desde kJ (÷ 4.184).");
    }
  }
  const proteinG = offNumber(n["proteins_100g"]);
  const carbsG = offNumber(n["carbohydrates_100g"]);
  const fatG = offNumber(n["fat_100g"]);

  const missing = [
    energyKcal == null ? "energía" : null,
    proteinG == null ? "proteína" : null,
    carbsG == null ? "carbohidratos" : null,
    fatG == null ? "grasa" : null,
  ].filter((v): v is string => v !== null);
  if (energyKcal == null || proteinG == null || carbsG == null || fatG == null) return fail("missing_nutrients", missing);

  // Rangos de la tabla foods (por 100 g): energía ≤ 900 kcal, macros ≤ 100 g y suma física ≤ 100 g.
  if (energyKcal > 900 || proteinG > 100 || carbsG > 100 || fatG > 100 || proteinG + carbsG + fatG > 101) {
    return fail("out_of_range");
  }
  // Energía muy por debajo de lo que aportan los macros: suele ser kJ/kcal o porción/100 g mezclados.
  const macroKcal = 4 * proteinG + 4 * carbsG + 9 * fatG;
  if (macroKcal >= 40 && energyKcal < macroKcal * 0.5) return fail("inconsistent");

  let fiberG = offNumber(n["fiber_100g"]);
  if (fiberG != null && fiberG > 100) fiberG = null;
  let sugarG = offNumber(n["sugars_100g"]);
  if (sugarG != null && sugarG > carbsG + 0.5) {
    sugarG = null;
    notes.push("Se descartó el azúcar: superaba a los carbohidratos.");
  }
  let saturatedFatG = offNumber(n["saturated-fat_100g"]);
  if (saturatedFatG != null && saturatedFatG > fatG + 0.5) {
    saturatedFatG = null;
    notes.push("Se descartó la grasa saturada: superaba a la grasa total.");
  }

  let sodiumMg: number | null = null;
  let sodiumFromSalt = false;
  const sodiumG = offNumber(n["sodium_100g"]);
  if (sodiumG != null) sodiumMg = roundDecimals(sodiumG * 1000, 2);
  else {
    const saltG = offNumber(n["salt_100g"]);
    if (saltG != null) {
      sodiumMg = roundDecimals((saltG / 2.5) * 1000, 2);
      sodiumFromSalt = true;
      notes.push("Sodio estimado desde la sal (÷ 2.5).");
    }
  }
  if (sodiumMg != null && sodiumMg > 100_000) sodiumMg = null;

  const quantityText = cleanName(product.quantity) || null;
  const servingGrams = parseGramsFromLabel(product.serving_size);
  const packageGrams = (() => {
    // "6 x 36 g" es un multipack: el peso de cada unidad no es el del envase.
    if (/\d\s*[x×]\s*\d/i.test(product.quantity ?? "")) return null;
    const g = parseGramsFromLabel(product.quantity);
    return g != null && g <= 2000 ? g : null;
  })();

  return {
    ok: true,
    food: {
      barcode: code,
      name,
      brandName,
      per100g: {
        energyKcal: roundDecimals(energyKcal, 2),
        proteinG: roundDecimals(proteinG, 2),
        carbsG: roundDecimals(carbsG, 2),
        fatG: roundDecimals(fatG, 2),
        fiberG: fiberG == null ? null : roundDecimals(fiberG, 2),
        sugarG: sugarG == null ? null : roundDecimals(sugarG, 2),
        saturatedFatG: saturatedFatG == null ? null : roundDecimals(saturatedFatG, 2),
        sodiumMg,
      },
      energyFromKj,
      sodiumFromSalt,
      servingGrams,
      packageGrams,
      quantityText,
      notes,
      sourceRef: `off:${code}`,
      sourceUrl: offProductUrl(code),
      license: OFF_LICENSE,
    },
  };
}

/** Descripción que se guarda con el alimento importado (nota de procedencia visible en la app). */
export function offDescription(food: OffMappedFood): string {
  const parts = ["Datos de Open Food Facts (licencia ODbL), sin verificar contra la etiqueta."];
  if (food.quantityText) parts.push(`Contenido del envase: ${food.quantityText}.`);
  parts.push(...food.notes);
  return parts.join(" ").slice(0, 2000);
}

/** Clave comparable de una marca (igual que `brands.name_normalized`). */
export const brandKey = (name: string) => normalizeText(name);
