import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, HeartPulse, Lock, ShieldCheck, Stethoscope } from "lucide-react";
import { InstallButton } from "@/components/pwa/install-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getAppSettings } from "@/lib/config/app-settings";
import { siteUrl } from "@/lib/env";
import { AccountDeletedNotice } from "@/features/marketing/components/account-deleted-notice";
import { BrandRing } from "@/features/marketing/components/brand-ring";
import { FaqList } from "@/features/marketing/components/faq-list";
import { FeatureCard, PlanBadgeTag } from "@/features/marketing/components/feature-card";
import { JsonLd } from "@/features/marketing/components/json-ld";
import { PricingPreview } from "@/features/marketing/components/pricing-preview";
import { Reveal } from "@/features/marketing/components/reveal";
import { ScreenshotFrame } from "@/features/marketing/components/screenshot-frame";
import { PointList, SectionHeading } from "@/features/marketing/components/section";
import { ALL_FEATURES, LANDING_FEATURE_IDS, planBadgeFor } from "@/features/marketing/content";
import { getPricingSummary, getPublishedFaqs } from "@/features/marketing/queries";
import { availableScreenshots } from "@/features/marketing/screenshots";
import { absoluteUrl, pageMetadata, softwareApplicationJsonLd, type JsonLdOffer } from "@/features/marketing/seo";

const DESCRIPTION =
  "Calcula tus calorías y macros según tu objetivo, registra tus comidas buscando, escaneando, con foto o con tu voz, y sigue tu progreso sin dietas extremas.";

export async function generateMetadata(): Promise<Metadata> {
  const { appName } = await getAppSettings();
  return pageMetadata({
    title: `${appName}: calorías, macros y progreso a tu ritmo`,
    absoluteTitle: true,
    description: DESCRIPTION,
    path: "/",
    appName,
  });
}

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Portada pública. */
export default async function LandingPage({ searchParams }: PageProps) {
  const [{ cuenta }, settings, pricing, faqs] = await Promise.all([
    searchParams,
    getAppSettings(),
    getPricingSummary(),
    getPublishedFaqs(5),
  ]);
  const { appName } = settings;
  const shots = availableScreenshots();
  const plans = pricing.ok ? pricing.data.planFeatures : null;
  const landingFeatures = LANDING_FEATURE_IDS.map((id) => ALL_FEATURES.find((f) => f.id === id)!).filter(Boolean);
  const mealPlansBadge = planBadgeFor({ planFeature: "meal_plans" }, plans);

  const offers: JsonLdOffer[] = [];
  if (pricing.ok) {
    const { view, monthly, yearly } = pricing.data;
    if (view.free) offers.push({ name: view.free.name, price: 0, priceCurrency: monthly?.currency ?? "PEN" });
    if (view.premium && monthly) offers.push({ name: `${view.premium.name} mensual`, price: monthly.amountCents / 100, priceCurrency: monthly.currency });
    if (view.premium && yearly) offers.push({ name: `${view.premium.name} anual`, price: yearly.amountCents / 100, priceCurrency: yearly.currency });
  }

  return (
    <>
      <JsonLd data={softwareApplicationJsonLd({ appName, description: DESCRIPTION, url: absoluteUrl(siteUrl(), "/"), offers })} />
      {cuenta === "eliminada" ? <AccountDeletedNotice /> : null}

      {/* Portada */}
      <section aria-labelledby="titulo-portada" className="relative isolate overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem] bg-gradient-to-b from-accent to-transparent dark:from-accent/50"
          aria-hidden="true"
        />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-16 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:pt-16 lg:pb-24">
          <div className="grid animate-fade-in gap-6">
            <p className="w-fit rounded-full border border-primary/40 bg-card px-3 py-1 text-sm font-medium text-primary-strong">
              Calorías, macros y hábitos, sin dietas extremas
            </p>
            <h1 id="titulo-portada" className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Come con intención. <span className="text-primary-strong">Avanza a tu ritmo.</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              {appName} calcula tus calorías y macros según tu cuerpo y tu objetivo, te deja registrar tus comidas en segundos
              —buscando, escaneando, con una foto o con tu voz— y te muestra tu avance sin juzgarte.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/onboarding">
                  Crear cuenta gratis
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/ingresar">Ingresar</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Empieza gratis, sin tarjeta. Funciona en el navegador de tu celular y puedes instalarla como app.
            </p>
          </div>

          <div className="relative">
            <BrandRing className="absolute top-1/2 left-1/2 -z-10 size-[26rem] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-60 sm:size-[30rem]" />
            <ScreenshotFrame shot="inicio" available={shots.inicio} priority />
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section aria-labelledby="como-funciona" className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 lg:py-24">
          <div className="grid gap-8">
            <SectionHeading
              id="como-funciona"
              eyebrow="Cómo funciona"
              title="Tres pasos, sin complicarte"
              intro="Primero entendemos tu punto de partida. Luego registras como te acomode y miras tu avance."
            />
            <ol className="grid gap-6">
              {[
                {
                  title: "Cuéntanos de ti",
                  text: "Respondes unas preguntas sobre tu cuerpo, tu actividad y tu objetivo. Calculamos tu meta con la fórmula de Mifflin-St Jeor y te mostramos cómo llegamos a cada número.",
                },
                {
                  title: "Registra como te acomode",
                  text: "Busca un alimento, escanea un código de barras, toma una foto o díctalo. Siempre confirmas lo que se guarda.",
                },
                {
                  title: "Mira tu tendencia y ajusta",
                  text: "Tu día, tu semana y tu peso en el tiempo. Si cambias de objetivo, recalculas tu meta en un minuto.",
                },
              ].map((step, index) => (
                <Reveal as="li" key={step.title} delay={index * 0.06} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  <span
                    className="row-span-2 flex size-10 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="leading-relaxed text-muted-foreground">{step.text}</p>
                </Reveal>
              ))}
            </ol>
          </div>
          <Reveal>
            <ScreenshotFrame shot="diario" available={shots.diario} />
          </Reveal>
        </div>
      </section>

      {/* Funciones */}
      <section aria-labelledby="funciones" className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:py-24">
        <SectionHeading
          id="funciones"
          eyebrow="Funciones"
          title="Todo lo que necesitas, en una sola app"
          intro={
            plans
              ? "Las etiquetas indican si la función está incluida en el plan Gratis o en Premium."
              : "Registrar, planificar y seguir tu progreso desde el celular."
          }
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {landingFeatures.map((feature, index) => (
            <Reveal as="li" key={feature.id} delay={(index % 3) * 0.05}>
              <FeatureCard feature={feature} badge={planBadgeFor(feature, plans)} />
            </Reveal>
          ))}
        </ul>
        <div>
          <Button asChild variant="link">
            <Link href="/funciones">
              Ver todas las funciones en detalle
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>

      {/* IA con honestidad */}
      <section aria-labelledby="ia" className="bg-brand-carbon text-brand-snow dark:bg-brand-graphite">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-[0.9fr_1.1fr] lg:py-24">
          <Reveal className="order-last md:order-first">
            <ScreenshotFrame shot="foto-ia" available={shots["foto-ia"]} className="ring-brand-snow/15" />
          </Reveal>
          <div className="grid gap-8">
            <SectionHeading
              id="ia"
              tone="inverse"
              eyebrow="Registro con IA, explicado"
              title="La IA te ahorra tiempo. Los números salen de datos."
              intro="Con una foto, tu voz o una frase, la IA propone qué comiste y cuánto. Así funciona, sin letra pequeña:"
            />
            <PointList
              tone="inverse"
              items={[
                {
                  title: "Estima, tú confirmas",
                  text: "Nada entra a tu diario hasta que revisas la propuesta, corriges lo que haga falta y la confirmas.",
                },
                {
                  title: "Las calorías no las inventa la IA",
                  text: "La IA solo identifica el alimento y la porción. Calorías y macros se calculan con nuestra base de alimentos (USDA FoodData Central, Open Food Facts y fichas curadas por el equipo).",
                },
                {
                  title: "Procedencia a la vista",
                  text: "Cada alimento muestra de dónde salen sus datos y si ya fue verificado. Lo que es una estimación se marca como estimación.",
                },
                {
                  title: "Tiene límites, y te los decimos",
                  text: "Una foto no ve el aceite ni lo que queda debajo del arroz. Por eso cada propuesta es editable antes de guardarla.",
                },
                {
                  title: "Con tu permiso",
                  text: "El análisis con IA es opcional y puedes retirar tu permiso cuando quieras desde Privacidad.",
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* Planes alimenticios */}
      <section aria-labelledby="planes" className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 lg:py-24">
        <div className="grid gap-8">
          <div className="grid gap-3">
            <SectionHeading
              id="planes"
              eyebrow="Planes de comida"
              title="Tu semana resuelta, a tu medida"
              intro="Un plan armado con recetas reales para tu meta de calorías y proteína, que respeta tus alergias, tu forma de comer y tu presupuesto."
            />
            {mealPlansBadge ? (
              <div>
                <PlanBadgeTag badge={mealPlansBadge} />
              </div>
            ) : null}
          </div>
          <PointList
            items={[
              { title: "Flexible", text: "Cambia una comida por otra parecida o vuelve a generar un día entero." },
              {
                title: "Lista de compras incluida",
                text: "Sale de tu plan, agrupada por categoría y con precios referenciales para que planifiques tu gasto.",
              },
              { title: "Para compartir", text: "Envíalo a tu familia con un enlace que puedes revocar cuando quieras." },
              {
                title: "Con cuidado",
                text: "Si tu perfil necesita acompañamiento profesional, no generamos planes automáticos: puedes armar el tuyo a mano.",
              },
            ]}
          />
        </div>
        <Reveal>
          <ScreenshotFrame shot="plan" available={shots.plan} />
        </Reveal>
      </section>

      {/* Progreso */}
      <section aria-labelledby="progreso" className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-2 lg:py-24">
          <Reveal className="order-last md:order-first">
            <ScreenshotFrame shot="progreso" available={shots.progreso} />
          </Reveal>
          <div className="grid gap-8">
            <SectionHeading
              id="progreso"
              eyebrow="Seguimiento"
              title="Tu progreso, con calma"
              intro="El peso sube y baja de un día a otro. Te mostramos la tendencia para que veas hacia dónde vas, no solo el número de hoy."
            />
            <PointList
              items={[
                { title: "Peso, medidas y fotos privadas", text: "Tus fotos de progreso se guardan en un espacio privado que solo tú puedes ver." },
                { title: "Constancia, no perfección", text: "Ves cuántos días estuviste cerca de tu meta en la semana." },
                { title: "Agua, ayuno y actividad", text: "Todo en el mismo lugar, con recordatorios que tú decides activar." },
                {
                  title: "Sin castigos",
                  text: "Si un día comes de más, el anillo lo muestra sin alarmas ni colores rojos. Mañana es otro día.",
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* Salud primero */}
      <section aria-labelledby="salud" className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:py-24">
        <SectionHeading
          id="salud"
          eyebrow="Tu salud va primero"
          title="Hecha para cuidarte, no para presionarte"
          intro="Nada de dietas extremas ni promesas de resultados: estas son las reglas que la app respeta siempre."
        />
        <ul className="grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: ShieldCheck,
              title: "Metas con pisos seguros",
              text: "Cuando hay déficit, tu meta nunca baja de 1,200 kcal (1,500 en hombres) ni de tu metabolismo basal, y el ritmo de pérdida tiene un tope.",
            },
            {
              icon: HeartPulse,
              title: "Si necesitas acompañamiento, te lo decimos",
              text: "Si eres menor de edad, estás embarazada o en lactancia, tienes bajo peso o antecedentes de trastornos de la conducta alimentaria, la app no te propone déficit ni ayuno.",
            },
            {
              icon: Lock,
              title: "Tus datos son tuyos",
              text: "Tratamos tus datos de salud según la Ley N.° 29733. Puedes descargarlos o eliminar tu cuenta cuando quieras.",
            },
            {
              icon: Stethoscope,
              title: "No reemplaza a un profesional",
              text: "Te damos información general y herramientas. Para diagnósticos o tratamientos, consulta con tu médico o nutricionista.",
            },
          ].map((item, index) => (
            <Reveal as="li" key={item.title} delay={(index % 2) * 0.05}>
              <article className="flex h-full gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary-strong" aria-hidden="true">
                  <item.icon className="size-5" />
                </span>
                <div className="grid gap-1">
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* Precios */}
      <section aria-labelledby="precios" className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 py-16 sm:px-6 lg:py-24">
          <SectionHeading
            id="precios"
            align="center"
            eyebrow="Precios"
            title="Empieza gratis. Pasa a Premium cuando quieras."
            intro="Lo esencial para registrar y seguir tu progreso es gratis. Premium suma el registro con IA, los planes de comida, la lista de compras y el asistente."
          />
          <PricingPreview pricing={pricing} />
        </div>
      </section>

      {/* Preguntas frecuentes */}
      {!faqs.ok || faqs.data.length > 0 ? (
        <section aria-labelledby="preguntas" className="mx-auto grid max-w-3xl gap-8 px-4 py-16 sm:px-6 lg:py-24">
          <SectionHeading id="preguntas" align="center" eyebrow="Preguntas frecuentes" title="Lo que más nos preguntan" />
          {faqs.ok ? (
            <FaqList items={faqs.data} />
          ) : (
            <Alert>
              <AlertTitle>No pudimos cargar las preguntas frecuentes</AlertTitle>
              <AlertDescription>
                <p>Vuelve a intentarlo en unos minutos.</p>
              </AlertDescription>
            </Alert>
          )}
          <div className="text-center">
            <Button asChild variant="link">
              <Link href="/faq">
                Ver todas las preguntas
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      {/* Llamado final */}
      <section aria-labelledby="empieza" className="px-4 pb-16 sm:px-6 lg:pb-24">
        <div className="relative mx-auto grid max-w-6xl gap-6 overflow-hidden rounded-3xl bg-primary px-6 py-12 text-primary-foreground sm:px-12 lg:py-16">
          <BrandRing className="absolute -top-24 -right-24 size-80 opacity-40 [&_path]:stroke-brand-carbon [&_circle]:fill-brand-carbon" />
          <h2 id="empieza" className="relative max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Empieza hoy, a tu ritmo.
          </h2>
          <p className="relative max-w-xl text-lg leading-relaxed">
            Crea tu cuenta, cuéntanos tu objetivo y en unos minutos tendrás tu meta del día explicada paso a paso.
          </p>
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start">
            <Button asChild size="lg" className="bg-brand-carbon text-brand-snow hover:bg-brand-carbon/90 focus-visible:ring-brand-carbon">
              <Link href="/onboarding">
                Crear cuenta gratis
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-brand-carbon bg-transparent text-brand-carbon hover:bg-brand-carbon/10 hover:text-brand-carbon focus-visible:ring-brand-carbon"
            >
              <Link href="/ingresar">Ya tengo cuenta</Link>
            </Button>
            <InstallButton
              variant="ghost"
              className="text-brand-carbon hover:bg-brand-carbon/10 hover:text-brand-carbon focus-visible:ring-brand-carbon [&_button]:text-brand-carbon [&_button]:focus-visible:ring-brand-carbon [&_p]:text-brand-carbon [&_strong]:text-brand-carbon"
            />
          </div>
        </div>
      </section>
    </>
  );
}
