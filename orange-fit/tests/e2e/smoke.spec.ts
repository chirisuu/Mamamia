import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { admin, createOnboardedUser, deleteUsers, login, todayInLima, type E2EUser } from "./helpers";

/**
 * Recorrido de humo a 390 px: cada pantalla con el rol que le corresponde. Por página exige
 * el estado HTTP esperado, ninguna excepción ni error de consola y nada que desborde a lo ancho.
 */
type Visit = { path: string; status?: number };

const NOT_FOUND = 404;
const ghost = randomUUID();

const PUBLIC: Visit[] = [
  { path: "/" },
  { path: "/?cuenta=eliminada" },
  { path: "/funciones" },
  { path: "/faq" },
  { path: "/precios" },
  { path: "/legal/terminos" },
  { path: "/legal/privacidad" },
  { path: "/legal/datos-de-salud" },
  { path: "/ingresar" },
  { path: "/registro" },
  { path: "/recuperar" },
  { path: "/verificar" },
  { path: "/onboarding" },
  { path: "/compartido/plan/no-existe", status: NOT_FOUND },
  { path: "/esta-ruta-no-existe", status: NOT_FOUND },
];

const DOCS = ["/robots.txt", "/sitemap.xml", "/manifest.webmanifest", "/opengraph-image"];

function appVisits(today: string, recipeSlug: string): Visit[] {
  return [
    { path: "/app" },
    { path: "/app/diario" },
    { path: `/app/diario/${today}` },
    { path: "/app/agregar" },
    { path: "/app/agregar/buscar" },
    { path: "/app/agregar/codigo" },
    { path: "/app/agregar/foto" },
    { path: "/app/agregar/texto" },
    { path: "/app/agregar/voz" },
    { path: "/app/agua" },
    { path: "/app/actividad" },
    { path: "/app/ayuno" },
    { path: "/app/alimentos" },
    { path: "/app/alimentos/nuevo" },
    { path: "/app/asistente" },
    { path: "/app/compras" },
    { path: "/app/logros" },
    { path: "/app/notificaciones" },
    { path: "/app/perfil" },
    { path: "/app/perfil/datos" },
    { path: "/app/perfil/metas" },
    { path: "/app/perfil/privacidad" },
    { path: "/app/perfil/profesional" },
    { path: "/app/perfil/suscripcion" },
    { path: "/app/plan" },
    { path: "/app/plan/nuevo" },
    { path: "/app/premium" },
    { path: "/app/progreso" },
    { path: "/app/progreso/fotos" },
    { path: "/app/recetas" },
    { path: `/app/recetas/${recipeSlug}` },
    { path: "/app/recetas/nueva" },
    { path: "/precios" },
    { path: `/app/alimentos/${ghost}`, status: NOT_FOUND },
    { path: `/app/compras/${ghost}`, status: NOT_FOUND },
    { path: `/app/plan/${ghost}`, status: NOT_FOUND },
    { path: "/app/recetas/no-existe", status: NOT_FOUND },
    { path: `/app/perfil/profesional/pacientes/${ghost}`, status: NOT_FOUND },
  ];
}

const ADMIN_STATIC = [
  "/admin",
  "/admin/usuarios",
  "/admin/alimentos",
  "/admin/alimentos/nuevo",
  "/admin/alimentos/verificacion",
  "/admin/alimentos/duplicados",
  "/admin/alimentos/importar",
  "/admin/alimentos/precios",
  "/admin/recetas",
  "/admin/recetas/nueva",
  "/admin/contenidos",
  "/admin/contenidos/nuevo",
  "/admin/planes",
  "/admin/ia",
  "/admin/configuracion",
  "/admin/auditoria",
  "/admin/errores",
];

/** Recorre las rutas en la misma página y junta todos los problemas (no se detiene en el primero). */
async function crawl(page: Page, visits: Visit[]): Promise<void> {
  const problems: string[] = [];
  let current = "";
  page.on("pageerror", (err) => problems.push(`${current} · excepción: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // El 404 del documento en rutas que deben dar 404 no es un error de la página.
    if (/status of 404/.test(text) && visits.find((v) => v.path === current)?.status === NOT_FOUND) return;
    problems.push(`${current} · consola: ${text}`);
  });

  for (const visit of visits) {
    current = visit.path;
    await test.step(visit.path, async () => {
      const res = await page.goto(visit.path, { waitUntil: "load" });
      // Una petición que no termina (p. ej. un reporte de error con keepalive) no debe colgar el recorrido.
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => problems.push(`${visit.path} · la red no queda en reposo`));
      const status = res?.status() ?? 0;
      const expected = visit.status ?? 200;
      // Con loading.tsx en el segmento, Next ya envió 200 cuando la página llama a notFound():
      // vale si se ve la pantalla de "no encontrado" (y lleva noindex).
      const streamedNotFound =
        expected === NOT_FOUND && status === 200 && (await page.getByRole("heading", { name: "No encontramos esta página" }).count()) > 0;
      if (status !== expected && !streamedNotFound) problems.push(`${visit.path} · HTTP ${status} (esperado ${expected})`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 1) problems.push(`${visit.path} · desborda ${overflow}px a lo ancho`);
    });
  }
  expect(problems, problems.join("\n")).toEqual([]);
}

test.describe("recorrido de humo a 390 px", () => {
  // Con el service worker activo, Playwright no ve terminar las peticiones que pasan por él y
  // "networkidle" nunca llega. El SW tiene su propia prueba (tests/unit/sw.test.ts).
  test.use({ serviceWorkers: "block" });
  // Cada test recorre decenas de pantallas: el límite es por recorrido, no por página.
  test.describe.configure({ mode: "serial", timeout: 10 * 60_000 });
  let premium: E2EUser | undefined;
  let free: E2EUser | undefined;
  let staff: E2EUser | undefined;
  let recipeSlug = "";
  let foodId = "";
  let recipeId = "";
  let contentId = "";

  test.beforeAll(async () => {
    [premium, free, staff] = await Promise.all([
      createOnboardedUser({ label: "humo-premium", premium: true }),
      createOnboardedUser({ label: "humo-gratis" }),
      createOnboardedUser({ label: "humo-admin", roles: ["admin"] }),
    ]);
    const db = admin();
    const [recipe, food, content] = await Promise.all([
      db.from("recipes").select("id, slug").eq("status", "published").order("slug").limit(1).single(),
      db.from("foods").select("id").eq("is_public", true).order("name").limit(1).single(),
      db.from("content_pages").select("id").order("slug").limit(1).single(),
    ]);
    recipeSlug = recipe.data!.slug;
    recipeId = recipe.data!.id;
    foodId = food.data!.id;
    contentId = content.data!.id;
  });
  test.afterAll(async () => deleteUsers(premium, free, staff));

  test("sitio público sin sesión", async ({ page }) => {
    await crawl(page, PUBLIC);
  });

  test("archivos de SEO y PWA", async ({ request }) => {
    for (const path of DOCS) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
    }
  });

  test("app con Premium", async ({ page }) => {
    await login(page, premium!);
    await crawl(page, appVisits(todayInLima(), recipeSlug));
  });

  test("app en plan gratis (pantallas con Premium muestran la invitación, no un error)", async ({ page }) => {
    await login(page, free!);
    await crawl(page, [
      { path: "/app" },
      { path: "/app/plan" },
      { path: "/app/plan/nuevo" },
      { path: "/app/compras" },
      { path: "/app/asistente" },
      { path: "/app/agregar/foto" },
      { path: "/app/agregar/texto" },
      { path: "/app/agregar/voz" },
      { path: "/app/recetas" },
      { path: "/app/premium" },
      { path: "/app/perfil/suscripcion" },
    ]);
  });

  test("panel admin", async ({ page }) => {
    await login(page, staff!, "/admin");
    await crawl(page, [
      ...ADMIN_STATIC.map((path) => ({ path })),
      { path: `/admin/alimentos/${foodId}` },
      { path: `/admin/recetas/${recipeId}` },
      { path: `/admin/contenidos/${contentId}` },
      { path: `/admin/alimentos/${ghost}`, status: NOT_FOUND },
    ]);
  });
});
