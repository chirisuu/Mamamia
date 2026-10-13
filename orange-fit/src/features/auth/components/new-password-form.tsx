"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/components/ui/sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/features/auth/errors";
import { newPasswordSchema, PASSWORD_MIN } from "@/features/auth/schemas";
import { PasswordInput } from "./password-input";

export function NewPasswordForm() {
  const router = useRouter();
  const [error, setError] = React.useState<{ message: string; expired: boolean } | null>(null);
  const form = useForm({ resolver: zodResolver(newPasswordSchema), defaultValues: { password: "", confirm: "" } });

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.updateUser({ password });
    if (authError) {
      const expired = authError.code === "session_not_found" || authError.code === "session_expired" || authError.status === 401;
      setError({ message: authErrorMessage(authError, "update_password"), expired });
      return;
    }
    toast.success("Listo, tu contraseña se actualizó.");
    router.replace("/app");
    router.refresh();
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nueva contraseña</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <FormDescription>Al menos {PASSWORD_MIN} caracteres.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Repite la nueva contraseña</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>No pudimos cambiar tu contraseña</AlertTitle>
            <AlertDescription>
              <p>{error.message}</p>
              {error.expired ? (
                <Link href="/recuperar" className="font-medium text-primary-strong underline underline-offset-4">
                  Pedir un enlace nuevo
                </Link>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Guardar contraseña
        </Button>
      </form>
    </Form>
  );
}
