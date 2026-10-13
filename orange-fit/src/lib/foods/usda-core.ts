/**
 * USDA FoodData Central: cliente, mapeo a nuestro formato por 100 g e importación al catálogo.
 * Este archivo NO lee variables de entorno ni importa "server-only" para que lo pueda usar el CLI
 * (`scripts/import-usda.ts`); la app usa `./usda.ts`, que toma la clave de `serverEnv()`.
 *
 * Valores: los nutrientes de FDC vienen por 100 g (también en alimentos de marca). Se mapean por
 * id de nutriente (1008 energía, 1003 proteína…) con el número antiguo (208, 203…) como respaldo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert, TablesUpdate } from "@/lib/db/database.types";
import { roundDecimals } from "@/lib/nutrition";
import { hasValidGtinCheckDigit } from "./barcode";

export const FDC_BASE_URL = "https://api.nal.usda.gov/fdc/v1";
export const USDA_LICENSE = "Dominio público (USDA)";
export const USDA_TIMEOUT_MS = 15_000;
/** Tipos de datos de FDC para alimentos genéricos (los de marca solo entran por fdcIds). */
export const USDA_GENERIC_DATA_TYPES = ["Foundation", "SR Legacy"] as const;

export const fdcFoodUrl = (fdcId: number) => `https://fdc.nal.usda.gov/food-details/${fdcId}/nutrients`;
export const fdcSourceRef = (fdcId: number) => `fdc:${fdcId}`;

export type UsdaErrorCode = "USDA_NOT_CONFIGURED" | "USDA_INVALID_INPUT" | "USDA_HTTP_ERROR" | "USDA_TIMEOUT" | "USDA_BAD_RESPONSE";

export class UsdaError extends Error {
  constructor(
    public readonly code: UsdaErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "UsdaError";
  }
}

/* -------------------------------------------------------------------------- */
/* Nutrientes                                                                   */
/* -------------------------------------------------------------------------- */

type NutrientRef = { id: number; number: string };

/** Núcleo (columnas de `foods`): ids de FDC en orden de preferencia. */
export const USDA_CORE_NUTRIENTS = {
  energyKcal: [
    { id: 1008, number: "208" },
    { id: 2047, number: "957" }, // Energía (Atwater, factores generales): Foundation a veces no trae 1008.
    { id: 2048, number: "958" }, // Energía (Atwater, factores específicos).
  ],
  proteinG: [{ id: 1003, number: "203" }],
  carbsG: [
    { id: 1005, number: "205" },
    { id: 1050, number: "205.2" }, // Carbohidratos por suma.
  ],
  fatG: [
    { id: 1004, number: "204" },
    { id: 1085, number: "298" }, // Grasa total (NLEA).
  ],
  fiberG: [{ id: 1079, number: "291" }],
  sugarG: [
    { id: 2000, number: "269" },
    { id: 1063, number: "269.3" },
  ],
  saturatedFatG: [{ id: 1258, number: "606" }],
  sodiumMg: [{ id: 1093, number: "307" }],
} satisfies Record<string, NutrientRef[]>;

const ENERGY_KJ: NutrientRef = { id: 1062, number: "268" };

/** Micronutrientes por código de `nutrient_definitions` → nutriente de FDC. */
export const USDA_MICRONUTRIENTS: Record<string, NutrientRef> = {
  vitamin_a_rae: { id: 1106, number: "320" },
  vitamin_c: { id: 1162, number: "401" },
  vitamin_d: { id: 1114, number: "328" },
  vitamin_e: { id: 1109, number: "323" },
  vitamin_k: { id: 1185, number: "430" },
  thiamin: { id: 1165, number: "404" },
  riboflavin: { id: 1166, number: "405" },
  niacin: { id: 1167, number: "406" },
  vitamin_b6: { id: 1175, number: "415" },
  folate_dfe: { id: 1190, number: "435" },
  vitamin_b12: { id: 1178, number: "418" },
  calcium: { id: 1087, number: "301" },
  iron: { id: 1089, number: "303" },
  magnesium: { id: 1090, number: "304" },
  phosphorus: { id: 1091, number: "305" },
  potassium: { id: 1092, number: "306" },
  zinc: { id: 1095, number: "309" },
  selenium: { id: 1103, number: "317" },
  cholesterol: { id: 1253, number: "601" },
};

/** Nutriente de FDC en cualquiera de sus formas (búsqueda, detalle "full" o "abridged"). */
export type FdcFoodNutrient = {
  nutrientId?: number;
  nutrientNumber?: string;
  unitName?: string;
  value?: number;
  number?: string;
  amount?: number;
  nutrient?: { id?: number; number?: string; name?: string; unitName?: string };
};

export type FdcFoodPortion = {
  id?: number;
  amount?: number;
  gramWeight?: number;
  modifier?: string | null;
  portionDescription?: string | null;
  sequenceNumber?: number;
  measureUnit?: { name?: string; abbreviation?: string } | null;
};

export type FdcFood = {
  fdcId: number;
  description?: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: FdcFoodNutrient[];
  foodPortions?: FdcFoodPortion[];
};

type NutrientValue = { amount: number; unit: string };

/** Índice de nutrientes de un alimento por id y por número. */
export function indexNutrients(food: Pick<FdcFood, "foodNutrients">): { byId: Map<number, NutrientValue>; byNumber: Map<string, NutrientValue> } {
  const byId = new Map<number, NutrientValue>();
  const byNumber = new Map<string, NutrientValue>();
  for (const fn of food.foodNutrients ?? []) {
    const id = fn.nutrient?.id ?? fn.nutrientId;
    const number = fn.nutrient?.number ?? fn.nutrientNumber ?? fn.number;
    const amount = fn.amount ?? fn.value;
    const unit = (fn.nutrient?.unitName ?? fn.unitName ?? "").trim();
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) continue;
    const value = { amount, unit };
    if (typeof id === "number" && !byId.has(id)) byId.set(id, value);
    if (typeof number === "string" && !byNumber.has(number)) byNumber.set(number, value);
  }
  return { byId, byNumber };
}

function pick(index: ReturnType<typeof indexNutrients>, refs: readonly NutrientRef[]): NutrientValue | null {
  for (const ref of refs) {
    const v = index.byId.get(ref.id) ?? index.byNumber.get(ref.number);
    if (v) return v;
  }
  return null;
}

const MASS_FACTORS: Record<string, number> = { g: 1, mg: 1e-3, ug: 1e-6, "µg": 1e-6, "μg": 1e-6, mcg: 1e-6 };

/** Convierte entre g, mg y µg. null si la unidad no es de masa (p. ej. IU). */
export function convertMassUnit(amount: number, from: string, to: string): number | null {
  const f = MASS_FACTORS[from.trim().toLowerCase()];
  const t = MASS_FACTORS[to.trim().toLowerCase()];
  if (f == null || t == null) return null;
  return (amount * f) / t;
}

/* -------------------------------------------------------------------------- */
/* Porciones                                                                    */
/* -------------------------------------------------------------------------- */

const UNIT_ES: Array<[RegExp, string, string]> = [
  [/^fl\.?\s*oz\b/i, "fl oz", "fl oz"],
  [/^cups?\b/i, "taza", "taza"],
  [/^(tbsp|tablespoons?)\b/i, "cda.", "cda"],
  [/^(tsp|teaspoons?)\b/i, "cdta.", "cdta"],
  [/^oz\b/i, "oz", "oz"],
  [/^slices?\b/i, "rebanada", "rebanada"],
  [/^(pieces?|each|units?)\b/i, "unidad", "unidad"],
  [/^medium\b/i, "unidad mediana", "unidad"],
  [/^large\b/i, "unidad grande", "unidad"],
  [/^small\b/i, "unidad pequeña", "unidad"],
  [/^servings?\b/i, "porción", "porción"],
  [/^(packages?|containers?|packets?)\b/i, "envase", "envase"],
];

const fmtAmount = (n: number) => String(Number(n.toFixed(2)));

export type MappedPortion = { label: string; quantity: number; unit: string; gramWeight: number; isDefault: boolean };

/** Porción casera de FDC → etiqueta en español cuando la unidad es conocida ("1 cup" → "1 taza"). */
export function mapFdcPortion(p: FdcFoodPortion): Omit<MappedPortion, "isDefault"> | null {
  const gramWeight = typeof p.gramWeight === "number" ? p.gramWeight : NaN;
  if (!Number.isFinite(gramWeight) || gramWeight <= 0 || gramWeight > 5000) return null;
  const amount = typeof p.amount === "number" && p.amount > 0 ? p.amount : 1;
  const description = (p.portionDescription ?? "").trim();
  if (/quantity not specified/i.test(description)) return null;

  let rest: string;
  if (description) rest = description.replace(/^\s*[\d./\s-]+(?=[a-z])/i, "").trim();
  else {
    const measure = p.measureUnit?.name && p.measureUnit.name !== "undetermined" ? p.measureUnit.name : "";
    rest = `${measure} ${p.modifier ?? ""}`.trim();
  }
  if (!rest) rest = "porción";

  let label: string;
  let unit: string;
  const match = UNIT_ES.find(([re]) => re.test(rest));
  if (match) {
    const [re, labelEs, unitEs] = match;
    const tail = rest.replace(re, "").replace(/^[\s,]+/, "").trim();
    label = `${fmtAmount(amount)} ${labelEs}${tail ? ` (${tail})` : ""}`;
    unit = unitEs;
  } else {
    label = `${fmtAmount(amount)} ${rest}`;
    unit = rest.split(/[\s,(]/)[0] || "porción";
  }
  return { label: label.slice(0, 80), quantity: amount, unit: unit.slice(0, 30), gramWeight: roundDecimals(gramWeight, 2) };
}

/* -------------------------------------------------------------------------- */
/* Mapeo de un alimento                                                         */
/* -------------------------------------------------------------------------- */

export type UsdaMappedFood = {
  fdcId: number;
  name: string;
  brandName: string | null;
  foodType: "generic" | "branded";
  dataType: string | null;
  barcode: string | null;
  per100g: {
    energyKcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number | null;
    sugarG: number | null;
    saturatedFatG: number | null;
    sodiumMg: number | null;
  };
  energyFromKj: boolean;
  /** Micronutrientes por código, ya en la unidad de `nutrient_definitions`. */
  micronutrients: Record<string, number>;
  portions: MappedPortion[];
  sourceRef: string;
  sourceUrl: string;
  license: string;
  description: string;
};

export type UsdaMapResult = { ok: true; food: UsdaMappedFood } | { ok: false; fdcId: number; reason: string };

/**
 * Mapea un alimento de FDC (detalle o resultado de búsqueda). `definitions` son las unidades de
 * `nutrient_definitions` por código (solo se importan los micronutrientes definidos ahí).
 */
export function mapUsdaFood(food: FdcFood, definitions: Record<string, string> = {}): UsdaMapResult {
  const fdcId = food.fdcId;
  const name = (food.description ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (!Number.isInteger(fdcId) || fdcId <= 0) return { ok: false, fdcId, reason: "fdcId inválido" };
  if (!name) return { ok: false, fdcId, reason: "sin nombre" };

  const index = indexNutrients(food);
  const grams = (refs: readonly NutrientRef[]) => {
    const v = pick(index, refs);
    if (!v) return null;
    const g = convertMassUnit(v.amount, v.unit || "g", "g");
    return g == null ? null : roundDecimals(g, 2);
  };

  let energyFromKj = false;
  let energyKcal: number | null = null;
  const energy = pick(index, USDA_CORE_NUTRIENTS.energyKcal);
  if (energy && (!energy.unit || energy.unit.toLowerCase() === "kcal")) energyKcal = roundDecimals(energy.amount, 2);
  if (energyKcal == null) {
    const kj = pick(index, [ENERGY_KJ]);
    if (kj && kj.unit.toLowerCase() === "kj") {
      energyKcal = roundDecimals(kj.amount / 4.184, 2);
      energyFromKj = true;
    }
  }
  const proteinG = grams(USDA_CORE_NUTRIENTS.proteinG);
  const carbsG = grams(USDA_CORE_NUTRIENTS.carbsG);
  const fatG = grams(USDA_CORE_NUTRIENTS.fatG);
  if (energyKcal == null || proteinG == null || carbsG == null || fatG == null) {
    return { ok: false, fdcId, reason: "faltan energía o macronutrientes" };
  }
  if (energyKcal > 900 || proteinG > 100 || carbsG > 100 || fatG > 100) return { ok: false, fdcId, reason: "valores fuera de rango" };

  const sodium = pick(index, USDA_CORE_NUTRIENTS.sodiumMg);
  const sodiumMg = sodium ? convertMassUnit(sodium.amount, sodium.unit || "mg", "mg") : null;

  const micronutrients: Record<string, number> = {};
  for (const [code, ref] of Object.entries(USDA_MICRONUTRIENTS)) {
    const unit = definitions[code];
    if (!unit) continue;
    const v = index.byId.get(ref.id) ?? index.byNumber.get(ref.number);
    if (!v) continue;
    const converted = convertMassUnit(v.amount, v.unit, unit);
    if (converted != null) micronutrients[code] = roundDecimals(converted, 4);
  }

  const portions: MappedPortion[] = [];
  const sorted = [...(food.foodPortions ?? [])].sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0));
  for (const p of sorted) {
    const mapped = mapFdcPortion(p);
    if (mapped && !portions.some((x) => x.label === mapped.label)) portions.push({ ...mapped, isDefault: false });
    if (portions.length >= 8) break;
  }
  const isBranded = (food.dataType ?? "").toLowerCase() === "branded";
  if (portions.length === 0 && isBranded && typeof food.servingSize === "number" && /^(g|grm)$/i.test(food.servingSizeUnit ?? "")) {
    const g = food.servingSize;
    if (g > 0 && g <= 5000) {
      const household = (food.householdServingFullText ?? "").trim();
      portions.push({
        label: `1 porción (${household ? `${household}, ` : ""}${fmtAmount(g)} g)`.slice(0, 80),
        quantity: 1,
        unit: "porción",
        gramWeight: roundDecimals(g, 2),
        isDefault: false,
      });
    }
  }
  if (portions[0]) portions[0].isDefault = true;

  const gtin = (food.gtinUpc ?? "").replace(/\D/g, "");
  const barcode = isBranded && /^\d{8,14}$/.test(gtin) && hasValidGtinCheckDigit(gtin) ? gtin : null;
  const brandName = isBranded ? (food.brandName ?? food.brandOwner ?? "").replace(/\s+/g, " ").trim().slice(0, 120) || null : null;

  const descriptionParts = [
    `USDA FoodData Central, ${food.dataType ?? "tipo no indicado"}, FDC ID ${fdcId}. Nombre original en inglés.`,
  ];
  if (energyFromKj) descriptionParts.push("Energía calculada desde kJ (÷ 4.184).");

  return {
    ok: true,
    food: {
      fdcId,
      name,
      brandName,
      foodType: isBranded ? "branded" : "generic",
      dataType: food.dataType ?? null,
      barcode,
      per100g: {
        energyKcal,
        proteinG,
        carbsG,
        fatG,
        fiberG: grams(USDA_CORE_NUTRIENTS.fiberG),
        sugarG: grams(USDA_CORE_NUTRIENTS.sugarG),
        saturatedFatG: grams(USDA_CORE_NUTRIENTS.saturatedFatG),
        sodiumMg: sodiumMg == null || sodiumMg > 100_000 ? null : roundDecimals(sodiumMg, 2),
      },
      energyFromKj,
      micronutrients,
      portions,
      sourceRef: fdcSourceRef(fdcId),
      sourceUrl: fdcFoodUrl(fdcId),
      license: USDA_LICENSE,
      description: descriptionParts.join(" "),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Cliente HTTP                                                                 */
/* -------------------------------------------------------------------------- */

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type UsdaClientOptions = { apiKey: string; fetchImpl?: FetchLike; timeoutMs?: number };

async function fdcGet(path: string, params: Record<string, string>, opts: UsdaClientOptions): Promise<unknown> {
  const url = new URL(`${FDC_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("api_key", opts.apiKey);
  const fetchImpl: FetchLike = opts.fetchImpl ?? ((input, init) => fetch(input, init));
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? USDA_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetchImpl(url.toString(), { headers: { Accept: "application/json" }, signal: timeout, cache: "no-store" });
  } catch (error) {
    if (timeout.aborted || (error instanceof Error && error.name === "TimeoutError")) {
      throw new UsdaError("USDA_TIMEOUT", "FoodData Central no respondió a tiempo.");
    }
    throw new UsdaError("USDA_HTTP_ERROR", "No pudimos conectarnos con FoodData Central.");
  }
  if (!res.ok) {
    // 403 = clave inválida; 429 = límite por hora de api.data.gov. Nunca se incluye la clave en el mensaje.
    const reason = res.status === 403 ? "la clave FDC_API_KEY no es válida" : res.status === 429 ? "se superó el límite de consultas" : `error ${res.status}`;
    throw new UsdaError("USDA_HTTP_ERROR", `FoodData Central rechazó la consulta: ${reason}.`, res.status);
  }
  try {
    return await res.json();
  } catch {
    throw new UsdaError("USDA_BAD_RESPONSE", "FoodData Central respondió con datos ilegibles.", res.status);
  }
}

/** GET /v1/foods/search: ids y datos abreviados (por defecto solo Foundation y SR Legacy). */
export async function searchFdc(
  query: string,
  pageSize: number,
  opts: UsdaClientOptions & { dataTypes?: readonly string[] },
): Promise<FdcFood[]> {
  const body = await fdcGet(
    "/foods/search",
    {
      query,
      pageSize: String(Math.min(Math.max(Math.trunc(pageSize), 1), 200)),
      dataType: (opts.dataTypes ?? USDA_GENERIC_DATA_TYPES).join(","),
    },
    opts,
  );
  const foods = (body as { foods?: unknown }).foods;
  if (!Array.isArray(foods)) throw new UsdaError("USDA_BAD_RESPONSE", "FoodData Central respondió sin lista de alimentos.");
  return foods.filter((f): f is FdcFood => Boolean(f) && typeof (f as FdcFood).fdcId === "number");
}

/** GET /v1/foods?fdcIds=…: detalle completo (nutrientes y porciones), en lotes de 20. */
export async function getFdcFoods(fdcIds: readonly number[], opts: UsdaClientOptions): Promise<FdcFood[]> {
  const out: FdcFood[] = [];
  for (let i = 0; i < fdcIds.length; i += 20) {
    const chunk = fdcIds.slice(i, i + 20);
    const body = await fdcGet("/foods", { fdcIds: chunk.join(","), format: "full" }, opts);
    if (!Array.isArray(body)) throw new UsdaError("USDA_BAD_RESPONSE", "FoodData Central respondió con un formato inesperado.");
    for (const f of body) if (f && typeof (f as FdcFood).fdcId === "number") out.push(f as FdcFood);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Importación                                                                  */
/* -------------------------------------------------------------------------- */

export type UsdaImportOptions = { query?: string; fdcIds?: number[]; limit?: number; dataTypes?: readonly string[] };

export type UsdaImportResult = {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
  /** Motivo de cada omitido (datos incompletos o id inexistente). */
  skippedReasons: string[];
};

type Admin = SupabaseClient<Database>;

async function nutrientDefinitions(admin: Admin): Promise<{ units: Record<string, string>; ids: Record<string, number> }> {
  const { data, error } = await admin.from("nutrient_definitions").select("id, code, unit");
  if (error) throw new Error(`nutrient_definitions: ${error.code ?? "error"}`);
  const units: Record<string, string> = {};
  const ids: Record<string, number> = {};
  for (const row of data ?? []) {
    units[row.code] = row.unit;
    ids[row.code] = row.id;
  }
  return { units, ids };
}

/** Busca la marca por su nombre normalizado o la crea. */
export async function ensureBrand(admin: Admin, name: string): Promise<string> {
  const { data: normalized, error: nError } = await admin.rpc("normalize_text", { value: name });
  if (nError || typeof normalized !== "string") throw new Error(`normalize_text: ${nError?.code ?? "error"}`);
  const find = () => admin.from("brands").select("id").eq("name_normalized", normalized).maybeSingle();
  const { data: existing } = await find();
  if (existing) return existing.id;
  const { data, error } = await admin.from("brands").insert({ name }).select("id").single();
  if (data) return data.id;
  if (error?.code === "23505") {
    const { data: again } = await find();
    if (again) return again.id;
  }
  throw new Error(`brands: ${error?.code ?? "error"}`);
}

/** Inserta o actualiza un alimento mapeado (por `source_ref = 'fdc:{id}'`). */
export async function upsertUsdaFood(
  admin: Admin,
  food: UsdaMappedFood,
  nutrientIds: Record<string, number>,
  now: Date = new Date(),
): Promise<{ id: string; action: "inserted" | "updated" }> {
  const nutrients = {
    energy_kcal: food.per100g.energyKcal,
    protein_g: food.per100g.proteinG,
    carbs_g: food.per100g.carbsG,
    fat_g: food.per100g.fatG,
    fiber_g: food.per100g.fiberG,
    sugar_g: food.per100g.sugarG,
    saturated_fat_g: food.per100g.saturatedFatG,
    sodium_mg: food.per100g.sodiumMg,
  };
  const { data: existing, error: findError } = await admin
    .from("foods")
    .select("id, verification_status")
    .eq("source_ref", food.sourceRef)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (findError) throw new Error(`foods: ${findError.code ?? "error"}`);

  let id: string;
  let action: "inserted" | "updated";
  if (existing) {
    // Se actualizan los valores oficiales; el nombre, la marca y la descripción pueden haberse
    // traducido o corregido en /admin, así que no se pisan. Un "rechazado" sigue rechazado.
    const patch: TablesUpdate<"foods"> = {
      ...nutrients,
      source: "usda",
      source_url: food.sourceUrl,
      license: food.license,
      ...(existing.verification_status === "rejected" ? {} : { verification_status: "verified", verified_at: now.toISOString() }),
    };
    const { error } = await admin.from("foods").update(patch).eq("id", existing.id);
    if (error) throw new Error(`foods update: ${error.code ?? "error"}`);
    id = existing.id;
    action = "updated";
  } else {
    let barcode = food.barcode;
    if (barcode) {
      const { data: taken } = await admin.from("foods").select("id").eq("barcode", barcode).eq("is_public", true).limit(1);
      if (taken && taken.length > 0) barcode = null;
    }
    const insert: TablesInsert<"foods"> = {
      ...nutrients,
      name: food.name,
      brand_id: food.brandName ? await ensureBrand(admin, food.brandName) : null,
      description: food.description,
      food_type: food.foodType,
      barcode,
      source: "usda",
      source_ref: food.sourceRef,
      source_url: food.sourceUrl,
      license: food.license,
      verification_status: "verified",
      verified_at: now.toISOString(),
      is_public: true,
      created_by: null,
    };
    const { data, error } = await admin.from("foods").insert(insert).select("id").single();
    if (error || !data) throw new Error(`foods insert: ${error?.code ?? "error"}`);
    id = data.id;
    action = "inserted";
  }

  const micro = Object.entries(food.micronutrients)
    .filter(([code]) => nutrientIds[code] != null)
    .map(([code, amount]) => ({ food_id: id, nutrient_id: nutrientIds[code], amount_per_100g: amount }));
  if (micro.length) {
    const { error } = await admin.from("food_nutrients").upsert(micro, { onConflict: "food_id,nutrient_id" });
    if (error) throw new Error(`food_nutrients: ${error.code ?? "error"}`);
  }

  if (food.portions.length) {
    // Solo si el alimento aún no tiene porciones (las del staff no se reemplazan).
    const { count } = await admin.from("food_portions").select("id", { count: "exact", head: true }).eq("food_id", id);
    if (!count) {
      const rows = food.portions.map((p) => ({
        food_id: id,
        label: p.label,
        quantity: p.quantity,
        unit: p.unit,
        gram_weight: p.gramWeight,
        is_default: p.isDefault,
      }));
      const { error } = await admin.from("food_portions").insert(rows);
      if (error) throw new Error(`food_portions: ${error.code ?? "error"}`);
    }
  }
  return { id, action };
}

/**
 * Importa alimentos de FDC por búsqueda (`query`) o por ids (`fdcIds`) usando el cliente admin.
 * Sin clave lanza `UsdaError('USDA_NOT_CONFIGURED')`. Los errores de un alimento no detienen al
 * resto: quedan en `errors`.
 */
export async function importUsdaFoodsWithKey(
  admin: Admin,
  opts: UsdaImportOptions,
  client: Omit<UsdaClientOptions, "apiKey"> & { apiKey: string | null | undefined; now?: Date },
): Promise<UsdaImportResult> {
  const apiKey = client.apiKey?.trim();
  if (!apiKey) {
    throw new UsdaError("USDA_NOT_CONFIGURED", "Falta FDC_API_KEY: la importación desde USDA FoodData Central está pendiente de configurar.");
  }
  const http: UsdaClientOptions = { apiKey, fetchImpl: client.fetchImpl, timeoutMs: client.timeoutMs };
  const query = opts.query?.trim() ?? "";
  const ids = [...new Set((opts.fdcIds ?? []).filter((n) => Number.isInteger(n) && n > 0))];
  if (!query && ids.length === 0) throw new UsdaError("USDA_INVALID_INPUT", "Indica una búsqueda o una lista de FDC IDs.");
  if (query && (query.length < 2 || query.length > 100)) throw new UsdaError("USDA_INVALID_INPUT", "La búsqueda debe tener entre 2 y 100 caracteres.");
  const limit = Math.min(Math.max(Math.trunc(opts.limit ?? (ids.length || 20)), 1), 200);

  const wanted = ids.length ? ids.slice(0, limit) : (await searchFdc(query, limit, { ...http, dataTypes: opts.dataTypes })).map((f) => f.fdcId).slice(0, limit);
  const result: UsdaImportResult = { inserted: 0, updated: 0, skipped: 0, errors: [], skippedReasons: [] };
  if (wanted.length === 0) return result;

  const [foods, defs] = await Promise.all([getFdcFoods(wanted, http), nutrientDefinitions(admin)]);
  const returned = new Set(foods.map((f) => f.fdcId));
  for (const id of wanted) {
    if (!returned.has(id)) {
      result.skipped++;
      result.skippedReasons.push(`fdc:${id}: no existe en FoodData Central`);
    }
  }

  for (const raw of foods) {
    const mapped = mapUsdaFood(raw, defs.units);
    if (!mapped.ok) {
      result.skipped++;
      result.skippedReasons.push(`fdc:${mapped.fdcId}: ${mapped.reason}`);
      continue;
    }
    try {
      const { action } = await upsertUsdaFood(admin, mapped.food, defs.ids, client.now);
      result[action]++;
    } catch (error) {
      result.errors.push(`fdc:${mapped.food.fdcId}: ${error instanceof Error ? error.message : "error"}`);
    }
  }
  return result;
}
