import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAppSettings } from "@/lib/config/app-settings";
import { FeatureCard } from "@/features/marketing/components/feature-card";
import { Reveal } from "@/features/marketing/components/reveal";
import { PointList, SectionHeading } from "@/features/marketing/components/section";
import { FEATURE_GROUPS, planBadgeFor } from "@/features/marketing/content";
import { getPricingSummary } from "@/features/marketing/queries";
import { pageMetadata } from "@/features/marketing/seo";

const DESCRIPTION =
  "Registro por búsqueda, código de barras, foto, voz o texto; planes de comida, recetas y lista de compras; peso, medidas, agua, ayuno, actividad y un asistente nutricional.";

export async function generateMetadata(): Promise<Metadata> {
  const { appName } = await getAppSettings();
  return pageMetadata({ title: "Funciones", description: DESCRIPTION, path: "/funciones", appName });
}

/** Todas las funciones, agrupadas, con el plan que las incluye según la BD. */
export default async function FeaturesPage() {
  const [{ appName }, pricing] = await Promise.all([getAppSettings(), getPricingSummary()]);
  const plans = pricing.ok ? pricing.data.planFeatures : null;

  return (
    <div className="mx-auto grid max-w-6xl gap-16 px-4 py-12 sm:px-6 lg:py-20">
      <header className="grid max-w-3xl gap-4">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary-strong">Funciones</p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">Todo lo que hace {appName}</h1>
        <p className="text-lg leading-relaxed text-muted-foreground">
          Registrar lo que comes, planificar tu semana y seguir tu progreso.{" "}
          {plans
            ? "Cada función indica si está en el plan Gratis o en Premium."
            : "Revisa en la página de precios qué incluye cada plan."}
        </p>
        <nav aria-label="Secciones de funciones">
          <ul className="flex flex-wrap gap-2">
            {FEATURE_GROUPS.map((group) => (
              <li key={group.id}>
                <a
                  href={`#${group.id}`}
                  className="inline-flex h-11 items-center rounded-full border border-border bg-card px-4 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {group.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {FEATURE_GROUPS.map((group) => (
        <section key={group.id} aria-labelledby={group.id} className="grid gap-8">
          <SectionHeading id={group.id} title={group.title} intro={group.intro} />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.features.map((feature, index) => (
              <Reveal as="li" key={feature.id} delay={(index % 3) * 0.05}>
                <FeatureCard feature={feature} badge={planBadgeFor(feature, plans)} />
              </Reveal>
            ))}
          </ul>
        </section>
      ))}

      <section aria-labelledby="como-calculamos" className="grid gap-8 rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <SectionHeading
          id="como-calculamos"
          title="Cómo calculamos tus metas"
          intro="Sin cajas negras: en tu perfil puedes ver cada paso con su fórmula y sus valores."
        />
        <PointList
          items={[
            {
              title: "Metabolismo basal",
              text: "Con la fórmula de Mifflin-St Jeor, a partir de tu edad, estatura, peso y sexo para el cálculo.",
            },
            {
              title: "Gasto del día",
              text: "Tu metabolismo basal multiplicado por un factor según tu nivel de actividad.",
            },
            {
              title: "Ajuste por objetivo",
              text: "Un déficit o superávit moderado y con topes. Con déficit, la meta nunca baja de 1,200 kcal (1,500 en hombres) ni de tu metabolismo basal.",
            },
            {
              title: "Macros y fibra",
              text: "Proteína según tu objetivo y tu peso de referencia, grasas con un mínimo saludable, el resto en carbohidratos y 14 g de fibra por cada 1,000 kcal.",
            },
          ]}
        />
        <p className="text-sm text-muted-foreground">
          Son estimaciones de referencia para personas sanas. No reemplazan la evaluación de un profesional de la salud.
        </p>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/onboarding">
            Crear cuenta gratis
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/precios">Ver precios</Link>
        </Button>
      </div>
    </div>
  );
}
