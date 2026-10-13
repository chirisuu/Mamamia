import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";
import { LEGAL_DOCS, type LegalSlug } from "@/features/marketing/content";
import { getPublishedLegalSlugs } from "@/features/marketing/queries";
import { buildSitemap } from "@/features/marketing/seo";

/** /sitemap.xml: rutas públicas. Los legales en preparación (con noindex) no se listan. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const published = await getPublishedLegalSlugs();
  const exclude = published
    ? (Object.keys(LEGAL_DOCS) as LegalSlug[]).filter((slug) => !published.includes(slug)).map((slug) => `/legal/${slug}`)
    : [];
  return buildSitemap(siteUrl(), { exclude });
}
