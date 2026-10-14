import { expect, test } from "@playwright/test";
import { admin, createOnboardedUser, deleteUsers, login, type E2EUser } from "./helpers";

/**
 * Sin credenciales externas (Anthropic, Stripe, Mercado Pago) la app responde con error real y lo
 * dice; nunca simula un éxito. Y el ayuno no se ofrece a un perfil de riesgo.
 */
test.describe("integraciones sin credenciales y bloqueos de salud", () => {
  test.use({ serviceWorkers: "block" });
  let premium: E2EUser | undefined;
  let pregnant: E2EUser | undefined;

  test.beforeAll(async () => {
    [premium, pregnant] = await Promise.all([
      createOnboardedUser({ label: "integ-premium", premium: true }),
      createOnboardedUser({ label: "integ-embarazo", healthFlags: ["pregnant"] }),
    ]);
    const { error } = await admin()
      .from("consents")
      .insert({ user_id: premium!.id, consent_type: "ai_processing", version: "2026-10", granted: true });
    if (error) throw new Error(error.message);
  });
  test.afterAll(async () => deleteUsers(premium, pregnant));

  test("ayuno: un embarazo lo bloquea y no hay botón para iniciarlo", async ({ page }) => {
    await login(page, pregnant!);
    await page.goto("/app/ayuno");
    await expect(page.getByRole("heading", { name: "El ayuno no está disponible para ti en la app" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Iniciar ayuno/ })).toHaveCount(0);
  });

  test("IA: sin ANTHROPIC_API_KEY la API responde 503 y la pantalla lo dice", async ({ page }) => {
    await login(page, premium!);
    await page.goto("/app/agregar/texto");
    await expect(page.getByText("IA pendiente de configurar").first()).toBeVisible();
    const res = await page.evaluate(async () => {
      const r = await fetch("/api/ai/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "un pan con palta y un café", mode: "text" }),
      });
      return { status: r.status, body: (await r.json()) as { error?: { code?: string } } };
    });
    expect(res.status).toBe(503);
    expect(res.body.error?.code).toBe("AI_NOT_CONFIGURED");
    // Nada se registró en el diario.
    const { count } = await admin().from("meal_log_items").select("id", { count: "exact", head: true }).eq("user_id", premium!.id);
    expect(count).toBe(0);
  });

  test("pagos: sin claves del proveedor el checkout responde 503 y no crea suscripción", async ({ page }) => {
    await login(page, pregnant!);
    const { data: price } = await admin().from("plan_prices").select("id").eq("plan_id", "premium").limit(1).single();
    expect(price?.id).toBeTruthy();
    for (const provider of ["stripe", "mercadopago"] as const) {
      const res = await page.evaluate(
        async ({ priceId, provider }) => {
          const r = await fetch("/api/billing/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ priceId, provider }),
          });
          return { status: r.status, body: (await r.json()) as { error?: { code?: string }; url?: string } };
        },
        { priceId: price!.id, provider },
      );
      expect(res.status, provider).toBe(503);
      expect(res.body.url, provider).toBeUndefined();
    }
    const { count } = await admin().from("subscriptions").select("id", { count: "exact", head: true }).eq("user_id", pregnant!.id);
    expect(count).toBe(0);
  });
});
