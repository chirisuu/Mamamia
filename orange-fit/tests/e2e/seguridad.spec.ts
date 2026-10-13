import { expect, test } from "@playwright/test";
import { createOnboardedUser, deleteUsers, login, type E2EUser } from "./helpers";

test.describe("acceso y roles", () => {
  let normal: E2EUser | undefined;
  let editor: E2EUser | undefined;
  test.beforeAll(async () => {
    [normal, editor] = await Promise.all([
      createOnboardedUser({ label: "sinrol" }),
      createOnboardedUser({ label: "editor", roles: ["editor"] }),
    ]);
  });
  test.afterAll(async () => deleteUsers(normal, editor));

  test("sin sesión, /app y /admin mandan a ingresar conservando el destino", async ({ page }) => {
    await page.goto("/app/diario");
    await expect(page).toHaveURL(/\/ingresar\?next=%2Fapp%2Fdiario$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/ingresar\?next=%2Fadmin$/);
  });

  test("una persona sin rol recibe 404 en /admin (no se revela que existe)", async ({ page }) => {
    await login(page, normal!);
    const res = await page.goto("/admin");
    expect(res?.status()).toBe(404);
  });

  test("un editor entra a /admin", async ({ page }) => {
    await login(page, editor!, "/admin");
    const res = await page.goto("/admin");
    expect(res?.status()).toBe(200);
  });

  test("las rutas de API de datos personales exigen sesión", async ({ request }) => {
    const res = await request.get("/api/foods/search?q=arroz");
    expect(res.status()).toBe(401);
    const exp = await request.get("/api/account/export");
    expect(exp.status()).toBe(401);
  });
});
