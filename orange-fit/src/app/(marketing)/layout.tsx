import type * as React from "react";
import type { Metadata } from "next";
import { Info } from "lucide-react";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { getAppSettings } from "@/lib/config/app-settings";

export const metadata: Metadata = {
  // Iconos generados por scripts/generate-icons.mjs (el layout raíz aún no los declara).
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icons/logo.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

/** Sitio público: encabezado, contenido y pie legal. Registra el service worker (PWA). */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { appName, supportEmail, maintenanceBanner } = await getAppSettings();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-xl bg-card px-4 py-3 font-medium shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Saltar al contenido
      </a>
      <SiteHeader appName={appName} />
      {maintenanceBanner ? (
        <div role="status" className="border-b border-border bg-accent">
          <p className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-3 text-sm text-accent-foreground sm:px-6">
            <Info className="mt-0.5 size-4 shrink-0 text-primary-strong" aria-hidden="true" />
            {maintenanceBanner}
          </p>
        </div>
      ) : null}
      <main id="contenido" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter appName={appName} supportEmail={supportEmail} />
      <RegisterServiceWorker />
    </div>
  );
}
