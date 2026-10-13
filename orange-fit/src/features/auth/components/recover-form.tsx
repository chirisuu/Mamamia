"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/features/auth/errors";
import { confirmUrl } from "@/features/auth/redirect";
import { recoverSchema } from "@/features/auth/schemas";

export function RecoverForm({ siteUrl }: { siteUrl: string }) {
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(recoverSchema), defaultValues: { email: "" } });

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: confirmUrl(siteUrl, "/nueva-clave"),
    });
    if (authError) {
      setError(authErrorMessage(authError, "reset"));
      return;
    }
    setSentTo(email);
  });

  if (sentTo) {
    return (
      <div className="grid gap-6">
        <div role="status" className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-accent text-primary-strong">
            <MailCheck className="size-7" aria-hidden="true" />
          </div>
          <p className="text-base font-semibold">Revisa tu correo</p>
          <p className="text-sm text-muted-foreground">
            Si existe una cuenta con <span className="font-medium text-foreground">{sentTo}</span>, te llegará un enlace para
            crear una nueva contraseña. Vence en 1 hora.
          </p>
        </div>
        <Button variant="secondary" size="lg" onClick={() => setSentTo(null)}>
          Usar otro correo
        </Button>
        <Button asChild variant="link" className="justify-self-center">
          <Link href="/ingresar">Volver a ingresar</Link>
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Correo de tu cuenta</FormLabel>
              <FormControl>
                <Input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>No pudimos enviar el enlace</AlertTitle>
            <AlertDescription>
              <p>{error}</p>
            </AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Enviar enlace
        </Button>
        <Button asChild variant="link" className="justify-self-center">
          <Link href="/ingresar">Volver a ingresar</Link>
        </Button>
      </form>
    </Form>
  );
}
