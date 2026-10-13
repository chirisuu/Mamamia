"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 1 min: evita refetch en cada montaje; los datos del diario se invalidan tras cada acción.
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  });
}

/**
 * Proveedores de cliente: tema (clase .dark), TanStack Query, preferencias de movimiento,
 * tooltips y notificaciones. Se monta una vez en el layout raíz.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  // Un QueryClient por pestaña (no compartido entre peticiones del servidor).
  const [queryClient] = React.useState(makeQueryClient);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      // Evita la advertencia de React 19 por <script> renderizado en cliente: en el servidor se
      // emite como JS (se ejecuta antes del primer pintado) y en el cliente como texto inerte.
      scriptProps={{ type: typeof window === "undefined" ? "text/javascript" : "text/plain" }}
    >
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </MotionConfig>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
