"use client";

import * as React from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/features/auth/errors";
import { confirmUrl } from "@/features/auth/redirect";
import { resendSchema } from "@/features/auth/schemas";
import { readVerifyEmail, rememberVerifyEmail } from "./verify-email-storage";

const COOLDOWN_SECONDS = 60;

// sessionStorage no avisa cambios dentro de la misma pestaña: basta con leerlo al renderizar.
const subscribeNothing = () => () => {};

type VerifyEmailProps = {
  siteUrl: string;
  next: string;
  linkError: boolean;
  resent: boolean;
};

export function VerifyEmail({ siteUrl, next, linkError, resent }: VerifyEmailProps) {
  // El correo viene de sessionStorage (en el servidor no existe: allí es null).
  const storedEmail = React.useSyncExternalStore(subscribeNothing, readVerifyEmail, () => null);
  const [emailDraft, setEmailDraft] = React.useState<string | null>(null);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(resent ? COOLDOWN_SECONDS : 0);
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const email = emailDraft ?? storedEmail ?? "";
  const knownEmail = sentTo ?? storedEmail;

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  async function resend(event: React.FormEvent) {
    event.preventDefault();
    const parsed = resendSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Revisa el correo.");
      return;
    }
    setFieldError(null);
    setSending(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: parsed.data.email,
      options: { emailRedirectTo: confirmUrl(siteUrl, next) },
    });
    setSending(false);
    if (error) {
      toast.error(authErrorMessage(error, "resend"));
      return;
    }
    rememberVerifyEmail(parsed.data.email);
    setSentTo(parsed.data.email);
    setCooldown(COOLDOWN_SECONDS);
    toast.success("Te enviamos un nuevo enlace. Revisa tu bandeja de entrada.");
  }

  return (
    <div className="grid gap-6">
      {linkError ? (
        <Alert variant="warning">
          <AlertTitle>El enlace venció o ya se usó</AlertTitle>
          <AlertDescription>
            <p>Pide un nuevo correo de verificación aquí abajo. Si ya confirmaste tu cuenta, solo ingresa.</p>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-accent text-primary-strong">
          <MailCheck className="size-7" aria-hidden="true" />
        </div>
        <p className="text-base font-semibold">Revisa tu correo</p>
        <p className="text-sm text-muted-foreground">
          {knownEmail ? (
            <>
              Enviamos un enlace a <span className="font-medium text-foreground">{knownEmail}</span>.
            </>
          ) : (
            "Enviamos un enlace al correo con el que te registraste."
          )}{" "}
          Ábrelo en este dispositivo para activar tu cuenta. Puede tardar unos minutos; revisa también la carpeta de spam o promociones.
        </p>
        <p className="text-xs text-muted-foreground">
          Si ya tenías una cuenta con ese correo, no te enviaremos otra: ingresa o recupera tu contraseña.
        </p>
      </div>

      <form onSubmit={resend} noValidate className="grid gap-3">
        <div className="grid gap-2">
          <Label htmlFor="verify-email">¿No te llegó? Reenvíalo</Label>
          <Input
            id="verify-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmailDraft(e.target.value)}
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? "verify-email-error" : undefined}
          />
          {fieldError ? (
            <p id="verify-email-error" role="alert" className="text-sm font-medium text-destructive">
              {fieldError}
            </p>
          ) : null}
        </div>
        <Button type="submit" variant="secondary" size="lg" loading={sending} disabled={cooldown > 0}>
          {cooldown > 0 ? `Puedes reenviarlo en ${cooldown} s` : "Reenviar correo de verificación"}
        </Button>
      </form>

      <Button asChild size="lg" className="w-full">
        <Link href={`/ingresar?next=${encodeURIComponent(next)}`}>Ya confirmé, quiero ingresar</Link>
      </Button>
    </div>
  );
}
