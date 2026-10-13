/**
 * Módulo alimentos contra el Supabase LOCAL: route handlers reales (GET /api/foods/search,
 * /api/foods/{id}, /api/foods/barcode/{code}) con una sesión de verdad en cookies, 401 sin sesión,
 * 429 por rate limit, guardado de productos de Open Food Facts y de USDA (sin red: se guarda la
 * salida del mapeo), candidatos a duplicado y la acción de registro por código de barras.
 *
 * Open Food Facts no es accesible desde este contenedor: el único caso que llega a la red espera
 * el error real (502), nunca un producto inventado.
 */
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { gtinCheckDigit } from "@/lib/foods/barcode";
import { mapOffProduct, type OffProduct } from "@/lib/foods/open-food-facts";
import { mapUsdaFood, type FdcFood } from "@/lib/foods/usda-core";
import offFound from "@/lib/foods/__fixtures__/off-product-found.json";
import usdaDetails from "@/lib/foods/__fixtures__/usda-foods-details.json";
import { serviceClient, uniqueTag } from "./helpers";

/* ------------------------------------------------------------------ */
/* Entorno y cookies de sesión (next/headers simulado con un tarro).   */
/* ------------------------------------------------------------------ */

const jar = vi.hoisted(() => ({ current: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [...jar.current].map(([name, value]) => ({ name, value })),
    get: (name: string) => (jar.current.has(name) ? { name, value: jar.current.get(name)! } : undefined),
    set: (name: string, value: string) => {
      if (value) jar.current.set(name, value);
      else jar.current.delete(name);
    },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const envFile = fileURLToPath(new URL("../../.env.local", import.meta.url));
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

type Db = SupabaseClient<Database>;
type Session = { id: string; email: string; cookies: Map<string, string>; client: Db };

async function createSessionUser(label: string): Promise<Session> {
  const admin = serviceClient();
  const email = `it-alimentos-${label}-${uniqueTag()}@example.com`;
  const password = `Pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  const cookies = new Map<string, string>();
  const client = createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (list) => {
        for (const { name, value } of list) {
          if (value) cookies.set(name, value);
          else cookies.delete(name);
        }
      },
    },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn: ${signInError.message}`);
  return { id: data.user.id, email, cookies, client };
}

/** EAN-13 válido y único en la zona de uso interno (prefijo 20). */
function uniqueEan13(): string {
  const body = `20${String(Date.now()).slice(-7)}${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
  return body + gtinCheckDigit(body);
}

const as = (s: Session | null) => {
  jar.current = s ? s.cookies : new Map();
};

type Routes = {
  search: typeof import("@/app/api/foods/search/route");
  detail: typeof import("@/app/api/foods/[id]/route");
  barcode: typeof import("@/app/api/foods/barcode/[code]/route");
  actions: typeof import("@/features/foods/actions");
  offImport: typeof import("@/lib/foods/off-import");
  usda: typeof import("@/lib/foods/usda-core");
  dedup: typeof import("@/lib/foods/dedup");
};

describe("módulo alimentos (Supabase local)", () => {
  const admin = serviceClient();
  const tag = uniqueTag();
  const foodIds: string[] = [];
  const brandIds: string[] = [];
  const users: Session[] = [];
  let r: Routes;
  let a: Session;
  let b: Session;
  let publicFoodId: string;
  let ownFoodB: string;
  const publicCode = uniqueEan13();

  const get = async (path: string) => {
    const url = `http://localhost${path}`;
    const [pathname] = path.split("?");
    let res: Response;
    if (pathname === "/api/foods/search") res = await r.search.GET(new Request(url));
    else if (pathname.startsWith("/api/foods/barcode/")) {
      res = await r.barcode.GET(new Request(url), { params: Promise.resolve({ code: decodeURIComponent(pathname.split("/").pop()!) }) });
    } else res = await r.detail.GET(new Request(url), { params: Promise.resolve({ id: pathname.split("/").pop()! }) });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> & { error?: { code: string; message: string } } };
  };

  beforeAll(async () => {
    r = {
      search: await import("@/app/api/foods/search/route"),
      detail: await import("@/app/api/foods/[id]/route"),
      barcode: await import("@/app/api/foods/barcode/[code]/route"),
      actions: await import("@/features/foods/actions"),
      offImport: await import("@/lib/foods/off-import"),
      usda: await import("@/lib/foods/usda-core"),
      dedup: await import("@/lib/foods/dedup"),
    };
    a = await createSessionUser("a");
    b = await createSessionUser("b");
    users.push(a, b);

    const { data: food, error } = await admin
      .from("foods")
      .insert({
        name: `Quinua cocida alimentosit ${tag}`,
        energy_kcal: 120,
        protein_g: 4.4,
        carbs_g: 21.3,
        fat_g: 1.92,
        fiber_g: 2.8,
        source: "curated",
        verification_status: "curated",
        is_public: true,
        barcode: publicCode,
        license: "Prueba de integración",
      })
      .select("id")
      .single();
    if (error) throw error;
    publicFoodId = food.id;
    foodIds.push(food.id);
    const { error: pError } = await admin.from("food_portions").insert([
      { food_id: food.id, label: "1 taza", quantity: 1, unit: "taza", gram_weight: 185, is_default: false },
      { food_id: food.id, label: "1 cucharón", quantity: 1, unit: "cucharon", gram_weight: 90, is_default: true },
    ]);
    if (pError) throw pError;
    const { data: iron } = await admin.from("nutrient_definitions").select("id").eq("code", "iron").single();
    await admin.from("food_nutrients").insert({ food_id: food.id, nutrient_id: iron!.id, amount_per_100g: 1.49 });

    const { data: own, error: ownError } = await b.client
      .from("foods")
      .insert({ name: `Quinua de la casa alimentosit ${tag}`, energy_kcal: 130, protein_g: 4, carbs_g: 22, fat_g: 2, source: "user", created_by: b.id })
      .select("id")
      .single();
    if (ownError) throw ownError;
    ownFoodB = own.id;
    foodIds.push(own.id);
  });

  afterAll(async () => {
    as(null);
    if (foodIds.length) await admin.from("foods").delete().in("id", foodIds);
    if (brandIds.length) await admin.from("brands").delete().in("id", brandIds);
    for (const u of users) await admin.auth.admin.deleteUser(u.id);
  });

  describe("sin sesión", () => {
    it("las tres rutas responden 401 JSON", async () => {
      as(null);
      for (const path of ["/api/foods/search?q=quinua", `/api/foods/${publicFoodId}`, `/api/foods/barcode/${publicCode}`]) {
        const res = await get(path);
        expect(res.status, path).toBe(401);
        expect(res.body.error?.code).toBe("UNAUTHORIZED");
      }
    });
  });

  describe("GET /api/foods/search (contrato 1)", () => {
    it("devuelve FoodSummary con porciones (la por defecto primero) y solo lo visible", async () => {
      as(a);
      const res = await get(`/api/foods/search?q=${encodeURIComponent(`quinua alimentosit ${tag}`)}&limit=20`);
      expect(res.status).toBe(200);
      const foods = res.body.foods as Array<Record<string, unknown> & { id: string; portions: Array<{ label: string; isDefault: boolean; gramWeight: number }> }>;
      const mine = foods.find((f) => f.id === publicFoodId);
      expect(mine).toMatchObject({
        name: `Quinua cocida alimentosit ${tag}`,
        brandName: null,
        foodType: "generic",
        barcode: publicCode,
        per100g: { energyKcal: 120, proteinG: 4.4, carbsG: 21.3, fatG: 1.92, fiberG: 2.8, sugarG: null },
        source: "curated",
        verificationStatus: "curated",
        isOwn: false,
        densityGPerMl: null,
      });
      expect(mine!.portions.map((p) => [p.label, p.isDefault, p.gramWeight])).toEqual([
        ["1 cucharón", true, 90],
        ["1 taza", false, 185],
      ]);
      // El alimento propio de B no aparece para A.
      expect(foods.some((f) => f.id === ownFoodB)).toBe(false);
    });

    it("el alimento propio aparece para su dueño con isOwn", async () => {
      as(b);
      const res = await get(`/api/foods/search?q=${encodeURIComponent(`quinua de la casa alimentosit ${tag}`)}`);
      expect(res.status).toBe(200);
      expect((res.body.foods as Array<{ id: string; isOwn: boolean }>).find((f) => f.id === ownFoodB)?.isOwn).toBe(true);
    });

    it("valida la consulta: sin q → 400; una letra → lista vacía; limit fuera de rango → 400", async () => {
      as(a);
      expect((await get("/api/foods/search")).status).toBe(400);
      expect(await get("/api/foods/search?q=q")).toEqual({ status: 200, body: { foods: [] } });
      expect((await get("/api/foods/search?q=arroz&limit=999")).status).toBe(400);
    });
  });

  describe("GET /api/foods/{id} (contrato 2)", () => {
    it("detalle con porciones, micronutrientes y procedencia", async () => {
      as(a);
      const res = await get(`/api/foods/${publicFoodId}`);
      expect(res.status).toBe(200);
      const food = res.body.food as Record<string, unknown>;
      expect(food).toMatchObject({ id: publicFoodId, license: "Prueba de integración", sourceUrl: null });
      expect(food.micronutrients).toEqual([{ code: "iron", name: "Hierro", unit: "mg", amountPer100g: 1.49 }]);
      expect((food.portions as unknown[]).length).toBe(2);
    });

    it("404 si no existe, si el id está mal formado o si es propio de otra persona", async () => {
      as(a);
      expect((await get(`/api/foods/${randomUUID()}`)).status).toBe(404);
      expect((await get("/api/foods/no-es-un-uuid")).status).toBe(404);
      const other = await get(`/api/foods/${ownFoodB}`);
      expect(other.status).toBe(404);
      expect(other.body.error?.code).toBe("NOT_FOUND");
    });
  });

  describe("GET /api/foods/barcode/{code}", () => {
    it("encuentra en la base local un código guardado", async () => {
      as(a);
      const res = await get(`/api/foods/barcode/${publicCode}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ origin: "database", barcode: { code: publicCode, format: "ean13" }, food: { id: publicFoodId } });
    });

    it("encuentra un UPC-A (12 dígitos) guardado como EAN-13 con 0 inicial", async () => {
      const upcBody = `0${String(Date.now()).slice(-10)}`;
      const upc = upcBody + gtinCheckDigit(upcBody); // 12 dígitos
      const { data, error } = await admin
        .from("foods")
        .insert({ name: `Producto UPC ${tag}`, energy_kcal: 50, protein_g: 1, carbs_g: 10, fat_g: 0, source: "curated", is_public: true, barcode: `0${upc}` })
        .select("id")
        .single();
      if (error) throw error;
      foodIds.push(data.id);
      as(a);
      const res = await get(`/api/foods/barcode/${upc}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ origin: "database", barcode: { code: upc, format: "upca" }, food: { id: data.id } });
    });

    it("400 si el dígito verificador no coincide", async () => {
      as(a);
      const bad = publicCode.slice(0, 12) + ((Number(publicCode[12]) + 1) % 10);
      const res = await get(`/api/foods/barcode/${bad}`);
      expect(res.status).toBe(400);
      expect(res.body.error?.code).toBe("INVALID_BARCODE");
    });

    it("un código solo con datos rechazados → 404 REJECTED", async () => {
      const code = uniqueEan13();
      const { data, error } = await admin
        .from("foods")
        .insert({ name: `Rechazado ${tag}`, energy_kcal: 50, protein_g: 1, carbs_g: 10, fat_g: 0, source: "curated", verification_status: "rejected", is_public: true, barcode: code })
        .select("id")
        .single();
      if (error) throw error;
      foodIds.push(data.id);
      as(a);
      const res = await get(`/api/foods/barcode/${code}`);
      expect(res.status).toBe(404);
      expect(res.body.error?.code).toBe("REJECTED");
    });

    it("si no está en la base consulta OFF de verdad: aquí sin red → 502 (nunca un producto inventado)", async () => {
      as(a);
      const res = await get(`/api/foods/barcode/${uniqueEan13()}`);
      expect([404, 502]).toContain(res.status);
      expect(res.body.food).toBeUndefined();
      if (res.status === 502) expect(res.body.error?.code).toMatch(/^UPSTREAM_/);
    }, 20_000);

    it("pasado el límite por usuario responde 429", async () => {
      as(b);
      for (let i = 0; i < 30; i++) {
        await b.client.rpc("check_rate_limit", { bucket: "foods_barcode", max_hits: 30, window_seconds: 60 });
      }
      const res = await get(`/api/foods/barcode/${publicCode}`);
      expect(res.status).toBe(429);
      expect(res.body.error?.code).toBe("RATE_LIMITED");
    });
  });

  describe("guardado de fuentes externas (salida del mapeo, sin red)", () => {
    it("saveOffFood crea un público sin verificar con licencia ODbL, marca y porciones; es idempotente", async () => {
      const code = uniqueEan13();
      const product = { ...(offFound.product as OffProduct), code, brands: `Marca IT ${tag}` };
      const mapped = mapOffProduct(product, code);
      if (!mapped.ok) throw new Error("fixture inválido");
      const first = await r.offImport.saveOffFood(admin, mapped.food);
      foodIds.push(first.id);
      expect(first.created).toBe(true);
      const again = await r.offImport.saveOffFood(admin, mapped.food);
      expect(again).toEqual({ id: first.id, created: false });

      const { data: row } = await admin.from("foods").select("*, brands(id, name)").eq("id", first.id).single();
      expect(row).toMatchObject({
        source: "open_food_facts",
        verification_status: "unverified",
        is_public: true,
        created_by: null,
        barcode: code,
        license: "ODbL — © colaboradores de Open Food Facts",
        source_url: `https://world.openfoodfacts.org/product/${code}`,
        source_ref: `off:${code}`,
        food_type: "branded",
        sodium_mg: 120,
      });
      const brand = (row as unknown as { brands: { id: string; name: string } }).brands;
      expect(brand.name).toBe(`Marca IT ${tag}`);
      brandIds.push(brand.id);
      const { data: portions } = await admin.from("food_portions").select("label, gram_weight, is_default").eq("food_id", first.id).order("gram_weight");
      expect(portions).toEqual([
        { label: "1 porción (30 g)", gram_weight: 30, is_default: true },
        { label: "1 envase (400 g)", gram_weight: 400, is_default: false },
      ]);

      // Ya guardado: el escáner lo encuentra en la base.
      as(a);
      const res = await get(`/api/foods/barcode/${code}`);
      expect(res).toMatchObject({ status: 200, body: { origin: "database", food: { id: first.id, brandName: `Marca IT ${tag}`, source: "open_food_facts" } } });
    });

    it("upsertUsdaFood inserta como verificado (fdc:{id}) y luego actualiza sin duplicar", async () => {
      const raw = (usdaDetails as unknown as FdcFood[])[0];
      const fdcId = 900_000_000 + Math.floor(Math.random() * 99_999_999);
      const { data: defs } = await admin.from("nutrient_definitions").select("id, code, unit");
      const units = Object.fromEntries((defs ?? []).map((d) => [d.code, d.unit]));
      const ids = Object.fromEntries((defs ?? []).map((d) => [d.code, d.id]));
      const mapped = mapUsdaFood({ ...raw, fdcId, description: `Quinoa, cooked IT ${tag}` }, units);
      if (!mapped.ok) throw new Error("fixture inválido");

      const first = await r.usda.upsertUsdaFood(admin, mapped.food, ids);
      foodIds.push(first.id);
      expect(first.action).toBe("inserted");
      const second = await r.usda.upsertUsdaFood(admin, { ...mapped.food, per100g: { ...mapped.food.per100g, energyKcal: 121 } }, ids);
      expect(second).toEqual({ id: first.id, action: "updated" });

      const { data: rows } = await admin.from("foods").select("*").eq("source_ref", `fdc:${fdcId}`);
      expect(rows).toHaveLength(1);
      expect(rows![0]).toMatchObject({
        source: "usda",
        verification_status: "verified",
        license: "Dominio público (USDA)",
        is_public: true,
        energy_kcal: 121,
        source_url: `https://fdc.nal.usda.gov/food-details/${fdcId}/nutrients`,
      });
      const { count: micro } = await admin.from("food_nutrients").select("*", { count: "exact", head: true }).eq("food_id", first.id);
      expect(micro).toBeGreaterThan(5);
      const { data: portions } = await admin.from("food_portions").select("label, unit, gram_weight").eq("food_id", first.id);
      expect(portions).toEqual([{ label: "1 taza", unit: "taza", gram_weight: 185 }]);
    });
  });

  describe("findDuplicateCandidates (contrato 4)", () => {
    it("propone el par casi idéntico entre públicos", async () => {
      const { data, error } = await admin
        .from("foods")
        .insert([
          { name: `Camote sancochado dup${tag}`, energy_kcal: 76, protein_g: 1.4, carbs_g: 17.7, fat_g: 0.1, source: "curated", is_public: true },
          { name: `Camote, sancochado dup${tag}`, energy_kcal: 76, protein_g: 1.4, carbs_g: 17.7, fat_g: 0.1, source: "curated", is_public: true },
        ])
        .select("id");
      if (error) throw error;
      foodIds.push(...data.map((d) => d.id));
      const pairs = await r.dedup.findDuplicateCandidates(admin, { limit: 500, threshold: 0.9 });
      const ours = pairs.find((p) => [p.a.id, p.b.id].sort().join() === data.map((d) => d.id).sort().join());
      expect(ours?.similarity).toBeGreaterThanOrEqual(0.95);
    });
  });

  describe("logBarcodeFoodAction", () => {
    it("registra en el diario con source 'barcode' y nutrientes calculados en el servidor", async () => {
      as(a);
      const res = await r.actions.logBarcodeFoodAction({
        localDate: "2026-10-12",
        mealType: "breakfast",
        foodId: publicFoodId,
        grams: 90,
        quantity: 1,
        unit: "cucharon",
      });
      expect(res).toMatchObject({ ok: true, data: { localDate: "2026-10-12", mealLabel: "Desayuno" } });
      if (!res.ok) return;
      const { data: item } = await admin.from("meal_log_items").select("*").eq("id", res.data.itemIds[0]).single();
      expect(item).toMatchObject({ user_id: a.id, food_id: publicFoodId, source: "barcode", grams: 90, quantity: 1, unit: "cucharon", energy_kcal: 108 });
    });

    it("rechaza fechas fuera de rango y alimentos invisibles", async () => {
      as(a);
      const far = await r.actions.logBarcodeFoodAction({ localDate: "2099-01-01", mealType: "lunch", foodId: publicFoodId, grams: 50 });
      expect(far).toMatchObject({ ok: false, error: { code: "INVALID_DATE" } });
      const hidden = await r.actions.logBarcodeFoodAction({ localDate: "2026-10-12", mealType: "lunch", foodId: ownFoodB, grams: 50 });
      expect(hidden).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
      const invalid = await r.actions.logBarcodeFoodAction({ localDate: "2026-10-12", mealType: "custom", foodId: publicFoodId, grams: 50 });
      expect(invalid).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    });
  });
});
