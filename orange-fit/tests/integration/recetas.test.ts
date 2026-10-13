/**
 * Recetas, planificador y lista de compras contra el Supabase LOCAL (RLS real):
 * recetas propias no visibles para otros, favoritos, registrar receta, guardar plan (nutrientes
 * calculados en el servidor), registrar comida del plan en el diario, generar lista de compras,
 * compartir y revocar el plan, y aislamiento entre usuarios.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateDraft, itemsWithPositions, planSlots } from "@/features/planner/lib/plan";
import { getActivePlanToday, getPlan, getPlannerContext, listPlans } from "@/features/planner/queries";
import { logPlanItem, PlanOpError, revokeShare, savePlan, setPlanStatus, sharePlan } from "@/features/planner/server/plans";
import { getFavoriteRecipeIds, getRecipeDetail, listCatalogRecipes, listPlannableRecipes } from "@/features/recipes/queries";
import { deleteRecipe, logRecipe, RecipeOpError, saveRecipe, setFavoriteRecipe } from "@/features/recipes/server/recipes";
import { getShoppingList, listShoppingLists } from "@/features/shopping/queries";
import { addManualItem, generateListFromPlan, ShoppingOpError, toggleItem, updateItem } from "@/features/shopping/server/shopping";
import type { SavePlanInput } from "@/features/planner/schemas";
import { anonClient, createTestUser, deleteTestUsers, serviceClient, type TestUser } from "./helpers";

const TODAY = "2026-10-13";

async function publicFoodId(name: string): Promise<string> {
  const { data, error } = await serviceClient().from("foods").select("id").eq("name", name).eq("is_public", true).limit(1).single();
  if (error || !data) throw new Error(`Falta el alimento público "${name}" (¿se cargó el seed?)`);
  return data.id;
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy(
    (e: unknown) => (e instanceof RecipeOpError || e instanceof PlanOpError || e instanceof ShoppingOpError) && e.code === code,
  );
}

describe("recetas, planes y compras (servidor con RLS)", () => {
  const admin = serviceClient();
  let a: TestUser;
  let b: TestUser;
  let arroz: string;
  let pollo: string;
  let ownRecipe: { id: string; slug: string };

  beforeAll(async () => {
    a = await createTestUser("recetas-a");
    b = await createTestUser("recetas-b");
    arroz = await publicFoodId("Arroz blanco cocido");
    pollo = await publicFoodId("Pechuga de pollo sin piel, a la plancha");
    // Meta y objetivo de A (como los deja el onboarding).
    const { error: tErr } = await admin.from("nutrition_targets").insert({
      user_id: a.id,
      effective_from: "2026-01-01",
      energy_kcal: 2000,
      protein_g: 120,
      carbs_g: 220,
      fat_g: 65,
      fiber_g: 28,
      water_ml: 2000,
      source: "auto",
    });
    if (tErr) throw tErr;
    const { error: gErr } = await admin.from("user_goals").insert({
      user_id: a.id,
      goal_type: "maintain",
      activity_level: "moderate",
      allergies: ["mani"],
      meals_per_day: 4,
      weekly_budget: 150,
      budget_currency: "PEN",
    });
    if (gErr) throw gErr;
  });

  afterAll(async () => {
    await deleteTestUsers([a, b]);
  });

  it("crea una receta propia (borrador) que solo ve su dueño", async () => {
    ownRecipe = await saveRecipe(a.client, a.id, {
      title: "Arroz con pollo de prueba",
      description: "Receta de integración",
      servings: 2,
      prepMinutes: 10,
      cookMinutes: 5,
      difficulty: "easy",
      steps: ["Mezcla todo.", "Sirve."],
      tags: ["prueba"],
      dietTags: [],
      allergens: [],
      mealTypes: ["lunch", "dinner"],
      ingredients: [
        { foodId: arroz, grams: 300, displayQuantity: 2, displayUnit: "taza" },
        { foodId: pollo, grams: 200 },
      ],
      intent: "draft",
    });
    expect(ownRecipe.slug).toMatch(/^arroz-con-pollo-de-prueba-[a-z0-9]{6}$/);

    const detail = await getRecipeDetail(a.client, a.id, ownRecipe.slug);
    expect(detail?.card.isOwn).toBe(true);
    expect(detail?.card.status).toBe("draft");
    expect(detail?.ingredients).toHaveLength(2);
    // Nutrición desde ingredientes: (300 g arroz × 130 + 200 g pollo × kcal) / 2 porciones, calculada por la vista.
    expect(detail?.card.perServing?.kcal).toBeGreaterThan(300);
    // Etiquetas calculadas: rápida (15 min) y alta en proteína.
    expect(detail?.card.dietTags).toEqual(expect.arrayContaining(["quick", "high_protein"]));

    expect((await listCatalogRecipes(a.client, a.id)).some((r) => r.id === ownRecipe.id)).toBe(true);
    // Otro usuario no la ve: ni en el catálogo, ni por slug, ni por id.
    expect((await listCatalogRecipes(b.client, b.id)).some((r) => r.id === ownRecipe.id)).toBe(false);
    expect(await getRecipeDetail(b.client, b.id, ownRecipe.slug)).toBeNull();
    const { data: direct } = await b.client.from("recipes").select("id").eq("id", ownRecipe.id);
    expect(direct).toEqual([]);
    const { data: ings } = await b.client.from("recipe_ingredients").select("id").eq("recipe_id", ownRecipe.id);
    expect(ings).toEqual([]);
  });

  it("enviar a revisión no la publica y otro usuario no puede editarla ni borrarla", async () => {
    await saveRecipe(a.client, a.id, {
      recipeId: ownRecipe.id,
      title: "Arroz con pollo de prueba",
      servings: 2,
      steps: ["Mezcla todo."],
      tags: [],
      dietTags: [],
      allergens: [],
      mealTypes: ["lunch"],
      ingredients: [{ foodId: arroz, grams: 250 }, { foodId: pollo, grams: 220 }],
      intent: "review",
    });
    const { data: row } = await admin.from("recipes").select("status, is_public, reviewed_by").eq("id", ownRecipe.id).single();
    expect(row).toEqual({ status: "pending_review", is_public: true, reviewed_by: null });
    expect((await listCatalogRecipes(b.client, b.id)).some((r) => r.id === ownRecipe.id)).toBe(false);
    const { count } = await admin.from("recipe_ingredients").select("id", { count: "exact", head: true }).eq("recipe_id", ownRecipe.id);
    expect(count).toBe(2);

    await expectCode(
      saveRecipe(b.client, b.id, {
        recipeId: ownRecipe.id,
        title: "Hackeo",
        servings: 1,
        steps: [],
        tags: [],
        dietTags: [],
        allergens: [],
        mealTypes: ["lunch"],
        ingredients: [{ foodId: arroz, grams: 100 }],
        intent: "draft",
      }),
      "NOT_FOUND",
    );
    await expectCode(deleteRecipe(b.client, b.id, ownRecipe.id), "NOT_FOUND");
  });

  it("favoritos de recetas", async () => {
    const official = (await listCatalogRecipes(a.client, a.id)).find((r) => r.isOfficial)!;
    expect(await setFavoriteRecipe(a.client, a.id, { recipeId: official.id, favorite: true })).toBe(true);
    // Repetir no falla.
    expect(await setFavoriteRecipe(a.client, a.id, { recipeId: official.id, favorite: true })).toBe(true);
    expect((await getFavoriteRecipeIds(a.client, a.id)).has(official.id)).toBe(true);
    expect((await getFavoriteRecipeIds(b.client, b.id)).has(official.id)).toBe(false);
    await setFavoriteRecipe(a.client, a.id, { recipeId: official.id, favorite: false });
    expect((await getFavoriteRecipeIds(a.client, a.id)).has(official.id)).toBe(false);
    // No se puede marcar una receta que no se ve.
    await expectCode(setFavoriteRecipe(b.client, b.id, { recipeId: ownRecipe.id, favorite: true }), "NOT_FOUND");
  });

  it("registra porciones de una receta en el diario con nutrientes del servidor", async () => {
    const official = (await listPlannableRecipes(a.client, a.id)).find((r) => r.isOfficial)!;
    await logRecipe(a.client, a.id, { recipeId: official.id, localDate: TODAY, mealType: "lunch", servings: 1.5 });
    const { data } = await a.client.from("meal_log_items").select("recipe_id, energy_kcal, source, data_provenance").eq("user_id", a.id).eq("recipe_id", official.id);
    expect(data).toHaveLength(1);
    expect(data![0]!.source).toBe("recipe");
    expect(data![0]!.data_provenance).toBe("recipe:calculated_from_ingredients");
    expect(Number(data![0]!.energy_kcal)).toBeCloseTo(official.perServing!.kcal * 1.5, 0);
  });

  describe("plan de comidas", () => {
    let planId: string;

    it("genera con el objetivo, guarda y recalcula nutrientes en el servidor", async () => {
      const ctx = await getPlannerContext(a.client, a.id, TODAY);
      expect(ctx.targets).toMatchObject({ targetKcal: 2000, proteinG: 120 });
      expect(ctx.defaults.avoidAllergens).toEqual(["mani"]);
      expect(ctx.defaults.weeklyBudget).toBe(150);
      expect(ctx.autoPlansBlocked).toBe(false);
      expect(ctx.pool.length).toBeGreaterThanOrEqual(30);
      // La receta propia en revisión también se puede planificar.
      expect(ctx.pool.some((r) => r.id === ownRecipe.id)).toBe(true);

      const draft = generateDraft({ pool: ctx.pool, params: ctx.defaults, days: 3, name: "Plan de prueba", startDate: TODAY, seed: "it-seed" });
      expect(draft.items).toHaveLength(3 * 4);
      const slots = planSlots(draft.params.mealsPerDay);
      const items = itemsWithPositions(draft).map((i) => ({
        dayIndex: i.dayIndex,
        slotIndex: i.slotIndex,
        mealType: slots[i.slotIndex]!.mealType,
        recipeId: i.recipeId,
        servings: i.servings,
      }));
      const input: SavePlanInput = {
        name: draft.name,
        startDate: draft.startDate,
        days: draft.days,
        generator: "engine",
        params: { ...draft.params, dietPattern: null },
        items,
      };
      const saved = await savePlan(a.client, a.id, input, { autoPlansBlocked: false });
      planId = saved.id;
      expect(saved.itemsCount).toBe(12);

      const plan = await getPlan(a.client, a.id, planId);
      expect(plan?.status).toBe("draft");
      expect(plan?.params.seed).toBe("it-seed");
      expect(plan?.items).toHaveLength(12);
      // Los nutrientes guardados salen de recipe_nutrition × porciones (no del cliente).
      const first = plan!.items[0]!;
      const { data: rn } = await admin.from("recipe_nutrition").select("per_serving_energy_kcal").eq("recipe_id", first.recipeId!).single();
      expect(first.kcal).toBeCloseTo(Number(rn!.per_serving_energy_kcal) * first.servings!, 1);
      expect((await listPlans(a.client, a.id)).map((p) => p.id)).toContain(planId);
    });

    it("bloquea la generación automática si el perfil lo exige, pero no el plan manual", async () => {
      const ctx = await getPlannerContext(a.client, a.id, TODAY);
      const base: SavePlanInput = { name: "Manual", startDate: TODAY, days: 1, generator: "engine", params: { ...ctx.defaults, dietPattern: null }, items: [] };
      await expectCode(savePlan(a.client, a.id, base, { autoPlansBlocked: true }), "BLOCKED");
      const manual = await savePlan(a.client, a.id, { ...base, generator: "manual" }, { autoPlansBlocked: true });
      expect(manual.itemsCount).toBe(0);
      await a.client.from("meal_plans").delete().eq("id", manual.id);
    });

    it("no acepta recetas ajenas privadas ni planes de otros", async () => {
      const ctxB = await getPlannerContext(b.client, b.id, TODAY);
      const input: SavePlanInput = {
        name: "Plan B",
        startDate: TODAY,
        days: 1,
        generator: "manual",
        params: { ...ctxB.defaults, dietPattern: null },
        items: [{ dayIndex: 0, slotIndex: 1, mealType: "lunch", recipeId: ownRecipe.id, servings: 1 }],
      };
      await expectCode(savePlan(b.client, b.id, input, { autoPlansBlocked: false }), "NOT_FOUND");
      const { count } = await admin.from("meal_plans").select("id", { count: "exact", head: true }).eq("user_id", b.id);
      expect(count).toBe(0);
      expect(await getPlan(b.client, b.id, planId)).toBeNull();
      await expectCode(savePlan(b.client, b.id, { ...input, planId, items: [] }, { autoPlansBlocked: false }), "NOT_FOUND");
    });

    it("activa el plan (deja uno solo activo) y registra una comida del plan en el diario", async () => {
      const other = await savePlan(
        a.client,
        a.id,
        { name: "Otro", startDate: TODAY, days: 1, generator: "manual", params: (await getPlan(a.client, a.id, planId))!.params as SavePlanInput["params"], items: [] },
        { autoPlansBlocked: false },
      );
      await setPlanStatus(a.client, a.id, other.id, "active");
      const res = await setPlanStatus(a.client, a.id, planId, "active");
      expect(res.archivedOthers).toBe(1);
      const { data: statuses } = await admin.from("meal_plans").select("id, status").eq("user_id", a.id);
      expect(statuses?.find((p) => p.id === planId)?.status).toBe("active");
      expect(statuses?.find((p) => p.id === other.id)?.status).toBe("archived");

      const today = await getActivePlanToday(a.client, a.id, TODAY);
      expect(today?.dayIndex).toBe(0);
      const item = today!.items[0]!;
      await logPlanItem(a.client, a.id, { itemId: item.id!, localDate: TODAY, mealType: "breakfast" });
      const { data } = await a.client.from("meal_log_items").select("source, recipe_id, energy_kcal").eq("user_id", a.id).eq("source", "plan");
      expect(data).toHaveLength(1);
      expect(data![0]!.recipe_id).toBe(item.recipeId);
      expect(Number(data![0]!.energy_kcal)).toBeCloseTo(item.kcal, 0);
      // Otro usuario no puede registrar comidas de este plan.
      await expectCode(logPlanItem(b.client, b.id, { itemId: item.id!, localDate: TODAY, mealType: "breakfast" }), "NOT_FOUND");
    });

    it("genera la lista de compras con precios referenciales y permite editarla", async () => {
      const res = await generateListFromPlan(a.client, a.id, planId);
      expect(res.itemsCount).toBeGreaterThan(3);
      const list = await getShoppingList(a.client, a.id, res.id);
      expect(list?.currency).toBe("PEN");
      // 150 PEN semanales × 3 días / 7.
      expect(list?.budget).toBeCloseTo(64.29, 2);
      const items = list!.categories.flatMap((c) => c.items);
      expect(items.some((i) => i.priceSource === "reference" && i.estimatedPrice! > 0)).toBe(true);
      expect(list!.categories.map((c) => c.code)).not.toContain(undefined);
      expect(list!.total).toBeGreaterThan(0);
      // Sin duplicados: un ítem por alimento.
      const foodIds = items.map((i) => i.foodId);
      expect(new Set(foodIds).size).toBe(foodIds.length);

      const target = items[0]!;
      await toggleItem(a.client, a.id, { itemId: target.id, checked: true });
      await updateItem(a.client, a.id, { itemId: target.id, quantity: 2, unit: "kg", estimatedPrice: 9.5, priceEdited: true });
      await addManualItem(a.client, a.id, { listId: res.id, name: "Limones extra", category: "fruits", quantity: 6, unit: "unidad", estimatedPrice: null });
      const after = await getShoppingList(a.client, a.id, res.id);
      const edited = after!.categories.flatMap((c) => c.items).find((i) => i.id === target.id)!;
      expect(edited).toMatchObject({ checked: true, quantity: 2, unit: "kg", estimatedPrice: 9.5, priceSource: "user" });
      expect(after!.itemsCount).toBe(items.length + 1);
      expect(after!.unpricedCount).toBeGreaterThanOrEqual(1);
      expect((await listShoppingLists(a.client, a.id))[0]!.id).toBe(res.id);

      // Aislamiento: B no ve la lista ni puede tocarla ni crear una desde el plan de A.
      expect(await getShoppingList(b.client, b.id, res.id)).toBeNull();
      await expectCode(toggleItem(b.client, b.id, { itemId: target.id, checked: false }), "NOT_FOUND");
      await expectCode(generateListFromPlan(b.client, b.id, planId), "NOT_FOUND");
    });

    it("comparte con token aleatorio (sin datos personales) y revoca", async () => {
      const { token } = await sharePlan(a.client, a.id, planId);
      expect(token).toMatch(/^[0-9a-f]{32}$/);
      const anon = anonClient();
      const { data, error } = await anon.rpc("get_shared_plan", { token });
      expect(error).toBeNull();
      const shared = data as Record<string, unknown>;
      expect(shared.name).toBe("Plan de prueba");
      expect(Array.isArray(shared.items) && shared.items.length).toBe(12);
      const text = JSON.stringify(shared);
      expect(text).not.toContain(a.id);
      expect(text).not.toContain(planId);
      expect(text).not.toContain(a.email);
      // Anónimo no lee la tabla directamente.
      const { data: direct } = await anon.from("meal_plans").select("id").eq("share_token", token);
      expect(direct).toEqual([]);
      // B no puede revocar el enlace de A.
      await expectCode(revokeShare(b.client, b.id, planId), "NOT_FOUND");

      await revokeShare(a.client, a.id, planId);
      const { data: afterRevoke } = await anon.rpc("get_shared_plan", { token });
      expect(afterRevoke).toBeNull();
      const { data: row } = await admin.from("meal_plans").select("share_token, shared_at").eq("id", planId).single();
      expect(row).toEqual({ share_token: null, shared_at: null });
    });
  });

  it("borrar la receta propia la quita del catálogo y deja el ítem del plan sin receta", async () => {
    await deleteRecipe(a.client, a.id, ownRecipe.id);
    expect(await getRecipeDetail(a.client, a.id, ownRecipe.slug)).toBeNull();
  });
});
