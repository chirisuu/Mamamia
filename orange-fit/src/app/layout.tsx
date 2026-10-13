import type * as React from "react";
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "@/components/providers";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";
import { DEFAULT_APP_NAME, siteUrl } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: DEFAULT_APP_NAME,
    template: `%s · ${DEFAULT_APP_NAME}`,
  },
  description:
    "Registra tus comidas, conoce tus calorías y macros y sigue tu progreso con un plan que se adapta a tu objetivo.",
  applicationName: DEFAULT_APP_NAME,
  manifest: "/manifest.webmanifest",
  // Generados por scripts/generate-icons.mjs.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icons/logo.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: DEFAULT_APP_NAME,
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Permite dibujar bajo el notch / barra de inicio; los shells compensan con pt-safe / pb-safe.
  viewportFit: "cover",
  // Mismos valores que --background en globals.css (claro #F7F8FA, oscuro #17181C).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F8FA" },
    { media: "(prefers-color-scheme: dark)", color: "#17181C" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: next-themes pone la clase .dark en <html> antes de hidratar.
    <html lang="es-PE" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
        {/* PWA en toda la app (sitio, /precios, /app): página sin conexión y push. */}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
