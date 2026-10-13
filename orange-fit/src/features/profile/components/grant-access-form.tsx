"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { ChoiceCards } from "@/features/onboarding/components/choice-cards";
import { grantProfessionalAccess } from "../actions";
import { grantAccessSchema, PROFESSIONAL_SCOPES, SCOPE_LABELS, type GrantAccessValues } from "../schemas";

export function GrantAccessForm({ disabledReason }: { disabledReason: string | null }) {
  const [pending, startTransition] = React.useTransition();
  const form = useForm({
    resolver: zodResolver(grantAccessSchema),
    defaultValues: { email: "", scope: "read_logs_write_targets" } as GrantAccessValues,
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await grantProfessionalAccess(values);
      if (result.ok) {
        toast.success(`Listo: ${result.data.name} ya tiene acceso.`);
        form.reset({ email: "", scope: values.scope });
        return;
      }
      for (const [field, messages] of Object.entries(result.error.fieldErrors ?? {})) {
        if (messages?.[0]) form.setError(field as keyof GrantAccessValues, { message: messages[0] });
      }
      toast.error(result.error.message);
    });
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Correo de tu profesional</FormLabel>
              <FormControl>
                <Input type="email" inputMode="email" autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={Boolean(disabledReason)} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="scope"
          render={({ field }) => (
            <FormItem>
              <FormLabel id="scope-label">Qué puede hacer</FormLabel>
              <ChoiceCards
                aria-labelledby="scope-label"
                value={field.value}
                onValueChange={field.onChange}
                options={PROFESSIONAL_SCOPES.map((s) => ({ value: s, label: SCOPE_LABELS[s].label, description: SCOPE_LABELS[s].description }))}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        {disabledReason ? <p className="text-sm text-muted-foreground">{disabledReason}</p> : null}
        <Button type="submit" size="lg" loading={pending} disabled={Boolean(disabledReason)}>
          Dar acceso
        </Button>
      </form>
    </Form>
  );
}
