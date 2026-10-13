import "server-only";
import { getAppSettings } from "@/lib/config/app-settings";
import { getBillingCatalog } from "@/lib/billing/catalog";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildCatalogView, primaryCurrency, priceFor, savingsFor, type CatalogView } from "@/features/billing/catalog-view";
import type { AnnualSavings } from "@/lib/billing/pricing";
import type { LegalSlug } from "./content";

/**
 * Lecturas del sitio público. Todas usan el cliente de servidor (RLS: anon solo ve lo publicado) y
 * nunca inventan contenido: si la BD falla, devuelven un estado de error y la página lo dice.
 */

export type FaqItem = { slug: string; question: string; answerMd: string };
export type Loaded<T> = { ok: true; data: T } | { ok: false };

/** Preguntas frecuentes publicadas (`content_pages` kind 'faq'), en su orden. */
export async function getPublishedFaqs(limit?: number): Promise<Loaded<FaqItem[]>> {
  if (!isSupabaseConfigured()) return { ok: false };
  try {
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("content_pages")
      .select("slug, title, body_md")
      .eq("kind", "faq")
      // Explícito: el staff también puede leer borradores por RLS y no deben salir al público.
      .eq("status", "published")
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true });
    if (limit) query = query.limit(limit);
    const { data, error } = await query;
    if (error) return { ok: false };
    return { ok: true, data: (data ?? []).map((row) => ({ slug: row.slug, question: row.title, answerMd: row.body_md })) };
  } catch {
    return { ok: false };
  }
}

export type LegalDocument =
  | { status: "published"; title: string; bodyMd: string; updatedAt: string }
  | { status: "unavailable" }
  | { status: "error" };

/**
 * Documento legal publicado. Un borrador cuenta como no disponible: nunca mostramos un texto legal
 * en preparación como si fuera el definitivo.
 */
export async function getLegalDocument(slug: LegalSlug): Promise<LegalDocument> {
  if (!isSupabaseConfigured()) return { status: "error" };
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("content_pages")
      .select("title, body_md, updated_at")
      .eq("slug", slug)
      .eq("kind", "legal")
      .eq("status", "published")
      .maybeSingle();
    if (error) return { status: "error" };
    if (!data || !data.body_md.trim()) return { status: "unavailable" };
    return { status: "published", title: data.title, bodyMd: data.body_md, updatedAt: data.updated_at };
  } catch {
    return { status: "error" };
  }
}

export type PricingSummary = {
  view: CatalogView;
  /** Funciones (claves de `plans.features`) de cada plan, para las etiquetas Gratis/Premium. */
  planFeatures: { free: string[]; premium: string[] };
  currency: string | null;
  monthly: { amountCents: number; currency: string } | null;
  yearly: { amountCents: number; currency: string } | null;
  savings: AnnualSavings | null;
  trialDays: number;
};

/** Planes y precios activos (`plans` + `plan_prices`), en la moneda principal (soles si hay). */
export async function getPricingSummary(): Promise<Loaded<PricingSummary>> {
  if (!isSupabaseConfigured()) return { ok: false };
  try {
    const [supabase, settings] = await Promise.all([createSupabaseServerClient(), getAppSettings()]);
    const catalog = await getBillingCatalog(supabase);
    const view = buildCatalogView(catalog, settings.defaultTrialDays);
    const currency = primaryCurrency(view.premiumPrices);
    const month = currency ? priceFor(view.premiumPrices, "month", currency) : null;
    const year = currency ? priceFor(view.premiumPrices, "year", currency) : null;
    const featuresOf = (id: string) => catalog.plans.find((p) => p.id === id)?.features ?? [];
    return {
      ok: true,
      data: {
        view,
        planFeatures: { free: featuresOf("free"), premium: featuresOf("premium") },
        currency,
        monthly: month ? { amountCents: month.amountCents, currency: month.currency } : null,
        yearly: year ? { amountCents: year.amountCents, currency: year.currency } : null,
        savings: currency ? savingsFor(view.premiumPrices, currency) : null,
        trialDays: Math.max(month?.trialDays ?? 0, year?.trialDays ?? 0),
      },
    };
  } catch {
    return { ok: false };
  }
}
