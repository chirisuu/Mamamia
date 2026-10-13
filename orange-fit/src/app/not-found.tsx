import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getAppSettings } from "@/lib/config/app-settings";

export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false, follow: true },
};

const SUGGESTIONS = [
  { href: "/funciones", label: "Funciones" },
  { href: "/precios", label: "Precios" },
  { href: "/faq", label: "Preguntas frecuentes" },
] as const;

/** 404 de todo el sitio (también de /app y /admin cuando no hay uno más cercano). */
export default async function NotFound() {
  const { appName } = await getAppSettings();

  return (
    <main id="contenido" className="flex min-h-dvh items-center justify-center bg-background px-4 pt-safe-6 pb-safe-6">
      <div className="grid w-full max-w-md justify-items-center gap-5 text-center">
        <Link
          href="/"
          className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <LogoMark className="size-12" title={`${appName}: ir al inicio`} />
        </Link>
        <p className="text-sm font-semibold uppercase tracking-wider text-primary-strong">Error 404</p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">No encontramos esta página</h1>
        <p className="leading-relaxed text-muted-foreground">
          Puede que el enlace esté mal escrito o que la página ya no exista. Si llegaste desde un enlace compartido,
          es posible que lo hayan desactivado.
        </p>
        <div className="grid w-full gap-3 sm:grid-cols-2">
          <Button asChild size="lg">
            <Link href="/app">
              Ir a la app
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/">Ir al inicio</Link>
          </Button>
        </div>
        <nav aria-label="Otras páginas" className="pt-2">
          <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm">
            {SUGGESTIONS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center font-medium text-primary-strong underline-offset-4 outline-none hover:underline focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
