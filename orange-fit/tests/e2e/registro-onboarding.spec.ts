import { expect, test } from "@playwright/test";
import { admin, confirmationLinkFor, deleteUserByEmail, trackConsoleErrors, uniqueEmail } from "./helpers";

/**
 * Flujo principal: onboarding sin cuenta → registro → correo real (Mailpit) → confirmación →
 * guardado automático del plan → Inicio con la meta calculada.
 */
test.describe("registro con onboarding", () => {
  const email = uniqueEmail("registro");
  test.afterAll(async () => deleteUserByEmail(email));

  test("de las preguntas al panel, con verificación por correo", async ({ page }) => {
    const assertNoConsoleErrors = trackConsoleErrors(page);
    const next = () => page.getByRole("button", { name: /^(Empezar|Siguiente|Continuar)$/ }).click();
    const heading = page.getByRole("heading", { level: 1 });

    await page.goto("/onboarding");
    await expect(heading).toHaveText("Armemos tu plan");
    await next();
    await page.getByRole("textbox", { name: "¿Cómo te llamas?" }).fill("Ana");
    await next();
    await expect(heading).toHaveText("¿Cuándo naciste?");
    await page.locator('input[type="date"]').fill("1994-05-20");
    await next();
    await page.getByRole("radio", { name: /Mujer/ }).click();
    await next();
    await expect(heading).toHaveText("¿Cuánto mides?");
    await next(); // estatura por defecto
    await next(); // peso por defecto
    await next(); // peso objetivo = actual
    await page.getByRole("radio", { name: /Ligero/ }).click();
    await next();
    await next(); // sesiones
    await page.getByRole("radio", { name: /Perder grasa/ }).click();
    await next();
    await expect(heading).toHaveText("¿A qué ritmo quieres bajar?");
    await page.getByRole("radio", { name: /Moderado/ }).click();
    await next();
    await page.getByRole("radio", { name: /Como de todo/ }).click();
    await next();
    await next(); // alergias
    await next(); // restricciones
    await next(); // país y moneda
    await page.getByRole("button", { name: /Prefiero no indicarlo/ }).click();
    await next();
    await page.getByRole("radio", { name: /3 comidas/ }).click();
    await next();
    await page.getByRole("radio", { name: /Recién empiezo/ }).click();
    await next();
    await expect(heading).toHaveText("¿Alguna de estas situaciones aplica a ti?");
    await next();
    await expect(heading).toHaveText("Ana, este es tu punto de partida");
    await expect(page.getByText("Cómo lo calculamos")).toBeVisible();
    await next();
    await expect(heading).toHaveText("Tu permiso para guardar tu plan");
    await page.getByRole("checkbox", { name: /He leído y acepto/ }).click();
    await page.getByRole("checkbox", { name: /Autorizo de forma expresa/ }).click();
    await page.getByRole("button", { name: "Crea tu cuenta para guardar tu plan" }).click();

    await page.waitForURL("**/registro?from=onboarding");
    await page.getByLabel("¿Cómo te llamas?").fill("Ana");
    await page.getByLabel("Correo").fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill("Clave-segura-123");
    await page.getByRole("checkbox", { name: /He leído y acepto/ }).click();
    await page.getByRole("button", { name: "Crear cuenta y guardar mi plan" }).click();
    await page.waitForURL("**/verificar**");

    // Sin confirmar no hay sesión: /app manda a ingresar.
    const link = await confirmationLinkFor(email);
    expect(link).toContain("token_hash=");
    await page.goto(link);

    // /auth/confirm → /onboarding (guarda el borrador solo) → /app
    await page.waitForURL((url) => url.pathname === "/app", { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ana");

    // La meta quedó guardada con procedencia del cálculo y los consentimientos registrados.
    const db = admin();
    const { data: users } = await db.auth.admin.listUsers({ perPage: 200 });
    const userId = users.users.find((u) => u.email === email)?.id;
    expect(userId).toBeTruthy();
    const { data: targets } = await db.from("nutrition_targets").select("energy_kcal, source").eq("user_id", userId!);
    expect(targets?.length).toBe(1);
    expect(targets?.[0]?.source).toBe("auto");
    expect(targets?.[0]?.energy_kcal).toBeGreaterThanOrEqual(1200);
    const { data: consents } = await db.from("consents").select("consent_type, granted").eq("user_id", userId!);
    const granted = new Set((consents ?? []).filter((c) => c.granted).map((c) => c.consent_type));
    expect(granted.has("health_data")).toBe(true);
    expect(granted.has("terms")).toBe(true);

    assertNoConsoleErrors();
  });
});
