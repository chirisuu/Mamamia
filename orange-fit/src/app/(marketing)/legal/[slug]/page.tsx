import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getAppSettings } from "@/lib/config/app-settings";
import { localDateInTz } from "@/lib/dates";
import { formatLongDate } from "@/lib/format";
import { CONSENT_VERSION, HEALTH_DATA_CONSENT_TEXT } from "@/features/auth/consents";
import { Markdown } from "@/features/marketing/markdown";
import { LEGAL_DOCS, isLegalSlug, type LegalSlug } from "@/features/marketing/content";
import { getLegalDocument } from "@/features/marketing/queries";
import { pageMetadata } from "@/features/marketing/seo";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isLegalSlug(slug)) return {};
  const [{ appName }, doc] = await Promise.all([getAppSettings(), getLegalDocument(slug)]);
  return pageMetadata({
    title: LEGAL_DOCS[slug].title,
    description: LEGAL_DOCS[slug].description,
    path: `/legal/${slug}`,
    appName,
    // Un documento en preparación no debe quedar indexado como si fuera el texto vigente.
    noIndex: doc.status !== "published",
  });
}

/**
 * Documentos legales. Solo se muestra el texto PUBLICADO en el panel (`content_pages` kind 'legal');
 * si está en borrador o no existe, decimos que está en preparación: nunca un texto inventado.
 */
export default async function LegalPage({ params }: PageProps) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();

  const [{ appName, supportEmail }, doc] = await Promise.all([getAppSettings(), getLegalDocument(slug)]);
  const meta = LEGAL_DOCS[slug];

  return (
    <article className="mx-auto grid max-w-3xl gap-8 px-4 py-12 sm:px-6 lg:py-16">
      <header className="grid gap-3">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary-strong">Legal</p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {doc.status === "published" ? doc.title : meta.title}
        </h1>
        {doc.status === "published" ? (
          <p className="text-sm text-muted-foreground">
            Última actualización: {formatLongDate(localDateInTz(new Date(doc.updatedAt), "America/Lima"))}
          </p>
        ) : null}
      </header>

      {doc.status === "published" ? (
        <Markdown source={doc.bodyMd} />
      ) : doc.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>No pudimos cargar este documento</AlertTitle>
          <AlertDescription>
            <p>Es un problema de nuestro lado. Vuelve a intentarlo en unos minutos.</p>
          </AlertDescription>
        </Alert>
      ) : (
        <InPreparation slug={slug} appName={appName} supportEmail={supportEmail} />
      )}

      <nav aria-label="Otros documentos legales" className="border-t border-border pt-6">
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {(Object.keys(LEGAL_DOCS) as LegalSlug[])
            .filter((other) => other !== slug)
            .map((other) => (
              <li key={other}>
                <Link href={`/legal/${other}`} className="font-medium text-primary-strong underline underline-offset-4">
                  {LEGAL_DOCS[other].title}
                </Link>
              </li>
            ))}
        </ul>
      </nav>
    </article>
  );
}

function InPreparation({ slug, appName, supportEmail }: { slug: LegalSlug; appName: string; supportEmail: string | null }) {
  return (
    <div className="grid gap-6">
      <div role="status" className="grid gap-3 rounded-2xl border border-dashed border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary-strong" aria-hidden="true">
            <FileText className="size-5" />
          </span>
          <h2 className="text-lg font-semibold">Documento en preparación</h2>
        </div>
        <p className="leading-relaxed text-muted-foreground">
          Estamos terminando la versión definitiva de este documento de {appName}. La publicaremos en esta página en cuanto
          esté lista.
        </p>
        {supportEmail ? (
          <p className="leading-relaxed text-muted-foreground">
            Si tienes preguntas sobre cómo tratamos tus datos, escríbenos a{" "}
            <a href={`mailto:${supportEmail}`} className="break-words font-medium text-primary-strong underline underline-offset-4">
              {supportEmail}
            </a>
            .
          </p>
        ) : (
          <p className="leading-relaxed text-muted-foreground">El canal de contacto está pendiente de configurar.</p>
        )}
      </div>

      {slug === "datos-de-salud" ? (
        <section aria-labelledby="texto-autorizacion" className="grid gap-3">
          <h2 id="texto-autorizacion" className="text-lg font-semibold">
            Texto de la autorización que se pide en la app
          </h2>
          <p className="text-sm text-muted-foreground">
            Es el texto exacto que aceptas al crear tu plan (versión {CONSENT_VERSION}). Puedes retirar la autorización cuando
            quieras desde Perfil → Privacidad.
          </p>
          <blockquote className="border-l-4 border-primary/60 pl-4 leading-relaxed">{HEALTH_DATA_CONSENT_TEXT}</blockquote>
        </section>
      ) : null}
    </div>
  );
}
