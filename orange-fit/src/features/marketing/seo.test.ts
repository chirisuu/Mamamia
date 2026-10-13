import { describe, expect, it } from "vitest";
import {
  DISALLOWED_PATHS,
  PUBLIC_ROUTES,
  absoluteUrl,
  buildRobots,
  buildSitemap,
  faqPageJsonLd,
  pageMetadata,
  serializeJsonLd,
  softwareApplicationJsonLd,
} from "./seo";

const BASE = "https://orange.example/";

/** Emula cómo un rastreador aplica Disallow: prefijo, o coincidencia exacta si termina en "$". */
function blocked(path: string): boolean {
  return DISALLOWED_PATHS.some((rule) => (rule.endsWith("$") ? path === rule.slice(0, -1) : path.startsWith(rule)));
}

describe("sitemap", () => {
  it("lista solo rutas públicas con URL absoluta", () => {
    const sitemap = buildSitemap(BASE, { lastModified: new Date("2026-10-13T00:00:00Z") });
    const urls = sitemap.map((entry) => entry.url);
    expect(urls).toEqual([
      "https://orange.example/",
      "https://orange.example/funciones",
      "https://orange.example/precios",
      "https://orange.example/faq",
      "https://orange.example/legal/terminos",
      "https://orange.example/legal/privacidad",
      "https://orange.example/legal/datos-de-salud",
    ]);
    for (const url of urls) {
      const path = new URL(url).pathname;
      expect(path).not.toMatch(/^\/(app|admin|api|auth|onboarding|compartido)(\/|$)/);
      expect(blocked(path)).toBe(false);
    }
    expect(sitemap[0]).toMatchObject({ priority: 1, changeFrequency: "weekly" });
    expect(sitemap.every((entry) => entry.lastModified instanceof Date)).toBe(true);
  });

  it("puede excluir legales en preparación", () => {
    const urls = buildSitemap(BASE, { exclude: ["/legal/terminos", "/legal/datos-de-salud"] }).map((e) => e.url);
    expect(urls).toContain("https://orange.example/legal/privacidad");
    expect(urls).not.toContain("https://orange.example/legal/terminos");
    expect(urls).not.toContain("https://orange.example/legal/datos-de-salud");
    expect(urls).toHaveLength(PUBLIC_ROUTES.length - 2);
  });

  it("arma URLs absolutas sin dobles barras", () => {
    expect(absoluteUrl("https://a.pe///", "/faq")).toBe("https://a.pe/faq");
    expect(absoluteUrl("https://a.pe", "faq")).toBe("https://a.pe/faq");
    expect(absoluteUrl("https://a.pe/", "/")).toBe("https://a.pe/");
  });
});

describe("robots", () => {
  const robots = buildRobots(BASE);
  const rules = Array.isArray(robots.rules) ? robots.rules[0]! : robots.rules;

  it("permite el sitio y bloquea /app, /admin, /api y /auth", () => {
    expect(rules.userAgent).toBe("*");
    expect(rules.allow).toBe("/");
    for (const path of ["/app", "/app/diario", "/app/perfil/datos", "/admin", "/admin/usuarios", "/api/foods/search", "/auth/confirm", "/onboarding", "/compartido/plan/abc", "/ingresar"]) {
      expect(blocked(path), path).toBe(true);
    }
  });

  it("no bloquea por accidente rutas públicas que empiezan igual", () => {
    for (const path of ["/", "/apple-touch-icon.png", "/funciones", "/precios", "/faq", "/legal/privacidad", "/manifest.webmanifest"]) {
      expect(blocked(path), path).toBe(false);
    }
  });

  it("apunta al sitemap absoluto", () => {
    expect(robots.sitemap).toBe("https://orange.example/sitemap.xml");
    expect(robots.host).toBe("https://orange.example");
  });
});

describe("metadatos por página", () => {
  it("incluye canonical, Open Graph con imagen y Twitter", () => {
    const meta = pageMetadata({ title: "Funciones", description: "Desc", path: "/funciones", appName: "ORANGE FIT" });
    expect(meta.title).toBe("Funciones");
    expect(meta.alternates?.canonical).toBe("/funciones");
    expect(meta.openGraph).toMatchObject({ url: "/funciones", siteName: "ORANGE FIT", title: "Funciones · ORANGE FIT", locale: "es_PE" });
    expect(JSON.stringify(meta.openGraph)).toContain("/opengraph-image");
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", title: "Funciones · ORANGE FIT" });
    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it("título absoluto y noindex cuando se pide", () => {
    const meta = pageMetadata({ title: "X: todo", description: "d", path: "/", appName: "X", absoluteTitle: true, noIndex: true });
    expect(meta.title).toEqual({ absolute: "X: todo" });
    expect(meta.robots).toEqual({ index: false, follow: true });
  });
});

describe("JSON-LD", () => {
  it("SoftwareApplication sin valoraciones ni reseñas inventadas", () => {
    const data = softwareApplicationJsonLd({
      appName: "ORANGE FIT",
      description: "d",
      url: "https://a.pe/",
      offers: [{ name: "Premium mensual", price: 29.9, priceCurrency: "PEN" }],
    });
    expect(data["@type"]).toBe("SoftwareApplication");
    expect(data).not.toHaveProperty("aggregateRating");
    expect(data).not.toHaveProperty("review");
    expect(data.offers).toEqual([{ "@type": "Offer", name: "Premium mensual", price: "29.90", priceCurrency: "PEN" }]);
  });

  it("sin precios leídos no hay ofertas", () => {
    expect(softwareApplicationJsonLd({ appName: "A", description: "d", url: "u", offers: [] })).not.toHaveProperty("offers");
  });

  it("FAQPage con preguntas y respuestas", () => {
    const data = faqPageJsonLd([{ question: "¿Qué es?", answer: "Una app." }]);
    expect(data.mainEntity).toEqual([{ "@type": "Question", name: "¿Qué es?", acceptedAnswer: { "@type": "Answer", text: "Una app." } }]);
  });

  it("el JSON serializado no puede cerrar la etiqueta <script>", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script> & \u2028\u2029" });
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain("&");
    expect(out).not.toMatch(/[\u2028\u2029]/);
    expect(JSON.parse(out)).toEqual({ name: "</script><script>alert(1)</script> & \u2028\u2029" });
  });
});
