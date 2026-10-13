import type * as React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tu plan",
  robots: { index: false, follow: false },
};

/** Asistente a pantalla completa, sin la navegación de la app. */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-background">{children}</div>;
}
