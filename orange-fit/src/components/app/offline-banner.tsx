"use client";

import * as React from "react";
import { WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const getSnapshot = () => navigator.onLine;
// En el servidor asumimos conexión: el aviso solo aparece si el navegador reporta lo contrario.
const getServerSnapshot = () => true;

/** Estado de conexión del navegador (navigator.onLine + eventos online/offline). */
export function useOnlineStatus(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Aviso de "sin conexión". No promete sincronización: solo informa que lo que dependa de red
 * no funcionará hasta reconectar (regla: nada simulado como real).
 * La región viva queda montada siempre para que el lector de pantalla anuncie el cambio;
 * `className` posiciona la tarjeta (el AppShell la hace flotar sobre la barra inferior).
 */
export function OfflineBanner({ className }: { className?: string }) {
  const online = useOnlineStatus();

  return (
    <div role="status" aria-live="polite" data-slot="offline-banner">
      {online ? null : (
        <div
          className={cn(
            "flex items-start gap-3 rounded-2xl bg-foreground px-4 py-3 text-sm text-background shadow-lg",
            className,
          )}
        >
          <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>Estás sin conexión. Lo que necesite internet no funcionará hasta que vuelvas a conectarte.</p>
        </div>
      )}
    </div>
  );
}
