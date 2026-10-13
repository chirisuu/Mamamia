"use client";

import * as React from "react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/features/auth/errors";
import { callbackUrl } from "@/features/auth/redirect";

/**
 * "Continuar con Google". Solo se renderiza si NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true"
 * (la página lo decide); el proveedor debe estar activo en Supabase Auth.
 */
export function GoogleButton({ siteUrl, next, disabled }: { siteUrl: string; next: string; disabled?: boolean }) {
  const [loading, setLoading] = React.useState(false);

  async function onClick() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl(siteUrl, next) },
    });
    // Si todo va bien el navegador ya se fue a Google; solo volvemos aquí con error.
    if (error) {
      toast.error(authErrorMessage(error, "oauth"));
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="lg" className="w-full" onClick={onClick} loading={loading} disabled={disabled}>
      {loading ? null : <GoogleMark />}
      Continuar con Google
    </Button>
  );
}

function GoogleMark() {
  // Logotipo oficial de "G" (colores de la marca Google, requeridos por sus guías de uso).
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.29 14.29A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.57.38-2.29V6.6H1.28a12 12 0 0 0 0 10.8l4.01-3.11Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.6l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77Z" />
    </svg>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground" role="separator">
      <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
    </div>
  );
}
