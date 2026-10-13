/**
 * Páginas del sitio público renderizadas a HTML con datos simulados: CTA reales, capturas con
 * tamaño y alt (o "en preparación" si faltan), JSON-LD sin valoraciones, aviso de cuenta eliminada,
 * legales en preparación vs publicados y estados vacío/error de las preguntas frecuentes.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CatalogView } from "@/features/billing/catalog-view";

const state = vi.hoisted(() => ({
  shots: { inicio: false, diario: false, "foto-ia": false, plan: false, progreso: false } as Record<string, boolean>,
  pricingOk: true,
  faqs: { ok: true, data: [] as Array<{ slug: string; question: string; answerMd: string }> } as
    | { ok: true; data: Array<{ slug: string; question: string; answerMd: string }> }
    | { ok: false },
  legal: { status: "unavailable" } as
    | { status: "published"; title: string; bodyMd: string; updatedAt: string }
    | { status: "unavailable" }
    | { status: "error" },
  supportEmail: "soporte@example.com" as string | null,
}));

const view: CatalogView = {
  free: { id: "free", name: "Gratis", description: null, features: [{ code: "manual_logging", label: "Registro manual", premium: false }], aiLimits: [] },
  premium: {
    id: "premium",
    name: "Premium",
    description: null,
    features: [{ code: "ai_photo", label: "Registro con foto e IA", premium: true }],
    aiLimits: [],
  },
  premiumPrices: [],
};

vi.mock("@/lib/config/app-settings", () => ({
  getAppSettings: async () => ({
    appName: "ORANGE FIT",
    supportEmail: state.supportEmail,
    featureFlags: {},
    defaultTrialDays: 7,
    maintenanceBanner: null,
  }),
}));
vi.mock("@/features/marketing/screenshots", () => ({ availableScreenshots: () => state.shots }));
vi.mock("@/features/marketing/queries", () => ({
  getPricingSummary: async () =>
    state.pricingOk
      ? {
          ok: true,
          data: {
            view,
            planFeatures: { free: ["manual_logging", "water"], premium: ["manual_logging", "ai_photo", "meal_plans"] },
            currency: "PEN",
            monthly: { amountCents: 2990, currency: "PEN" },
            yearly: { amountCents: 19990, currency: "PEN" },
            savings: { percent: 44 },
            trialDays: 7,
          },
        }
      : { ok: false },
  getPublishedFaqs: async () => state.faqs,
  getLegalDocument: async () => state.legal,
}));

const { default: LandingPage } = await import("@/app/(marketing)/page");
const { default: LegalPage } = await import("@/app/(marketing)/legal/[slug]/page");
const { default: FaqPage } = await import("@/app/(marketing)/faq/page");
const { default: FeaturesPage } = await import("@/app/(marketing)/funciones/page");

async function renderLanding(params: Record<string, string> = {}) {
  return renderToStaticMarkup(await LandingPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  state.shots = { inicio: false, diario: false, "foto-ia": false, plan: false, progreso: false };
  state.pricingOk = true;
  state.faqs = { ok: true, data: [] };
  state.legal = { status: "unavailable" };
  state.supportEmail = "soporte@example.com";
});

describe("portada", () => {
  it("CTA a crear cuenta (onboarding) e ingresar", async () => {
    const html = await renderLanding();
    expect(html).toContain('href="/onboarding"');
    expect(html).toContain('href="/ingresar"');
    expect(html).toContain('href="/precios"');
    expect(html).toContain('href="/funciones"');
    expect(html).toMatch(/<h1[^>]*>Come con intención/);
  });

  it("sin capturas generadas no rompe: muestra 'Captura en preparación' y ninguna <img>", async () => {
    const html = await renderLanding();
    expect(html).not.toContain("<img");
    expect(html).toContain("Captura en preparación");
  });

  it("con capturas: <img> real con ancho, alto y alt descriptivo", async () => {
    state.shots = { inicio: true, diario: true, "foto-ia": true, plan: true, progreso: true };
    const html = await renderLanding();
    const imgs = html.match(/<img[^>]*>/g) ?? [];
    expect(imgs).toHaveLength(5);
    for (const img of imgs) {
      expect(img).toMatch(/src="\/screenshots\/(inicio|diario|foto-ia|plan|progreso)\.png"/);
      expect(img).toContain('width="390"');
      expect(img).toContain('height="844"');
      expect(img).toMatch(/alt="[^"]{20,}"/);
    }
    // Solo la de la portada carga con prioridad.
    expect(imgs.filter((img) => img.includes('loading="eager"'))).toHaveLength(1);
  });

  it("precios desde la BD y JSON-LD sin valoraciones", async () => {
    const html = await renderLanding();
    expect(html).toContain("S/ 29.90");
    expect(html).toContain("S/ 199.90");
    const jsonLd = /<script type="application\/ld\+json">([^<]*)<\/script>/.exec(html)![1]!;
    const data = JSON.parse(jsonLd);
    expect(data["@type"]).toBe("SoftwareApplication");
    expect(data).not.toHaveProperty("aggregateRating");
    expect(data.offers.map((o: { price: string }) => o.price)).toEqual(["0.00", "29.90", "199.90"]);
  });

  it("sin precios: lo dice y no inventa montos", async () => {
    state.pricingOk = false;
    const html = await renderLanding();
    expect(html).toContain("No pudimos cargar los precios");
    expect(html).not.toContain("S/ 29.90");
    expect(html).not.toContain("&quot;offers&quot;");
  });

  it("aviso discreto tras eliminar la cuenta", async () => {
    expect(await renderLanding()).not.toContain("Tu cuenta fue eliminada");
    const html = await renderLanding({ cuenta: "eliminada" });
    expect(html).toContain("Tu cuenta fue eliminada");
    expect(html).toContain('role="status"');
  });

  it("no promete resultados ni muestra testimonios o cifras de usuarios", async () => {
    const html = (await renderLanding()).toLowerCase();
    for (const banned of ["garantiza", "garantizado", "pierde", "kilos en", "testimonio", "usuarios felices", "★", "estrellas"]) {
      expect(html, banned).not.toContain(banned);
    }
  });

  it("FAQ: muestra las publicadas o se oculta si no hay", async () => {
    expect(await renderLanding()).not.toContain("Lo que más nos preguntan");
    state.faqs = { ok: true, data: [{ slug: "faq-a", question: "¿Qué es?", answerMd: "Una **app**." }] };
    const html = await renderLanding();
    expect(html).toContain("¿Qué es?");
    expect(html).toContain("<strong");
  });
});

describe("/legal/[slug]", () => {
  const render = async (slug: string) => renderToStaticMarkup(await LegalPage({ params: Promise.resolve({ slug }) }));

  it("borrador o inexistente → 'Documento en preparación' con contacto, sin texto legal inventado", async () => {
    const html = await render("terminos");
    expect(html).toContain("Documento en preparación");
    expect(html).toContain("mailto:soporte@example.com");
    expect(html).toContain("Términos y condiciones");
  });

  it("sin correo configurado lo dice", async () => {
    state.supportEmail = null;
    expect(await render("privacidad")).toContain("pendiente de configurar");
  });

  it("datos de salud en preparación muestra el texto exacto de la autorización (versión vigente)", async () => {
    const html = await render("datos-de-salud");
    expect(html).toContain("Documento en preparación");
    expect(html).toContain("2026-10");
    expect(html).toContain("<blockquote");
  });

  it("publicado → su markdown seguro y la fecha de actualización", async () => {
    state.legal = { status: "published", title: "Política de privacidad", bodyMd: "## Datos\n\nTexto <script>x</script>", updatedAt: "2026-10-10T15:00:00Z" };
    const html = await render("privacidad");
    expect(html).not.toContain("Documento en preparación");
    expect(html).toContain("<h3");
    expect(html).not.toContain("<script>x");
    expect(html).toContain("Última actualización");
  });

  it("error de lectura → aviso de error, no 'en preparación'", async () => {
    state.legal = { status: "error" };
    expect(await render("terminos")).toContain("No pudimos cargar este documento");
  });
});

describe("/faq y /funciones", () => {
  it("FAQ vacía, con error y con preguntas", async () => {
    expect(renderToStaticMarkup(await FaqPage())).toContain("Todavía no hay preguntas publicadas");
    state.faqs = { ok: false };
    expect(renderToStaticMarkup(await FaqPage())).toContain("No pudimos cargar las preguntas frecuentes");
    state.faqs = { ok: true, data: [{ slug: "faq-a", question: "¿Puedo cancelar?", answerMd: "Sí." }] };
    const html = renderToStaticMarkup(await FaqPage());
    expect(html).toContain("¿Puedo cancelar?");
    expect(html).toContain("FAQPage");
  });

  it("funciones: las 12 de la portada y etiquetas de plan según la BD", async () => {
    const html = renderToStaticMarkup(await FeaturesPage());
    for (const title of ["Foto de tu plato", "Por voz", "Código de barras", "Plan de comidas", "Recetas", "Lista de compras", "Ayuno", "Agua", "Asistente nutricional"]) {
      expect(html, title).toContain(title);
    }
    expect(html).toContain("Premium");
    expect(html).toContain("Gratis");
  });
});
