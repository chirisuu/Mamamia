import { expect, test } from "@playwright/test";
import { admin, createOnboardedUser, deleteUsers, login, trackConsoleErrors, type E2EUser } from "./helpers";

test.describe("diario", () => {
  let user: E2EUser | undefined;
  test.beforeAll(async () => {
    user = await createOnboardedUser({ label: "diario" });
  });
  test.afterAll(async () => deleteUsers(user));

  test("buscar un alimento sin tildes, elegir porción y verlo en el diario con su procedencia", async ({ page }) => {
    const assertNoConsoleErrors = trackConsoleErrors(page);
    await login(page, user!);

    await page.goto("/app/agregar/buscar?comida=lunch");
    await page.getByLabel("Buscar alimento").fill("arroz blanco");
    const results = page.getByRole("region", { name: "Resultados" });
    const first = results.getByRole("button").filter({ hasText: /arroz/i }).first();
    await expect(first).toBeVisible();
    const foodName = (await first.locator("span.truncate").first().textContent())?.trim() ?? "";
    await first.click();

    const submit = page.getByRole("button", { name: /^Agregar a / });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByText(/^Agregado a /)).toBeVisible();

    await page.goto("/app/diario");
    await expect(page.getByText(foodName, { exact: false }).first()).toBeVisible();

    // El servidor calculó los nutrientes desde la base y guardó la procedencia.
    const { data: items } = await admin()
      .from("meal_log_items")
      .select("name, energy_kcal, food_id, data_provenance, source")
      .eq("user_id", user!.id);
    expect(items?.length).toBe(1);
    expect(items?.[0]?.food_id).toBeTruthy();
    expect(Number(items?.[0]?.energy_kcal)).toBeGreaterThan(0);
    expect(items?.[0]?.data_provenance).toBeTruthy();

    assertNoConsoleErrors();
  });
});
