"use client";

import * as React from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ErrorScreen } from "@/features/marketing/components/error-screen";
import "./globals.css";

/** Clave en la que next-themes guarda el tema elegido ("light" | "dark" | "system"). */
const THEME_STORAGE_KEY = "theme";

/**
 * Error en el propio layout raíz. Reemplaza todo el documento: trae sus estilos y fuentes y aplica
 * el tema (elegido o del sistema) porque aquí no está next-themes.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  React.useEffect(() => {
    let theme: string | null = null;
    try {
      theme = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      // Sin acceso al almacenamiento: seguimos al sistema.
    }
    const dark = theme === "dark" || ((!theme || theme === "system") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  return (
    <html lang="es-PE" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <title>Algo salió mal</title>
        <ErrorScreen error={error} onRetry={retry} />
      </body>
    </html>
  );
}
