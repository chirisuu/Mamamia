"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailWarning } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/features/auth/errors";
import { confirmUrl } from "@/features/auth/redirect";
import { loginSchema } from "@/features/auth/schemas";
import { PasswordInput } from "./password-input";
import { AuthDivider, GoogleButton } from "./google-button";
import { rememberVerifyEmail } from "./verify-email-storage";

type LoginFormProps = {
  next: string;
  siteUrl: string;
  googleEnabled: boolean;
};

type LoginError = { message: string; unconfirmedEmail: string | null };

export function LoginForm({ next, siteUrl, googleEnabled }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = React.useState<LoginError | null>(null);
  const [resending, setResending] = React.useState(false);
  const form = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword(values);
    if (authError) {
      setError({
        message: authErrorMessage(authError, "login"),
        unconfirmedEmail: authError.code === "email_not_confirmed" ? values.email : null,
      });
      return;
    }
    router.replace(next);
    router.refresh();
  });

  async function resendVerification(email: string) {
    setResending(true);
    const supabase = createSupabaseBrowserClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: confirmUrl(siteUrl, next) },
    });
    setResending(false);
    if (resendError) {
      toast.error(authErrorMessage(resendError, "resend"));
      return;
    }
    rememberVerifyEmail(email);
    router.push("/verificar?reenviado=1");
  }

  const registerHref = next === "/app" ? "/registro" : `/registro?next=${encodeURIComponent(next)}`;

  return (
    <div className="grid gap-6">
      {googleEnabled ? (
        <>
          <GoogleButton siteUrl={siteUrl} next={next} />
          <AuthDivider />
        </>
      ) : null}

      <Form {...form}>
        <form onSubmit={onSubmit} noValidate className="grid gap-5">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Correo</FormLabel>
                <FormControl>
                  <Input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-3">
                  <FormLabel>Contraseña</FormLabel>
                  <Link
                    href="/recuperar"
                    className="inline-flex min-h-11 items-center text-sm font-medium text-primary-strong underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    ¿La olvidaste?
                  </Link>
                </div>
                <FormControl>
                  <PasswordInput autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {error ? (
            <Alert variant={error.unconfirmedEmail ? "warning" : "destructive"}>
              {error.unconfirmedEmail ? <MailWarning aria-hidden="true" /> : null}
              <AlertTitle>{error.unconfirmedEmail ? "Confirma tu correo" : "No pudimos ingresar"}</AlertTitle>
              <AlertDescription>
                <p>{error.message}</p>
                {error.unconfirmedEmail ? (
                  <Button
                    type="button"
                    variant="link"
                    className="h-11"
                    loading={resending}
                    onClick={() => resendVerification(error.unconfirmedEmail!)}
                  >
                    Reenviar correo de verificación
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
            Ingresar
          </Button>
        </form>
      </Form>

      <p className="text-center text-sm text-muted-foreground">
        ¿Aún no tienes cuenta?{" "}
        <Link href={registerHref} className="font-semibold text-primary-strong underline-offset-4 hover:underline">
          Crea tu cuenta
        </Link>
      </p>
    </div>
  );
}
