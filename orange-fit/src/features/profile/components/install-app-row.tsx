"use client";

import * as React from "react";
import { Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type InstallState = "none" | "prompt" | "ios" | "installed";

// El evento puede llegar antes de que se monte el perfil: lo guardamos a nivel de módulo.
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function snapshot(): InstallState {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  if (deferred) return "prompt";
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "none";
}

/**
 * "Instalar app": solo aparece si el navegador lo permite (beforeinstallprompt) o, en iPhone/iPad,
 * con las instrucciones de Safari. Si ya está instalada o no se puede, no se muestra nada.
 */
export function InstallAppRow() {
  const state = React.useSyncExternalStore(subscribe, snapshot, () => "none" as InstallState);
  const [showIos, setShowIos] = React.useState(false);

  if (state === "none" || state === "installed") return null;

  if (state === "ios") {
    return (
      <div className="grid gap-2 px-4 py-3">
        <div className="flex min-h-10 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary-strong">
            <Download className="size-5" aria-hidden="true" />
          </span>
          <span className="flex-1 font-medium">Instalar app</span>
          <Button variant="ghost" size="sm" onClick={() => setShowIos((v) => !v)} aria-expanded={showIos}>
            {showIos ? "Ocultar" : "Cómo"}
          </Button>
        </div>
        {showIos ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Share className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            En Safari, toca Compartir y luego «Agregar a inicio».
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary-strong">
        <Download className="size-5" aria-hidden="true" />
      </span>
      <span className="flex-1 font-medium">Instalar app</span>
      <Button
        variant="secondary"
        size="sm"
        onClick={async () => {
          const event = deferred;
          if (!event) return;
          await event.prompt();
          await event.userChoice.catch(() => undefined);
          deferred = null;
          notify();
        }}
      >
        Instalar
      </Button>
    </div>
  );
}
