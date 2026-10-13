import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  deleteTestUsers,
  foodFixture,
  serviceClient,
  uniqueTag,
  type TestUser,
} from "./helpers";

describe("catálogo de alimentos (RLS y búsqueda)", () => {
  const admin = serviceClient();
  const tag = uniqueTag();
  const barcode = `77${String(Date.now()).slice(-11)}`; // 13 dígitos
  let a: TestUser;
  let b: TestUser;
  let staff: TestUser;
  let publicFoodId: string;
  let ownFoodId: string;
  const createdFoodIds: string[] = [];

  beforeAll(async () => {
    a = await createTestUser("foods-a");
    b = await createTestUser("foods-b");
    staff = await createTestUser("foods-staff", ["editor"]);
  });

  afterAll(async () => {
    if (createdFoodIds.length > 0) await admin.from("foods").delete().in("id", createdFoodIds);
    await deleteTestUsers([a, b, staff]);
  });

  it("el staff (editor) puede crear alimentos públicos", async () => {
    const { data, error } = await staff.client
      .from("foods")
      .insert({
        ...foodFixture(`Ají amarillo ${tag}`),
        source: "curated",
        verification_status: "curated",
        is_public: true,
        barcode,
      })
      .select("id, name_normalized, created_by")
      .single();
    expect(error).toBeNull();
    publicFoodId = data!.id;
    createdFoodIds.push(publicFoodId);
    // name_normalized lo arma el trigger (sin tildes, minúsculas).
    expect(data!.name_normalized).toBe(`aji amarillo ${tag}`);
    expect(data!.created_by).toBe(staff.id);
  });

  it("un usuario normal no puede crear alimentos públicos ni 'verificados'", async () => {
    const asPublic = await a.client
      .from("foods")
      .insert({ ...foodFixture(`Público trucho ${tag}`), source: "user", is_public: true });
    expect(asPublic.error?.code).toBe("42501");

    const asVerified = await a.client
      .from("foods")
      .insert({ ...foodFixture(`Verificado trucho ${tag}`), source: "user", verification_status: "verified" });
    expect(asVerified.error?.code).toBe("42501");

    const asCurated = await a.client.from("foods").insert({ ...foodFixture(`Curado trucho ${tag}`), source: "curated" });
    expect(asCurated.error?.code).toBe("42501");
  });

  it("los alimentos públicos son visibles para anon", async () => {
    const { data, error } = await anonClient().from("foods").select("id, name").eq("id", publicFoodId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("un alimento propio de A es invisible para B y para anon", async () => {
    const created = await a.client
      .from("foods")
      .insert({ ...foodFixture(`Pan casero de la abuela ${tag}`), source: "user" })
      .select("id, is_public, created_by")
      .single();
    expect(created.error).toBeNull();
    ownFoodId = created.data!.id;
    createdFoodIds.push(ownFoodId);
    expect(created.data!.is_public).toBe(false);
    expect(created.data!.created_by).toBe(a.id);

    const forA = await a.client.from("foods").select("id").eq("id", ownFoodId);
    expect(forA.data).toHaveLength(1);
    const forB = await b.client.from("foods").select("id").eq("id", ownFoodId);
    expect(forB.error).toBeNull();
    expect(forB.data).toEqual([]);
    const forAnon = await anonClient().from("foods").select("id").eq("id", ownFoodId);
    expect(forAnon.data).toEqual([]);
  });

  it("A no puede volver público su alimento ni editar el catálogo público", async () => {
    const makePublic = await a.client.from("foods").update({ is_public: true }).eq("id", ownFoodId).select();
    expect(makePublic.error?.code).toBe("42501");

    const editPublic = await a.client.from("foods").update({ energy_kcal: 1 }).eq("id", publicFoodId).select();
    expect(editPublic.data ?? []).toEqual([]);
    const check = await admin.from("foods").select("energy_kcal").eq("id", publicFoodId).single();
    expect(Number(check.data?.energy_kcal)).toBe(120);
  });

  it("un alimento propio puede repetir el código de barras de uno público sin chocar", async () => {
    const own = await b.client
      .from("foods")
      .insert({ ...foodFixture(`Galleta escaneada ${tag}`), source: "user", barcode })
      .select("id")
      .single();
    expect(own.error).toBeNull();
    createdFoodIds.push(own.data!.id);

    const duplicatePublic = await staff.client
      .from("foods")
      .insert({ ...foodFixture(`Duplicado ${tag}`), source: "curated", is_public: true, barcode });
    expect(duplicatePublic.error?.code).toBe("23505");
  });

  it("search_foods encuentra con y sin tildes (también para anon)", async () => {
    for (const query of [`aji amarillo ${tag}`, `ají amarillo ${tag}`, `AJÍ AMARILLO ${tag}`, "aji amarillo"]) {
      const { data, error } = await anonClient().rpc("search_foods", { query, max_results: 50 });
      expect(error).toBeNull();
      expect((data ?? []).map((f) => f.id)).toContain(publicFoodId);
    }
  });

  it("search_foods devuelve los alimentos propios solo a su dueño", async () => {
    const forA = await a.client.rpc("search_foods", { query: `pan casero ${tag}` });
    expect(forA.error).toBeNull();
    expect((forA.data ?? []).map((f) => f.id)).toContain(ownFoodId);

    const forB = await b.client.rpc("search_foods", { query: `pan casero ${tag}` });
    expect(forB.error).toBeNull();
    expect((forB.data ?? []).map((f) => f.id)).not.toContain(ownFoodId);
  });

  it("search_foods ordena primero lo más parecido", async () => {
    const { data, error } = await a.client.rpc("search_foods", { query: `ají amarillo ${tag}` });
    expect(error).toBeNull();
    expect(data?.[0]?.id).toBe(publicFoodId);
  });
});
