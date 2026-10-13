/**
 * Panel admin contra el Supabase LOCAL, llamando a las Server Actions y páginas reales (sin next dev):
 * - el rol se exige en cada página y acción (usuario normal → 404; editor no toca configuración ni planes);
 * - admin cambia configuración (incluidos los interruptores de pagos) y planes, y queda en la auditoría;
 * - superadmin otorga y quita roles;
 * - alimentos (crear, verificar, fusionar), recetas (moderación con aviso), contenidos, errores y USDA sin clave.
 * Crea usuarios con correo único y deja la configuración y los planes como estaban.
 */
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServerClient } from "@supabase/ssr";
import type { Database, Json } from "@/lib/db/database.types";
import { serviceClient, uniqueTag } from "./helpers";

const jar = vi.hoisted(() => ({ current: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [...jar.current].map(([name, value]) => ({ name, value })),
    get: (name: string) => (jar.current.has(name) ? { name, value: jar.current.get(name)! } : undefined),
    set: () => undefined,
  }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  usePathname: () => "/admin",
  useRouter: () => ({ refresh: () => undefined, push: () => undefined, replace: () => undefined }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const envFile = fileURLToPath(new URL("../../.env.local", import.meta.url));
for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
// La importación desde USDA debe responder "pendiente de configurar".
delete process.env.FDC_API_KEY;

type Session = { id: string; email: string; cookies: Map<string, string> };
type Role = Database["public"]["Enums"]["app_role"];

const admin = serviceClient();
const tag = uniqueTag();
const userIds: string[] = [];

async function session(label: string, roles: Role[] = []): Promise<Session> {
  const email = `it-admin-${label}-${tag}@example.com`;
  const password = `Pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
  userIds.push(data.user.id);
  if (roles.length) {
    const { error: rErr } = await admin.from("user_roles").insert(roles.map((role) => ({ user_id: data.user.id, role })));
    if (rErr) throw new Error(`roles: ${rErr.message}`);
  }
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
  return { id: data.user.id, email, cookies };
}

const as = (s: Session | null) => {
  jar.current = s ? s.cookies : new Map();
};
const html = async (node: Promise<React.ReactElement> | React.ReactElement) => renderToStaticMarkup(await node);
const sp = (v: Record<string, string> = {}) => ({ searchParams: Promise.resolve(v) });

async function auditFor(actorId: string, action: string) {
  const { data, error } = await admin.from("admin_audit_logs").select("*").eq("actor_id", actorId).eq("action", action).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

describe("panel admin (acciones y páginas reales)", () => {
  let normal: Session;
  let editor: Session;
  let adminUser: Session;
  let superadmin: Session;
  let settingsSnapshot: Array<{ key: string; value: NonNullable<Json> }> = [];
  let premiumSnapshot: { description: string | null } | null = null;
  const foodIds: string[] = [];
  const recipeIds: string[] = [];
  const priceIds: string[] = [];
  const contentIds: string[] = [];
  const errorIds: string[] = [];

  beforeAll(async () => {
    [normal, editor, adminUser, superadmin] = await Promise.all([
      session("normal"),
      session("editor", ["editor"]),
      session("admin", ["admin"]),
      session("super", ["superadmin"]),
    ]);
    const { data: settings, error } = await admin.from("app_settings").select("key, value");
    if (error) throw error;
    settingsSnapshot = settings ?? [];
    const { data: plan } = await admin.from("plans").select("description").eq("id", "premium").single();
    premiumSnapshot = plan;
  });

  afterAll(async () => {
    // Deja la configuración y el plan como estaban, aunque una prueba haya fallado a medias.
    if (settingsSnapshot.length) await admin.from("app_settings").upsert(settingsSnapshot, { onConflict: "key" });
    if (premiumSnapshot) await admin.from("plans").update({ description: premiumSnapshot.description }).eq("id", "premium");
    if (recipeIds.length) await admin.from("recipes").delete().in("id", recipeIds);
    await admin.storage.from("recipe-images").remove([`official/it-oficial-${tag}.webp`]);
    if (priceIds.length) await admin.from("plan_prices").delete().in("id", priceIds);
    if (contentIds.length) await admin.from("content_pages").delete().in("id", contentIds);
    if (errorIds.length) await admin.from("error_reports").delete().in("id", errorIds);
    if (foodIds.length) {
      await admin.from("user_favorites").delete().in("food_id", foodIds);
      await admin.from("foods").delete().in("id", foodIds);
    }
    // La auditoría de prueba se borra antes que las cuentas (al borrar una cuenta, actor_id queda null).
    await admin.from("admin_audit_logs").delete().in("actor_id", userIds);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  async function currentSettingsInput() {
    const { readSettings } = await import("@/features/admin/server/settings");
    const s = await readSettings(admin, "ORANGE FIT");
    return {
      appName: s.appName,
      supportEmail: s.supportEmail ?? "",
      defaultTrialDays: s.defaultTrialDays,
      maintenanceBanner: s.maintenanceBanner ?? "",
      featureFlags: s.featureFlags,
    };
  }

  it("sin sesión manda a ingresar; un usuario normal recibe 404 en páginas y acciones", async () => {
    const { default: AdminLayout } = await import("@/app/admin/layout");
    const { default: AdminDashboardPage } = await import("@/app/admin/page");
    const { default: AdminSettingsPage } = await import("@/app/admin/configuracion/page");
    const { saveSettingsAction } = await import("@/features/admin/actions/settings");
    const { saveFoodAction } = await import("@/features/admin/actions/foods");
    const { reviewRecipeAction } = await import("@/features/admin/actions/recipes");

    as(null);
    await expect(AdminDashboardPage()).rejects.toThrow("REDIRECT:/ingresar?next=%2Fadmin");

    as(normal);
    await expect(AdminLayout({ children: null })).rejects.toThrow("NOT_FOUND");
    await expect(AdminDashboardPage()).rejects.toThrow("NOT_FOUND");
    await expect(AdminSettingsPage()).rejects.toThrow("NOT_FOUND");
    await expect(saveSettingsAction(await currentSettingsInput())).rejects.toThrow("NOT_FOUND");
    await expect(saveFoodAction({} as never)).rejects.toThrow("NOT_FOUND");
    await expect(reviewRecipeAction({ recipeId: randomUUID(), decision: "publish" })).rejects.toThrow("NOT_FOUND");
  });

  it("editor: entra al panel, pero no puede cambiar configuración, planes ni roles", async () => {
    const { default: AdminDashboardPage } = await import("@/app/admin/page");
    const { default: AdminPlansPage } = await import("@/app/admin/planes/page");
    const { saveSettingsAction } = await import("@/features/admin/actions/settings");
    const { updatePlanAction, savePlanPriceAction } = await import("@/features/admin/actions/plans");
    const { setUserRoleAction } = await import("@/features/admin/actions/users");

    as(editor);
    const dashboard = await html(AdminDashboardPage());
    expect(dashboard).toContain("Pendientes");
    expect(dashboard).not.toContain("Uso y negocio");
    await expect(AdminPlansPage()).rejects.toThrow("NOT_FOUND");

    const input = await currentSettingsInput();
    await expect(saveSettingsAction({ ...input, maintenanceBanner: "editor no puede" })).rejects.toThrow("NOT_FOUND");
    await expect(
      updatePlanAction({ planId: "premium", name: "Hackeado", description: "", isActive: true, sortOrder: 1, premiumFeatures: [], aiLimits: { photo: 0, text: 0, voice: 0, chat: 0, plan: 0 } }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(
      savePlanPriceAction({ planId: "premium", interval: "month", currencyCode: "PEN", amountCents: 1, trialDays: 0, isActive: false }),
    ).rejects.toThrow("NOT_FOUND");
    await expect(setUserRoleAction({ userId: editor.id, role: "admin", grant: true })).rejects.toThrow("NOT_FOUND");

    // Además, la base lo impide aunque se saltara el servidor (RLS).
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const editorDb = await createSupabaseServerClient();
    const { data: touched } = await editorDb.from("app_settings").update({ value: "x" }).eq("key", "maintenance_banner").select("key");
    expect(touched ?? []).toHaveLength(0);
    const { data: plan } = await admin.from("plans").select("name").eq("id", "premium").single();
    expect(plan?.name).not.toBe("Hackeado");
    expect(await auditFor(editor.id, "settings.update")).toHaveLength(0);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", editor.id);
    expect(roles?.map((r) => r.role)).toEqual(["editor"]);
  });

  it("admin: cambia configuración e interruptores de pagos, y queda en la auditoría", async () => {
    const { saveSettingsAction } = await import("@/features/admin/actions/settings");
    const { default: AdminSettingsPage } = await import("@/app/admin/configuracion/page");
    as(adminUser);

    const page = await html(AdminSettingsPage());
    expect(page).toContain("Medios de pago");
    expect(page).toContain("Mercado Pago");
    expect(page).toContain("Tarjeta internacional (Stripe)");

    const before = await currentSettingsInput();
    const mp = before.featureFlags.find((f) => f.key === "payments_mercadopago");
    expect(mp).toBeDefined();
    const testFlag = `it_flag_${tag}`;
    const toggled = before.featureFlags.map((f) => (f.key === "payments_mercadopago" ? { ...f, enabled: !f.enabled } : f));
    const result = await saveSettingsAction({ ...before, featureFlags: [...toggled, { key: testFlag, enabled: true }] });
    expect(result).toEqual({ ok: true, data: { changed: ["feature_flags"] } });

    const { data: row } = await admin.from("app_settings").select("value").eq("key", "feature_flags").single();
    const flags = row?.value as Record<string, boolean>;
    expect(flags.payments_mercadopago).toBe(!mp!.enabled);
    expect(flags[testFlag]).toBe(true);

    const [audit] = await auditFor(adminUser.id, "settings.update");
    expect(audit).toMatchObject({ target_table: "app_settings", metadata: { keys: ["feature_flags"], flags: [testFlag, "payments_mercadopago"].sort() } });

    // Quitar los interruptores de pagos del formulario no los borra (equivaldría a encenderlos).
    const withoutPayments = before.featureFlags.filter((f) => !f.key.startsWith("payments_"));
    const restored = await saveSettingsAction({ ...before, featureFlags: [...withoutPayments, { key: "payments_mercadopago", enabled: mp!.enabled }] });
    expect(restored.ok).toBe(true);
    const { data: after } = await admin.from("app_settings").select("value").eq("key", "feature_flags").single();
    const afterFlags = after?.value as Record<string, boolean>;
    expect(afterFlags.payments_mercadopago).toBe(mp!.enabled);
    expect(afterFlags).toHaveProperty("payments_stripe");
    expect(afterFlags).not.toHaveProperty(testFlag);

    // Validación con Zod en el servidor.
    const bad = await saveSettingsAction({ ...before, supportEmail: "no-es-correo" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.fieldErrors?.supportEmail?.[0]).toBe("Escribe un correo válido.");
  });

  it("admin: edita un plan y crea un precio, con auditoría", async () => {
    const { updatePlanAction, savePlanPriceAction } = await import("@/features/admin/actions/plans");
    const { aiLimitsFromRow } = await import("@/features/admin/server/plans");
    as(adminUser);
    const { data: plan } = await admin.from("plans").select("*").eq("id", "premium").single();
    const premiumFeatures = plan!.features.filter((f) => !["manual_logging", "dashboard", "macros", "water", "basic_tracking"].includes(f));
    const input = {
      planId: "premium",
      name: plan!.name,
      description: `Prueba ${tag}`,
      isActive: plan!.is_active,
      sortOrder: plan!.sort_order,
      premiumFeatures: premiumFeatures as never,
      aiLimits: aiLimitsFromRow(plan!.ai_monthly_limits),
    };
    expect(await updatePlanAction(input)).toEqual({ ok: true, data: null });
    const { data: saved } = await admin.from("plans").select("description, features").eq("id", "premium").single();
    expect(saved?.description).toBe(`Prueba ${tag}`);
    // Las funciones base se conservan.
    expect(saved?.features).toEqual(plan!.features);
    expect(await auditFor(adminUser.id, "plan.update")).toHaveLength(1);
    expect((await updatePlanAction({ ...input, description: premiumSnapshot?.description ?? "" })).ok).toBe(true);

    const price = await savePlanPriceAction({
      planId: "premium",
      interval: "month",
      currencyCode: "EUR",
      amountCents: 999,
      trialDays: 0,
      stripePriceId: "",
      mercadopagoPlanId: "",
      isActive: false,
    });
    expect(price.ok).toBe(true);
    if (price.ok) priceIds.push(price.data.id);
    const [audit] = await auditFor(adminUser.id, "plan_price.create");
    expect(audit.metadata).toMatchObject({ plan_id: "premium", currency: "EUR", amount_cents: 999, is_active: false });

    const dup = await savePlanPriceAction({ planId: "premium", interval: "month", currencyCode: "PEN", amountCents: 100, trialDays: 0, isActive: true });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.code).toBe("CONFLICT");
  });

  it("superadmin otorga y quita roles (con auditoría); un admin no puede", async () => {
    const { setUserRoleAction } = await import("@/features/admin/actions/users");
    const { default: AdminDashboardPage } = await import("@/app/admin/page");

    as(adminUser);
    await expect(setUserRoleAction({ userId: normal.id, role: "editor", grant: true })).rejects.toThrow("NOT_FOUND");

    as(superadmin);
    expect(await setUserRoleAction({ userId: normal.id, role: "editor", grant: true })).toEqual({ ok: true, data: { changed: true } });
    const { data: granted } = await admin.from("user_roles").select("role, granted_by").eq("user_id", normal.id);
    expect(granted).toEqual([{ role: "editor", granted_by: superadmin.id }]);
    expect(await setUserRoleAction({ userId: normal.id, role: "editor", grant: true })).toEqual({ ok: true, data: { changed: false } });
    const superRole = await setUserRoleAction({ userId: normal.id, role: "superadmin" as never, grant: true });
    expect(superRole.ok).toBe(false);

    as(normal);
    expect(await html(AdminDashboardPage())).toContain("Pendientes");

    as(superadmin);
    expect(await setUserRoleAction({ userId: normal.id, role: "editor", grant: false })).toEqual({ ok: true, data: { changed: true } });
    const grants = await auditFor(superadmin.id, "user_role.grant");
    const revokes = await auditFor(superadmin.id, "user_role.revoke");
    expect(grants).toHaveLength(1);
    expect(revokes).toHaveLength(1);
    expect(grants[0]).toMatchObject({ target_table: "user_roles", target_id: normal.id, metadata: { role: "editor" } });

    as(normal);
    await expect(AdminDashboardPage()).rejects.toThrow("NOT_FOUND");
  });

  it("editor: crea, verifica y fusiona alimentos (reapunta recetas y favoritos)", async () => {
    const { saveFoodAction, setFoodVerificationAction, mergeFoodsAction } = await import("@/features/admin/actions/foods");
    as(editor);
    const food = (name: string, barcode: string | null) => ({
      name,
      brandName: "",
      foodType: "generic" as const,
      barcode,
      countryCodes: ["PE"],
      energyKcal: 120,
      proteinG: 4.4,
      carbsG: 21.3,
      fatG: 1.9,
      fiberG: 2.8,
      source: "curated" as const,
      sourceRef: "Tabla peruana de composición 2017",
      verificationStatus: "unverified" as const,
      isPublic: true,
      portions: [{ label: "1 taza", quantity: 1, unit: "taza", gramWeight: 185, isDefault: true }],
    });
    const a = await saveFoodAction(food(`IT quinua ${tag}`, null));
    const b = await saveFoodAction(food(`IT quinua cocida ${tag}`, `77${Date.now().toString().slice(-10)}`));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    foodIds.push(a.data.id, b.data.id);

    const invalidFood = await saveFoodAction({ ...food("IT malo", null), proteinG: 60, carbsG: 50 });
    expect(invalidFood.ok).toBe(false);

    expect(await setFoodVerificationAction({ foodId: a.data.id, status: "verified" })).toEqual({ ok: true, data: null });
    const { data: verified } = await admin.from("foods").select("verification_status, verified_by, verified_at, created_by").eq("id", a.data.id).single();
    expect(verified).toMatchObject({ verification_status: "verified", verified_by: editor.id, created_by: null });
    expect(verified?.verified_at).toBeTruthy();
    const { data: portions } = await admin.from("food_portions").select("label, gram_weight, is_default").eq("food_id", a.data.id);
    expect(portions).toEqual([{ label: "1 taza", gram_weight: 185, is_default: true }]);

    // Una receta oficial y un favorito usan el duplicado (b).
    const { data: recipe, error } = await admin
      .from("recipes")
      .insert({ title: `IT receta ${tag}`, slug: `it-receta-${tag}`, owner_id: null, status: "draft", is_public: true, servings: 1, steps: ["Mezclar."] })
      .select("id")
      .single();
    if (error) throw error;
    recipeIds.push(recipe.id);
    await admin.from("recipe_ingredients").insert({ recipe_id: recipe.id, food_id: b.data.id, grams: 100, position: 0 });
    await admin.from("user_favorites").insert({ user_id: normal.id, food_id: b.data.id });

    const merged = await mergeFoodsAction({ keepId: a.data.id, dropId: b.data.id });
    expect(merged.ok).toBe(true);
    if (merged.ok) expect(merged.data).toMatchObject({ recipe_ingredients: 1, favorites: 1, barcode_moved: true });
    const { data: ing } = await admin.from("recipe_ingredients").select("food_id").eq("recipe_id", recipe.id);
    expect(ing).toEqual([{ food_id: a.data.id }]);
    const { data: fav } = await admin.from("user_favorites").select("food_id").eq("user_id", normal.id);
    expect(fav).toEqual([{ food_id: a.data.id }]);
    const { data: dropped } = await admin.from("foods").select("is_public, verification_status, barcode").eq("id", b.data.id).single();
    expect(dropped).toEqual({ is_public: false, verification_status: "rejected", barcode: null });

    const [audit] = await auditFor(editor.id, "food.merge");
    expect(audit).toMatchObject({ target_id: a.data.id, metadata: { merged_id: b.data.id, recipe_ingredients: 1, favorites: 1 } });
    expect(await auditFor(editor.id, "food.create")).toHaveLength(2);
  });

  it("USDA sin FDC_API_KEY: responde «pendiente de configurar» sin importar nada", async () => {
    const { importUsdaAction } = await import("@/features/admin/actions/foods");
    const { default: UsdaImportPage } = await import("@/app/admin/alimentos/importar/page");
    as(editor);
    const page = await html(UsdaImportPage());
    expect(page).toContain("Importación pendiente de configurar");
    const result = await importUsdaAction({ mode: "query", query: "quinoa", limit: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("USDA_NOT_CONFIGURED");
      expect(result.error.message).toMatch(/pendiente de configurar/);
    }
    expect(await auditFor(editor.id, "food.usda_import")).toHaveLength(0);
  });

  it("editor modera recetas: rechazar exige motivo y el autor recibe el aviso", async () => {
    const { reviewRecipeAction } = await import("@/features/admin/actions/recipes");
    const { data: publicFood } = await admin.from("foods").select("id").eq("is_public", true).neq("verification_status", "rejected").limit(1).single();
    const mk = async (suffix: string) => {
      const { data, error } = await admin
        .from("recipes")
        .insert({ title: `IT usuario ${suffix} ${tag}`, slug: `it-usuario-${suffix}-${tag}`, owner_id: normal.id, status: "pending_review", servings: 2, steps: ["Paso."] })
        .select("id")
        .single();
      if (error) throw error;
      recipeIds.push(data.id);
      await admin.from("recipe_ingredients").insert({ recipe_id: data.id, food_id: publicFood!.id, grams: 150, position: 0 });
      return data.id;
    };
    const toReject = await mk("rechazo");
    const toPublish = await mk("publica");

    as(editor);
    const noNote = await reviewRecipeAction({ recipeId: toReject, decision: "reject", note: "no" });
    expect(noNote.ok).toBe(false);
    if (!noNote.ok) expect(noNote.error.code).toBe("VALIDATION");

    expect(await reviewRecipeAction({ recipeId: toReject, decision: "reject", note: "Agrega cantidades caseras a cada ingrediente." })).toEqual({ ok: true, data: { status: "rejected" } });
    expect(await reviewRecipeAction({ recipeId: toPublish, decision: "publish" })).toEqual({ ok: true, data: { status: "published" } });
    // Ya revisada: no se vuelve a moderar.
    const again = await reviewRecipeAction({ recipeId: toPublish, decision: "reject", note: "Otro motivo suficiente." });
    expect(again.ok).toBe(false);

    const { data: rows } = await admin.from("recipes").select("id, status, is_public, reviewed_by").in("id", [toReject, toPublish]);
    expect(rows?.find((r) => r.id === toPublish)).toMatchObject({ status: "published", is_public: true, reviewed_by: editor.id });
    expect(rows?.find((r) => r.id === toReject)).toMatchObject({ status: "rejected", reviewed_by: editor.id });

    const { data: notes } = await admin.from("notifications").select("type, body").eq("user_id", normal.id).in("type", ["recipe_rejected", "recipe_published"]);
    expect(notes?.map((n) => n.type).sort()).toEqual(["recipe_published", "recipe_rejected"]);
    expect(notes?.find((n) => n.type === "recipe_rejected")?.body).toContain("Agrega cantidades caseras");
    expect(await auditFor(editor.id, "recipe.reject")).toHaveLength(1);
    expect(await auditFor(editor.id, "recipe.publish")).toHaveLength(1);
  });

  it("editor: crea una receta oficial y sube su imagen a recipe-images/official/{slug}.webp", async () => {
    const { saveOfficialRecipeAction, uploadRecipeImageAction, removeRecipeImageAction } = await import("@/features/admin/actions/recipes");
    const sharp = (await import("sharp")).default;
    const { data: foods } = await admin.from("foods").select("id").eq("is_public", true).neq("verification_status", "rejected").limit(2);
    as(editor);
    const base = {
      title: `IT oficial ${tag}`,
      description: "Receta de prueba.",
      servings: 2,
      steps: ["Lava.", "Mezcla."],
      tags: ["prueba"],
      dietTags: ["vegetarian" as const],
      allergens: [],
      mealTypes: ["lunch" as const],
      costCurrency: "PEN",
      status: "draft" as const,
      ingredients: (foods ?? []).map((f) => ({ foodId: f.id, grams: 120 })),
    };
    const created = await saveOfficialRecipeAction(base);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    recipeIds.push(created.data.id);
    expect(created.data.slug).toBe(`it-oficial-${tag}`);

    // Un alimento privado no puede entrar en una receta oficial.
    const { data: own } = await admin.from("foods").insert({ name: `IT propio ${tag}`, created_by: normal.id, is_public: false, source: "user", energy_kcal: 100, protein_g: 1, carbs_g: 1, fat_g: 1 }).select("id").single();
    foodIds.push(own!.id);
    const withPrivate = await saveOfficialRecipeAction({ ...base, recipeId: created.data.id, ingredients: [{ foodId: own!.id, grams: 50 }] });
    expect(withPrivate.ok).toBe(false);
    if (!withPrivate.ok) expect(withPrivate.error.code).toBe("PRIVATE_FOODS");

    const published = await saveOfficialRecipeAction({ ...base, recipeId: created.data.id, status: "published" });
    expect(published.ok).toBe(true);
    const { data: row } = await admin.from("recipes").select("status, is_public, owner_id, reviewed_by").eq("id", created.data.id).single();
    expect(row).toEqual({ status: "published", is_public: true, owner_id: null, reviewed_by: editor.id });

    const png = await sharp({ create: { width: 800, height: 800, channels: 3, background: { r: 255, g: 107, b: 0 } } }).png().toBuffer();
    const form = new FormData();
    form.set("recipeId", created.data.id);
    form.set("file", new Blob([new Uint8Array(png)], { type: "image/png" }), "foto.png");
    const uploaded = await uploadRecipeImageAction(form);
    expect(uploaded.ok).toBe(true);
    const path = `official/it-oficial-${tag}.webp`;
    if (uploaded.ok) expect(uploaded.data.imagePath).toBe(path);
    const { data: file, error: dlError } = await admin.storage.from("recipe-images").download(path);
    expect(dlError).toBeNull();
    const meta = await sharp(Buffer.from(await file!.arrayBuffer())).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 1200, height: 900 });

    const notImage = new FormData();
    notImage.set("recipeId", created.data.id);
    notImage.set("file", new Blob([new TextEncoder().encode("hola")], { type: "image/png" }), "x.png");
    const bad = await uploadRecipeImageAction(notImage);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe("INVALID_IMAGE");

    expect(await removeRecipeImageAction({ id: created.data.id })).toEqual({ ok: true, data: null });
    const { data: after } = await admin.from("recipes").select("image_path").eq("id", created.data.id).single();
    expect(after?.image_path).toBeNull();
    const { data: listed } = await admin.storage.from("recipe-images").list("official", { search: `it-oficial-${tag}` });
    expect(listed ?? []).toHaveLength(0);
    const actions = (await admin.from("admin_audit_logs").select("action").eq("actor_id", editor.id).like("action", "recipe.%")).data?.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["recipe.create", "recipe.update", "recipe.image_upload", "recipe.image_remove"]));
  });

  it("contenidos: crear, publicar, reordenar y borrar con auditoría", async () => {
    const { saveContentPageAction, setContentStatusAction, moveContentPageAction, deleteContentPageAction } = await import("@/features/admin/actions/content");
    as(editor);
    const created = await saveContentPageAction({ slug: `it-${tag}`, title: "Artículo de prueba", kind: "article", status: "draft", sortOrder: 5, bodyMd: "# Hola\n\n<script>x</script>" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    contentIds.push(created.data.id);
    const conflict = await saveContentPageAction({ slug: `it-${tag}`, title: "Otro", kind: "article", status: "draft", sortOrder: 6, bodyMd: "" });
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) expect(conflict.error.code).toBe("CONFLICT");

    expect((await setContentStatusAction({ id: created.data.id, status: "published" })).ok).toBe(true);
    expect((await moveContentPageAction({ id: created.data.id, direction: "down" })).ok).toBe(true);
    const { data: page } = await admin.from("content_pages").select("status, body_md").eq("id", created.data.id).single();
    expect(page).toEqual({ status: "published", body_md: "# Hola\n\n<script>x</script>" });
    expect((await deleteContentPageAction({ id: created.data.id })).ok).toBe(true);
    const actions = (await admin.from("admin_audit_logs").select("action").eq("actor_id", editor.id).like("action", "content.%")).data?.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["content.create", "content.status", "content.delete"]));
  });

  it("errores: admin cambia el estado; el editor no puede", async () => {
    const { setErrorStatusAction } = await import("@/features/admin/actions/errors");
    const { data: report, error } = await admin.from("error_reports").insert({ message: `IT error ${tag}`, route: "/app/diario", status: "new" }).select("id").single();
    if (error) throw error;
    errorIds.push(report.id);

    as(editor);
    await expect(setErrorStatusAction({ id: report.id, status: "resolved" })).rejects.toThrow("NOT_FOUND");
    as(adminUser);
    expect(await setErrorStatusAction({ id: report.id, status: "triaged" })).toEqual({ ok: true, data: null });
    const { data: saved } = await admin.from("error_reports").select("status").eq("id", report.id).single();
    expect(saved?.status).toBe("triaged");
    expect(await auditFor(adminUser.id, "error_report.status")).toHaveLength(1);
  });

  it("las páginas del panel se renderizan con datos reales y sin datos de salud", async () => {
    as(adminUser);
    const pages: Array<[string, () => Promise<React.ReactElement>, string]> = [
      ["dashboard", async () => (await import("@/app/admin/page")).default(), "Uso y negocio"],
      ["usuarios", async () => (await import("@/app/admin/usuarios/page")).default(sp({ q: adminUser.email })), adminUser.email],
      ["auditoría", async () => (await import("@/app/admin/auditoria/page")).default(sp()), "Configuración actualizada"],
      ["errores", async () => (await import("@/app/admin/errores/page")).default(sp({ estado: "todos" })), `IT error ${tag}`],
      ["ia", async () => (await import("@/app/admin/ia/page")).default(sp()), "Solicitudes por mes"],
      ["alimentos", async () => (await import("@/app/admin/alimentos/page")).default(sp({ q: `IT quinua ${tag}` })), `IT quinua ${tag}`],
      ["verificación", async () => (await import("@/app/admin/alimentos/verificacion/page")).default(sp()), "Cola de verificación"],
      ["duplicados", async () => (await import("@/app/admin/alimentos/duplicados/page")).default(sp()), "Posibles duplicados"],
      ["precios", async () => (await import("@/app/admin/alimentos/precios/page")).default(sp()), "Precios referenciales"],
      ["recetas", async () => (await import("@/app/admin/recetas/page")).default(sp({ q: tag })), `IT usuario rechazo ${tag}`],
      ["contenidos", async () => (await import("@/app/admin/contenidos/page")).default(sp()), "Preguntas frecuentes"],
      ["planes", async () => (await import("@/app/admin/planes/page")).default(), "Agregar precio"],
    ];
    for (const [name, render, expected] of pages) {
      const out = await html(render());
      expect(out, name).toContain(expected);
      expect(out, name).not.toMatch(/weight_kg|birth_date|health_flags/);
    }
    const users = await html((await import("@/app/admin/usuarios/page")).default(sp({ q: adminUser.email })));
    expect(users).not.toContain(normal.email);

    const { default: AdminRecipePage } = await import("@/app/admin/recetas/[id]/page");
    const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
    const withQuery = async (node: Promise<React.ReactElement>) =>
      renderToStaticMarkup(React.createElement(QueryClientProvider, { client: new QueryClient() }, await node));
    const { data: mine } = await admin.from("recipes").select("id, owner_id").in("id", recipeIds);
    const userRecipe = mine?.find((r) => r.owner_id === normal.id);
    const official = mine?.find((r) => r.owner_id === null);
    const detail = await withQuery(AdminRecipePage({ params: Promise.resolve({ id: userRecipe!.id }) }));
    expect(detail).toContain("Receta de usuario");
    expect(detail).toContain("Nota de la revisión");
    const officialPage = await withQuery(AdminRecipePage({ params: Promise.resolve({ id: official!.id }) }));
    expect(officialPage).toContain("Receta oficial");
    expect(officialPage).toContain("Subir imagen");
    await expect(AdminRecipePage({ params: Promise.resolve({ id: "no-es-uuid" }) })).rejects.toThrow("NOT_FOUND");
  });
});
