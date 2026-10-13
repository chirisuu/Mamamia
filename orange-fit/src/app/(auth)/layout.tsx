import type * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SetupRequired } from "@/components/setup-required";
import { getAppSettings } from "@/lib/config/app-settings";
import { isSupabaseConfigured } from "@/lib/env";
import { LEGAL_LINKS } from "@/features/auth/consents";

/** Pantallas de ingreso, registro y recuperación: una columna centrada, sin navegación de la app. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { appName } = await getAppSettings();
  if (!isSupabaseConfigured()) return <SetupRequired appName={appName} />;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-[calc(env(safe-area-inset-top)+1rem)] focus:z-[60] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-3 focus:font-semibold focus:text-primary-foreground"
      >
        Saltar al contenido
      </a>
      <header className="pt-safe">
        <div className="mx-auto flex h-16 w-full max-w-md items-center px-4">
          <Link
            href="/"
            className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Logo appName={appName} />
          </Link>
        </div>
      </header>
      <main id="contenido" className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-10 pt-4">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-md px-4 pb-safe-6 text-center text-xs text-muted-foreground">
        <nav aria-label="Legal" className="flex justify-center gap-4">
          <Link href={LEGAL_LINKS.terms} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
            Términos
          </Link>
          <Link href={LEGAL_LINKS.privacy} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline">
            Privacidad
          </Link>
        </nav>
        <p>{appName} no reemplaza la orientación de un profesional de la salud.</p>
      </footer>
    </div>
  );
}
