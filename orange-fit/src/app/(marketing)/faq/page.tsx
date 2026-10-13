import type { Metadata } from "next";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { getAppSettings } from "@/lib/config/app-settings";
import { FaqList } from "@/features/marketing/components/faq-list";
import { JsonLd } from "@/features/marketing/components/json-ld";
import { markdownToPlainText } from "@/features/marketing/markdown";
import { getPublishedFaqs } from "@/features/marketing/queries";
import { faqPageJsonLd, pageMetadata } from "@/features/marketing/seo";

export async function generateMetadata(): Promise<Metadata> {
  const { appName } = await getAppSettings();
  return pageMetadata({
    title: "Preguntas frecuentes",
    description: `Respuestas sobre cómo funciona ${appName}: cálculo de calorías, datos de los alimentos, registro con IA, Premium, privacidad y más.`,
    path: "/faq",
    appName,
  });
}

/** Preguntas frecuentes publicadas desde el panel (`content_pages` kind 'faq'). */
export default async function FaqPage() {
  const [{ supportEmail }, faqs] = await Promise.all([getAppSettings(), getPublishedFaqs()]);

  return (
    <div className="mx-auto grid max-w-3xl gap-10 px-4 py-12 sm:px-6 lg:py-20">
      <header className="grid gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Preguntas frecuentes</h1>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Si no encuentras tu respuesta, escríbenos y te ayudamos.
        </p>
      </header>

      {!faqs.ok ? (
        <Alert variant="destructive">
          <AlertTitle>No pudimos cargar las preguntas frecuentes</AlertTitle>
          <AlertDescription>
            <p>Es un problema de nuestro lado. Vuelve a intentarlo en unos minutos.</p>
          </AlertDescription>
        </Alert>
      ) : faqs.data.length === 0 ? (
        <EmptyState title="Todavía no hay preguntas publicadas" description="Estamos preparando las respuestas más comunes." />
      ) : (
        <>
          <JsonLd
            data={faqPageJsonLd(faqs.data.map((item) => ({ question: item.question, answer: markdownToPlainText(item.answerMd) })))}
          />
          <FaqList items={faqs.data} headingLevel={2} />
        </>
      )}

      <section aria-labelledby="contacto" className="grid gap-2 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 id="contacto" className="font-semibold">
          ¿Te quedó alguna duda?
        </h2>
        {supportEmail ? (
          <p className="text-muted-foreground">
            Escríbenos a{" "}
            <a href={`mailto:${supportEmail}`} className="break-words font-medium text-primary-strong underline underline-offset-4">
              {supportEmail}
            </a>
            .
          </p>
        ) : (
          <p className="text-muted-foreground">El canal de contacto está pendiente de configurar.</p>
        )}
        <p className="text-sm text-muted-foreground">
          También puedes revisar los{" "}
          <Link href="/precios" className="font-medium text-primary-strong underline underline-offset-4">
            precios
          </Link>{" "}
          y las{" "}
          <Link href="/funciones" className="font-medium text-primary-strong underline underline-offset-4">
            funciones
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
