import type { Metadata, MetadataRoute } from "next";

/**
 * SEO del sitio público: metadatos por página, sitemap, robots y JSON-LD.
 * Todo es puro (sin I/O) para poder probarlo; las páginas pasan el nombre vigente de la app.
 */

/** Rutas públicas indexables. /precios es del módulo de pagos, pero es pública y va en el sitemap. */
export const PUBLIC_ROUTES = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/funciones", changeFrequency: "monthly", priority: 0.8 },
  { path: "/precios", changeFrequency: "monthly", priority: 0.8 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.6 },
  { path: "/legal/terminos", changeFrequency: "yearly", priority: 0.3 },
  { path: "/legal/privacidad", changeFrequency: "yearly", priority: 0.3 },
  { path: "/legal/datos-de-salud", changeFrequency: "yearly", priority: 0.3 },
] as const satisfies ReadonlyArray<{
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
}>;

/**
 * Áreas que nunca se indexan: datos de cada persona (/app), panel (/admin), API y callbacks de
 * autenticación (/auth), el onboarding, las pantallas de acceso y los planes compartidos por enlace.
 * Las reglas de robots.txt son prefijos: "/app" a secas también bloquearía "/apple-touch-icon.png",
 * por eso /app va como ruta exacta ("$") más su subárbol ("/app/").
 */
export const DISALLOWED_PATHS = [
  "/app$",
  "/app/",
  "/admin",
  "/api/",
  "/auth/",
  "/onboarding",
  "/compartido/",
  "/ingresar",
  "/registro",
  "/recuperar",
  "/verificar",
  "/nueva-clave",
] as const;

/** Imagen OG generada por `src/app/opengraph-image.tsx`. */
export const OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630 } as const;

function normalizeBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function absoluteUrl(baseUrl: string, path: string): string {
  const base = normalizeBase(baseUrl);
  return path === "/" ? `${base}/` : `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Sitemap de las rutas públicas. `exclude` quita rutas que hoy no deben indexarse (p. ej. un legal
 * que sigue en preparación y lleva `noindex`).
 */
export function buildSitemap(
  baseUrl: string,
  { lastModified = new Date(), exclude = [] }: { lastModified?: Date; exclude?: readonly string[] } = {},
): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.filter((route) => !exclude.includes(route.path)).map((route) => ({
    url: absoluteUrl(baseUrl, route.path),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}

export function buildRobots(baseUrl: string): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...DISALLOWED_PATHS] }],
    sitemap: absoluteUrl(baseUrl, "/sitemap.xml"),
    host: normalizeBase(baseUrl),
  };
}

type PageMetadataInput = {
  /** Título de la página (el layout raíz le agrega "· {app}"), o absoluto si `absoluteTitle`. */
  title: string;
  description: string;
  /** Ruta canónica ("/faq"). Se resuelve contra `metadataBase` del layout raíz. */
  path: string;
  appName: string;
  absoluteTitle?: boolean;
  /** Páginas que no deben indexarse (p. ej. un legal todavía en preparación). */
  noIndex?: boolean;
};

/**
 * Metadatos completos de una página pública. Incluye la imagen OG explícitamente: si una página
 * define `openGraph`, Next reemplaza el del padre y se perdería la imagen del archivo raíz.
 */
export function pageMetadata({ title, description, path, appName, absoluteTitle = false, noIndex = false }: PageMetadataInput): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} · ${appName}`;
  const image = { ...OG_IMAGE, alt: `${appName}: registra lo que comes y sigue tu progreso` };
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "es_PE",
      url: path,
      siteName: appName,
      title: fullTitle,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
    },
    robots: noIndex ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export type JsonLdOffer = { name: string; price: number; priceCurrency: string };

/**
 * JSON-LD de la aplicación. Sin valoraciones ni reseñas (no las tenemos); las ofertas salen de
 * `plan_prices` y solo se incluyen si se pudieron leer.
 */
export function softwareApplicationJsonLd(input: {
  appName: string;
  description: string;
  url: string;
  offers?: JsonLdOffer[];
}): Record<string, unknown> {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: input.appName,
    description: input.description,
    url: input.url,
    applicationCategory: "HealthApplication",
    operatingSystem: "Web (navegador moderno; instalable como app)",
    inLanguage: "es-PE",
  };
  if (input.offers && input.offers.length > 0) {
    data.offers = input.offers.map((offer) => ({
      "@type": "Offer",
      name: offer.name,
      price: offer.price.toFixed(2),
      priceCurrency: offer.priceCurrency,
    }));
  }
  return data;
}

/** FAQPage para /faq, con el texto plano de cada respuesta. */
export function faqPageJsonLd(items: Array<{ question: string; answer: string }>): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/**
 * Serializa JSON-LD para un <script>: escapa "<", ">", "&" y los separadores de línea U+2028/2029
 * para que ningún texto (p. ej. una pregunta editada en el panel) pueda cerrar la etiqueta.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
