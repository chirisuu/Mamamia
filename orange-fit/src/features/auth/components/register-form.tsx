"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { CONSENT_VERSION, LEGAL_LINKS } from "@/features/auth/consents";
import { authErrorMessage } from "@/features/auth/errors";
import { confirmUrl } from "@/features/auth/redirect";
import { PASSWORD_MIN, registerSchema } from "@/features/auth/schemas";
import { ONBOARDING_STORAGE_KEY, parseDraft } from "@/features/onboarding/schemas";
import { PasswordInput } from "./password-input";
import { AuthDivider, GoogleButton } from "./google-button";
import { rememberVerifyEmail } from "./verify-email-storage";

type RegisterFormProps = {
  next: string;
  siteUrl: string;
  googleEnabled: boolean;
  fromOnboarding: boolean;
};

export function RegisterForm({ next, siteUrl, googleEnabled, fromOnboarding }: RegisterFormProps) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: "", email: "", password: "", acceptTerms: false },
  });
  const acceptTerms = useWatch({ control: form.control, name: "acceptTerms" });
  const afterConfirm = fromOnboarding ? "/onboarding" : next;

  // Si viene del onboarding, el nombre ya lo escribió: lo traemos del borrador local.
  React.useEffect(() => {
    if (!fromOnboarding) return;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    } catch {
      return;
    }
    const name = parseDraft(raw)?.answers.displayName;
    if (name && !form.getValues("displayName")) form.setValue("displayName", name);
  }, [fromOnboarding, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: confirmUrl(siteUrl, afterConfirm),
        data: {
          display_name: values.displayName,
          // Se copia a la tabla consents al confirmar el correo (ver /auth/confirm).
          signup_consents: { version: CONSENT_VERSION, terms: true, privacy: true, accepted_at: new Date().toISOString() },
        },
      },
    });
    if (authError) {
      setError(authErrorMessage(authError, "signup"));
      return;
    }
    if (data.session) {
      // Confirmación de correo desactivada en este proyecto: ya hay sesión.
      router.replace(afterConfirm);
      router.refresh();
      return;
    }
    rememberVerifyEmail(values.email);
    router.push(fromOnboarding ? "/verificar?from=onboarding" : "/verificar");
  });

  const loginHref = `/ingresar?next=${encodeURIComponent(afterConfirm)}`;

  return (
    <div className="grid gap-6">
      <Form {...form}>
        <form onSubmit={onSubmit} noValidate className="grid gap-5">
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>¿Cómo te llamas?</FormLabel>
                <FormControl>
                  <Input autoComplete="given-name" maxLength={80} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
                <FormLabel>Contraseña</FormLabel>
                <FormControl>
                  <PasswordInput autoComplete="new-password" {...field} />
                </FormControl>
                <FormDescription>Al menos {PASSWORD_MIN} caracteres. Mejor si combinas letras y números.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="acceptTerms"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-start gap-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                      onBlur={field.onBlur}
                      className="mt-0.5"
                    />
                  </FormControl>
                  <FormLabel className="block font-normal leading-relaxed">
                    He leído y acepto los{" "}
                    <Link href={LEGAL_LINKS.terms} target="_blank" className="font-medium text-primary-strong underline underline-offset-4">
                      Términos y condiciones
                    </Link>{" "}
                    y la{" "}
                    <Link href={LEGAL_LINKS.privacy} target="_blank" className="font-medium text-primary-strong underline underline-offset-4">
                      Política de privacidad
                    </Link>
                    .
                  </FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>No pudimos crear tu cuenta</AlertTitle>
              <AlertDescription>
                <p>{error}</p>
              </AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
            {fromOnboarding ? "Crear cuenta y guardar mi plan" : "Crear cuenta"}
          </Button>
        </form>
      </Form>

      {googleEnabled ? (
        <>
          <AuthDivider />
          <div className="grid gap-2">
            <GoogleButton siteUrl={siteUrl} next={afterConfirm} disabled={!acceptTerms} />
            {!acceptTerms ? (
              <p className="text-center text-xs text-muted-foreground">Acepta los términos para continuar con Google.</p>
            ) : null}
          </div>
        </>
      ) : null}

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href={loginHref} className="font-semibold text-primary-strong underline-offset-4 hover:underline">
          Ingresa
        </Link>
      </p>
    </div>
  );
}
