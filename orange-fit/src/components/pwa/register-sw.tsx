"use client";

import * as React from "react";

/** ¿Se registra el service worker? En producción siempre; en desarrollo solo si se pide. */
export function shouldRegisterServiceWorker(env: { nodeEnv?: string; enableSw?: string } = {
  nodeEnv: process.env.NODE_ENV,
  enableSw: process.env.NEXT_PUBLIC_ENABLE_SW,
}): boolean {
  return env.nodeEnv === "production" || env.enableSw === "true";
}

/**
 * Registra `/sw.js` (alcance "/"). En desarrollo no se registra salvo `NEXT_PUBLIC_ENABLE_SW=true`,
 * para no servir estáticos viejos mientras se programa. No pinta nada.
 */
export function RegisterServiceWorker() {
  React.useEffect(() => {
    if (!shouldRegisterServiceWorker() || !("serviceWorker" in navigator)) return;
    const register = () => {
      // updateViaCache "none": el navegador siempre revisa si hay una versión nueva de sw.js.
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
        // Sin service worker la app funciona igual (solo sin página offline ni push).
      });
    };
    // Después de la carga, para no competir con los recursos de la página.
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
