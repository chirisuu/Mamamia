/**
 * Diario: registrar, editar cantidad (recalcula en servidor), mover, duplicar, copiar comida,
 * plantillas, vaciar, favoritos, alimentos propios, que daily_nutrition_totals cuadre y que un
 * usuario no pueda tocar ítems de otro. Corre contra el Supabase local con usuarios de prueba.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addItemsToMeal, LogItemsError } from "@/features/diary/server/log-items";
import {
  applyTemplate,
  clearMeal,
  copyMealToDate,
  createCustomMeal,
  deleteCustomMeal,
  deleteItem,
  DiaryOpError,
  duplicateItem,
  moveItem,
  saveMealAsTemplate,
  setFavoriteFood,
  updateItemQuantity,
} from "@/features/diary/server/diary-ops";
import { createOwnFood, deleteOwnFood, OwnFoodError, updateOwnFood } from "@/features/diary/server/own-foods";
import { getDiaryDay, getRecentFoods, getTemplates } from "@/features/diary/queries";
import { createTestUser, deleteTestUsers, serviceClient, uniqueTag, type TestUser } from "./helpers";

const DAY = "2026-10-12";
const NEXT_DAY = "2026-10-13";
const OTHER_DAY = "2026-10-14";

async function itemsOn(user: TestUser, date: string) {
  const { data, error } = await user.client
    .from("meal_logs")
    .select("id, meal_type, custom_name, meal_log_items(*)")
    .eq("user_id", user.id)
    .eq("local_date", date);
  if (error) throw error;
  return (data ?? []).flatMap((m) => (m.meal_log_items ?? []).map((i) => ({ ...i, meal_type: m.meal_type, custom_name: m.custom_name })));
}

async function expectOpError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((e: unknown) => (e instanceof DiaryOpError || e instanceof LogItemsError) && e.code === code);
}

describe("diario (operaciones de servidor con RLS)", () => {
  const admin = serviceClient();
  const tag = uniqueTag();
  let a: TestUser;
  let b: TestUser;
  let foodId: string;
  let recipeId: string | null = null;
  let recipePerServingKcal = 0;

  beforeAll(async () => {
    a = await createTestUser("diario-a");
    b = await createTestUser("diario-b");
    // Alimento público conocido: 120 kcal, 4 g P, 22 g C, 1.5 g G, 2 g fibra, 300 mg sodio por 100 g.
    const { data: food, error } = await admin
      .from("foods")
      .insert({
        name: `Arroz de prueba ${tag}`,
        energy_kcal: 120,
        protein_g: 4,
        carbs_g: 22,
        fat_g: 1.5,
        fiber_g: 2,
        sodium_mg: 300,
        source: "curated",
        verification_status: "curated",
        is_public: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    foodId = food.id;
    await admin.from("food_portions").insert({ food_id: foodId, label: "1 taza", quantity: 1, unit: "taza", gram_weight: 160, is_default: true });

    const { data: published } = await admin.from("recipes").select("id").eq("status", "published").eq("is_public", true).limit(50);
    const ids = (published ?? []).map((r) => r.id);
    if (ids.length) {
      const { data: rn } = await admin
        .from("recipe_nutrition")
        .select("recipe_id, per_serving_energy_kcal")
        .in("recipe_id", ids)
        .not("per_serving_energy_kcal", "is", null)
        .limit(1);
      const row = rn?.[0];
      if (row?.recipe_id) {
        recipeId = row.recipe_id;
        recipePerServingKcal = Number(row.per_serving_energy_kcal);
      }
    }
  });

  afterAll(async () => {
    await deleteTestUsers([a, b]);
    if (foodId) await admin.from("foods").delete().eq("id", foodId);
  });

  let breakfastItemId: string;
  let breakfastMealId: string;

  it("registra un alimento con nutrientes calculados en el servidor", async () => {
    const res = await addItemsToMeal(a.client, a.id, {
      localDate: DAY,
      mealType: "breakfast",
      items: [{ kind: "food", foodId, grams: 160, quantity: 1, unit: "taza", source: "search" }],
    });
    expect(res.itemIds).toHaveLength(1);
    breakfastItemId = res.itemIds[0]!;
    breakfastMealId = res.mealLogId;
    const [item] = await itemsOn(a, DAY);
    expect(Number(item!.energy_kcal)).toBe(192);
    expect(Number(item!.protein_g)).toBe(6.4);
    expect(Number(item!.sodium_mg)).toBe(480);
    expect(item!.unit).toBe("taza");
    expect(item!.source).toBe("search");
    expect(item!.data_provenance).toMatch(/^curated:curated/);
  });

  it("editar la cantidad recalcula desde foods (no confía en el cliente)", async () => {
    await updateItemQuantity(a.client, a.id, { itemId: breakfastItemId, grams: 250, quantity: 250, unit: "g" });
    const { data } = await a.client.from("meal_log_items").select("*").eq("id", breakfastItemId).single();
    expect(Number(data!.grams)).toBe(250);
    expect(Number(data!.energy_kcal)).toBe(300);
    expect(Number(data!.carbs_g)).toBe(55);
    expect(Number(data!.fiber_g)).toBe(5);
    expect(data!.unit).toBe("g");
  });

  it("los ítems manuales se escalan en proporción", async () => {
    const res = await addItemsToMeal(a.client, a.id, {
      localDate: DAY,
      mealType: "breakfast",
      items: [{ kind: "manual", name: "Café con leche", energyKcal: 80, proteinG: 4, carbsG: 8, fatG: 3, source: "manual" }],
    });
    const manualId = res.itemIds[0]!;
    await updateItemQuantity(a.client, a.id, { itemId: manualId, quantity: 2 });
    const { data } = await a.client.from("meal_log_items").select("*").eq("id", manualId).single();
    expect(Number(data!.energy_kcal)).toBe(160);
    expect(Number(data!.fat_g)).toBe(6);
    expect(Number(data!.quantity)).toBe(2);
    expect(data!.is_estimate).toBe(true);
  });

  it("las recetas se recalculan por porción desde recipe_nutrition", async () => {
    if (!recipeId) {
      // Sin recetas publicadas en la semilla no hay nada que probar (se avisa en la salida).
      console.warn("[diario] sin recetas publicadas: se omite la prueba de recetas");
      return;
    }
    const res = await addItemsToMeal(a.client, a.id, {
      localDate: DAY,
      mealType: "dinner",
      items: [{ kind: "recipe", recipeId, servings: 1, source: "recipe" }],
    });
    const id = res.itemIds[0]!;
    await updateItemQuantity(a.client, a.id, { itemId: id, servings: 2 });
    const { data } = await a.client.from("meal_log_items").select("*").eq("id", id).single();
    expect(Number(data!.quantity)).toBe(2);
    expect(data!.unit).toBe("porciones");
    expect(Number(data!.energy_kcal)).toBeCloseTo(recipePerServingKcal * 2, 1);
  });

  it("mover un ítem a otra comida del mismo día", async () => {
    await moveItem(a.client, a.id, { itemId: breakfastItemId, mealType: "lunch", customName: null });
    const items = await itemsOn(a, DAY);
    const moved = items.find((i) => i.id === breakfastItemId)!;
    expect(moved.meal_type).toBe("lunch");
    // Y a una comida personalizada nueva (se crea al vuelo).
    await moveItem(a.client, a.id, { itemId: breakfastItemId, mealType: "custom", customName: "Post entreno" });
    const again = (await itemsOn(a, DAY)).find((i) => i.id === breakfastItemId)!;
    expect(again.meal_type).toBe("custom");
    expect(again.custom_name).toBe("Post entreno");
    await moveItem(a.client, a.id, { itemId: breakfastItemId, mealType: "lunch", customName: null });
  });

  it("duplicar crea una copia recalculada con source 'copy'", async () => {
    const res = await duplicateItem(a.client, a.id, breakfastItemId);
    expect(res.copied).toBe(1);
    const lunch = (await itemsOn(a, DAY)).filter((i) => i.meal_type === "lunch");
    expect(lunch).toHaveLength(2);
    const copy = lunch.find((i) => i.id !== breakfastItemId)!;
    expect(copy.source).toBe("copy");
    expect(Number(copy.energy_kcal)).toBe(300);
    expect(copy.food_id).toBe(foodId);
  });

  it("copiar la comida a otro día conserva la comida y los valores", async () => {
    const lunchMealId = (await itemsOn(a, DAY)).find((i) => i.meal_type === "lunch")!.meal_log_id;
    const res = await copyMealToDate(a.client, a.id, { mealLogId: lunchMealId, targetDate: NEXT_DAY });
    expect(res.copied).toBe(2);
    const next = await itemsOn(a, NEXT_DAY);
    expect(next).toHaveLength(2);
    expect(next.every((i) => i.meal_type === "lunch" && i.source === "copy")).toBe(true);
    expect(next.reduce((s, i) => s + Number(i.energy_kcal), 0)).toBe(600);
  });

  it("daily_nutrition_totals cuadra con la suma de los ítems", async () => {
    for (const date of [DAY, NEXT_DAY]) {
      const items = await itemsOn(a, date);
      const { data: view } = await a.client.from("daily_nutrition_totals").select("*").eq("user_id", a.id).eq("local_date", date).single();
      const sum = (k: "energy_kcal" | "protein_g" | "carbs_g" | "fat_g" | "fiber_g" | "sodium_mg") =>
        Math.round(items.reduce((s, i) => s + Number(i[k] ?? 0), 0) * 100) / 100;
      expect(Number(view!.items_count)).toBe(items.length);
      expect(Number(view!.energy_kcal)).toBeCloseTo(sum("energy_kcal"), 2);
      expect(Number(view!.protein_g)).toBeCloseTo(sum("protein_g"), 2);
      expect(Number(view!.carbs_g)).toBeCloseTo(sum("carbs_g"), 2);
      expect(Number(view!.fat_g)).toBeCloseTo(sum("fat_g"), 2);
      expect(Number(view!.fiber_g)).toBeCloseTo(sum("fiber_g"), 2);
      expect(Number(view!.sodium_mg)).toBeCloseTo(sum("sodium_mg"), 2);
      // Y la lectura del diario da los mismos totales (con marcas de incompletos).
      const day = await getDiaryDay(a.client, a.id, date);
      expect(day.totals.itemsCount).toBe(items.length);
      expect(day.totals.energyKcal).toBeCloseTo(sum("energy_kcal"), 1);
    }
  });

  it("un usuario no puede leer ni editar ítems de otro", async () => {
    await expectOpError(updateItemQuantity(b.client, b.id, { itemId: breakfastItemId, grams: 10 }), "NOT_FOUND");
    await expectOpError(deleteItem(b.client, b.id, breakfastItemId), "NOT_FOUND");
    await expectOpError(moveItem(b.client, b.id, { itemId: breakfastItemId, mealType: "dinner", customName: null }), "NOT_FOUND");
    await expectOpError(duplicateItem(b.client, b.id, breakfastItemId), "NOT_FOUND");
    await expectOpError(copyMealToDate(b.client, b.id, { mealLogId: breakfastMealId, targetDate: OTHER_DAY }), "NOT_FOUND");
    await expectOpError(clearMeal(b.client, b.id, breakfastMealId), "NOT_FOUND");
    // Aunque B pase el id de A como "su" usuario, el RLS lo frena.
    await expectOpError(updateItemQuantity(b.client, a.id, { itemId: breakfastItemId, grams: 10 }), "NOT_FOUND");
    await expect(
      addItemsToMeal(b.client, a.id, { localDate: DAY, mealType: "snack", items: [{ kind: "food", foodId, grams: 100, source: "search" }] }),
    ).rejects.toBeInstanceOf(LogItemsError);
    // Escritura directa con su sesión: 0 filas afectadas.
    const { data: direct } = await b.client.from("meal_log_items").update({ energy_kcal: 1 }).eq("id", breakfastItemId).select("id");
    expect(direct ?? []).toHaveLength(0);
    const { data: still } = await a.client.from("meal_log_items").select("energy_kcal, grams").eq("id", breakfastItemId).single();
    expect(Number(still!.energy_kcal)).toBe(300);
    // B tampoco ve los ítems de A.
    const { data: visible } = await b.client.from("meal_log_items").select("id").eq("id", breakfastItemId);
    expect(visible ?? []).toHaveLength(0);
  });

  it("vaciar una comida quita sus ítems", async () => {
    const res = await clearMeal(a.client, a.id, breakfastMealId);
    expect(res.removed).toBe(1);
    const left = (await itemsOn(a, DAY)).filter((i) => i.meal_type === "breakfast");
    expect(left).toHaveLength(0);
  });

  it("comidas personalizadas: crear, nombre repetido y eliminar", async () => {
    const created = await createCustomMeal(a.client, a.id, { localDate: OTHER_DAY, name: "Media mañana" });
    await expectOpError(createCustomMeal(a.client, a.id, { localDate: OTHER_DAY, name: "Media mañana" }), "CONFLICT");
    await expectOpError(deleteCustomMeal(b.client, b.id, created.id), "NOT_FOUND");
    await deleteCustomMeal(a.client, a.id, created.id);
    const { data } = await a.client.from("meal_logs").select("id").eq("id", created.id);
    expect(data ?? []).toHaveLength(0);
  });

  it("favoritos: idempotente al marcar y se puede quitar", async () => {
    await setFavoriteFood(a.client, a.id, { foodId, favorite: true });
    await setFavoriteFood(a.client, a.id, { foodId, favorite: true });
    const { data } = await a.client.from("user_favorites").select("id").eq("user_id", a.id).eq("food_id", foodId);
    expect(data).toHaveLength(1);
    const recent = await getRecentFoods(a.client, a.id);
    expect(recent[0]?.id).toBe(foodId);
    expect(recent[0]?.isFavorite).toBe(true);
    await setFavoriteFood(a.client, a.id, { foodId, favorite: false });
    const { data: after } = await a.client.from("user_favorites").select("id").eq("user_id", a.id).eq("food_id", foodId);
    expect(after).toHaveLength(0);
  });
});

describe("plantillas", () => {
  const admin = serviceClient();
  const tag = uniqueTag();
  let a: TestUser;
  let b: TestUser;
  let foodId: string;

  beforeAll(async () => {
    a = await createTestUser("plantillas-a");
    b = await createTestUser("plantillas-b");
    const { data, error } = await admin
      .from("foods")
      .insert({ name: `Avena de prueba ${tag}`, energy_kcal: 380, protein_g: 13, carbs_g: 66, fat_g: 7, source: "curated", verification_status: "curated", is_public: true })
      .select("id")
      .single();
    if (error) throw error;
    foodId = data.id;
  });

  afterAll(async () => {
    await deleteTestUsers([a, b]);
    if (foodId) await admin.from("foods").delete().eq("id", foodId);
  });

  it("guarda una comida (sin manuales) y la aplica en otra fecha y comida", async () => {
    const res = await addItemsToMeal(a.client, a.id, {
      localDate: DAY,
      mealType: "breakfast",
      items: [
        { kind: "food", foodId, grams: 40, source: "search" },
        { kind: "manual", name: "Fruta", energyKcal: 60, source: "manual" },
      ],
    });
    const saved = await saveMealAsTemplate(a.client, a.id, { mealLogId: res.mealLogId, name: `Mi desayuno ${tag}` });
    expect(saved).toMatchObject({ saved: 1, skipped: 1 });
    const templates = await getTemplates(a.client, a.id);
    expect(templates).toEqual([{ id: saved.templateId, name: `Mi desayuno ${tag}`, mealType: "breakfast", itemsCount: 1 }]);

    // B no ve ni puede aplicar la plantilla de A.
    expect(await getTemplates(b.client, b.id)).toEqual([]);
    await expectOpError(
      applyTemplate(b.client, b.id, { templateId: saved.templateId, localDate: OTHER_DAY, mealType: "dinner", customName: null }),
      "NOT_FOUND",
    );

    const applied = await applyTemplate(a.client, a.id, {
      templateId: saved.templateId,
      localDate: OTHER_DAY,
      mealType: "dinner",
      customName: null,
    });
    expect(applied).toEqual({ added: 1, skipped: 0 });
    const items = await itemsOn(a, OTHER_DAY);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ meal_type: "dinner", source: "template", food_id: foodId });
    expect(Number(items[0]!.energy_kcal)).toBe(152);
  });

  it("guardar como plantilla una comida solo con manuales avisa", async () => {
    const res = await addItemsToMeal(a.client, a.id, {
      localDate: NEXT_DAY,
      mealType: "snack",
      items: [{ kind: "manual", name: "Galletas", energyKcal: 150, source: "manual" }],
    });
    await expectOpError(saveMealAsTemplate(a.client, a.id, { mealLogId: res.mealLogId, name: "Snack" }), "VALIDATION");
  });
});

describe("alimentos propios", () => {
  let a: TestUser;
  let b: TestUser;
  const tag = uniqueTag();

  beforeAll(async () => {
    a = await createTestUser("propios-a");
    b = await createTestUser("propios-b");
  });

  afterAll(async () => {
    await deleteTestUsers([a, b]);
    // La marca creada por la prueba no tiene dueño: se limpia aparte.
    await serviceClient().from("brands").delete().eq("name", `Marca ${tag}`);
  });

  it("crea por porción (convierte a 100 g), privado y con porciones", async () => {
    const { id } = await createOwnFood(a.client, a.id, {
      name: `Galleta casera ${tag}`,
      brandName: `Marca ${tag}`,
      barcode: null,
      basis: "perPortion",
      basisGrams: 30,
      energyKcal: 150,
      proteinG: 3,
      carbsG: 18,
      fatG: 7.5,
      fiberG: 1.5,
      sugarG: null,
      saturatedFatG: null,
      sodiumMg: 90,
      portions: [
        { label: "1 galleta", quantity: 1, unit: "galleta", gramWeight: 15, isDefault: true },
        { label: "1 paquete", quantity: 1, unit: "paquete", gramWeight: 30, isDefault: true },
      ],
    });
    const { data: food } = await a.client.from("foods").select("*, brands(name)").eq("id", id).single();
    expect(Number(food!.energy_kcal)).toBe(500);
    expect(Number(food!.protein_g)).toBe(10);
    expect(Number(food!.fat_g)).toBe(25);
    expect(Number(food!.sodium_mg)).toBe(300);
    expect(food!.is_public).toBe(false);
    expect(food!.source).toBe("user");
    expect(food!.created_by).toBe(a.id);
    expect((food as unknown as { brands: { name: string } }).brands.name).toBe(`Marca ${tag}`);
    const { data: portions } = await a.client.from("food_portions").select("*").eq("food_id", id);
    expect(portions).toHaveLength(2);
    expect(portions!.filter((p) => p.is_default)).toHaveLength(1);

    // Invisible para B, que tampoco puede editarlo ni borrarlo.
    const { data: forB } = await b.client.from("foods").select("id").eq("id", id);
    expect(forB ?? []).toHaveLength(0);
    await expect(
      updateOwnFood(b.client, b.id, id, {
        name: "x",
        basis: "per100g",
        energyKcal: 1,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        portions: [],
      }),
    ).rejects.toBeInstanceOf(OwnFoodError);
    await expect(deleteOwnFood(b.client, b.id, id)).rejects.toBeInstanceOf(OwnFoodError);

    // Editar reemplaza valores y porciones; borrar conserva lo registrado (copia en el diario).
    await updateOwnFood(a.client, a.id, id, {
      name: `Galleta casera ${tag}`,
      basis: "per100g",
      energyKcal: 480,
      proteinG: 9,
      carbsG: 62,
      fatG: 22,
      portions: [],
    });
    const { data: updated } = await a.client.from("foods").select("energy_kcal, brand_id").eq("id", id).single();
    expect(Number(updated!.energy_kcal)).toBe(480);
    expect(updated!.brand_id).toBeNull();
    const logged = await addItemsToMeal(a.client, a.id, {
      localDate: DAY,
      mealType: "snack",
      items: [{ kind: "food", foodId: id, grams: 30, source: "search" }],
    });
    await deleteOwnFood(a.client, a.id, id);
    const { data: kept } = await a.client.from("meal_log_items").select("food_id, energy_kcal").eq("id", logged.itemIds[0]!).single();
    expect(kept!.food_id).toBeNull();
    expect(Number(kept!.energy_kcal)).toBe(144);
  });

  it("rechaza valores imposibles por 100 g", async () => {
    await expect(
      createOwnFood(a.client, a.id, {
        name: "Imposible",
        basis: "perPortion",
        basisGrams: 10,
        energyKcal: 200,
        proteinG: 1,
        carbsG: 1,
        fatG: 1,
        portions: [],
      }),
    ).rejects.toSatisfy((e: unknown) => e instanceof OwnFoodError && e.code === "VALIDATION" && e.field === "energyKcal");
  });
});
