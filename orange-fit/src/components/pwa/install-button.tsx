"use client";

import * as React from "react";
import { Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallState = "unavailable" | "prompt" | "ios" | "installed";

// El evento puede llegar antes de montar el botón: se guarda a nivel de módulo.
let deferredPrompt: InstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installedNow = true;
    notify();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Pura (recibe lo que necesita): estado de instalación según el navegador. */
export function detectInstallState(input: {
  standalone: boolean;
  hasPrompt: boolean;
  userAgent: string;
  maxTouchPoints: number;
}): InstallState {
  if (input.standalone) return "installed";
  if (input.hasPrompt) return "prompt";
  const ua = input.userAgent;
  // iPadOS se presenta como Mac: se reconoce por la pantalla táctil.
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && input.maxTouchPoints > 1);
  return ios ? "ios" : "unavailable";
}

function snapshot(): InstallState {
  const standalone =
    installedNow ||
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return detectInstallState({
    standalone,
    hasPrompt: deferredPrompt !== null,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
  });
}

/** Estado de instalación de la PWA (para quien quiera reutilizarlo). */
export function useInstallState(): InstallState {
  return React.useSyncExternalStore(subscribe, snapshot, () => "unavailable" as InstallState);
}

/**
 * "Instalar app". Solo aparece cuando el navegador lo permite (`beforeinstallprompt`) o, en
 * iPhone/iPad, con las instrucciones de Safari. Si ya está instalada o no se puede, no pinta nada:
 * nunca un botón que no hace nada.
 */
export function InstallButton({ className, variant = "outline" }: { className?: string; variant?: "outline" | "secondary" | "ghost" }) {
  const state = useInstallState();
  const [showIosHelp, setShowIosHelp] = React.useState(false);
  const helpId = React.useId();

  if (state === "unavailable" || state === "installed") return null;

  if (state === "ios") {
    return (
      <div className={cn("grid gap-2", className)}>
        <Button
          type="button"
          variant={variant}
          aria-expanded={showIosHelp}
          aria-controls={helpId}
          onClick={() => setShowIosHelp((open) => !open)}
        >
          <Download aria-hidden="true" />
          Instalar en tu iPhone
        </Button>
        <p id={helpId} hidden={!showIosHelp} className="flex items-start gap-2 text-sm text-muted-foreground">
          <Share className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            En Safari, toca <strong className="font-semibold text-foreground">Compartir</strong> y luego{" "}
            <strong className="font-semibold text-foreground">Agregar a inicio</strong>.
          </span>
        </p>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      onClick={async () => {
        const event = deferredPrompt;
        if (!event) return;
        await event.prompt();
        await event.userChoice.catch(() => undefined);
        // El evento solo se puede usar una vez.
        deferredPrompt = null;
        notify();
      }}
    >
      <Download aria-hidden="true" />
      Instalar app
    </Button>
  );
}
