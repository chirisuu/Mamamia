"use client";

import type * as React from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Notificaciones (toast). Se monta una vez en Providers; en el resto de la app usa `toast()`. */
function Toaster(props: ToasterProps) {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      // En móvil el borde inferior lo ocupan la barra y el botón "+": los avisos van arriba.
      mobileOffset={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
      containerAriaLabel="Notificaciones"
      closeButton
      className="toaster group font-sans!"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "calc(var(--radius) * 1.25)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "font-sans! shadow-lg!",
          description: "text-muted-foreground!",
          actionButton: "rounded-lg! bg-primary! text-primary-foreground! font-semibold!",
          cancelButton: "rounded-lg! bg-secondary! text-secondary-foreground!",
          success: "[&_[data-icon]]:text-success",
          error: "[&_[data-icon]]:text-destructive",
          warning: "[&_[data-icon]]:text-warning",
          info: "[&_[data-icon]]:text-primary-strong",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
export { toast } from "sonner";
