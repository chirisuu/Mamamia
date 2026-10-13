"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { COMMON_TIMEZONES, COUNTRY_OPTIONS, CURRENCY_OPTIONS } from "@/features/onboarding/options";
import { ChoiceCards } from "@/features/onboarding/components/choice-cards";
import { updateProfile } from "../actions";
import { profileFormSchema, type ProfileFormValues } from "../schemas";

export function ProfileForm({ defaults, today }: { defaults: ProfileFormValues; today: string }) {
  const [pending, startTransition] = React.useTransition();
  const form = useForm({ resolver: zodResolver(profileFormSchema), defaultValues: defaults });
  const timezones = React.useMemo(() => {
    const list: Array<{ value: string; label: string }> = [...COMMON_TIMEZONES];
    if (defaults.timezone && !list.some((t) => t.value === defaults.timezone)) list.unshift({ value: defaults.timezone, label: defaults.timezone });
    return list;
  }, [defaults.timezone]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await updateProfile(values);
      if (result.ok) {
        toast.success("Guardamos tus datos.");
        form.reset(values);
        return;
      }
      for (const [field, messages] of Object.entries(result.error.fieldErrors ?? {})) {
        if (messages?.[0]) form.setError(field as keyof ProfileFormValues, { message: messages[0] });
      }
      toast.error(result.error.message);
    });
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-6">
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <Input autoComplete="given-name" maxLength={80} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="birthDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha de nacimiento</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  max={today}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="sex"
          render={({ field }) => (
            <FormItem>
              <FormLabel id="sex-label">Sexo para el cálculo</FormLabel>
              <ChoiceCards
                aria-labelledby="sex-label"
                value={field.value ?? undefined}
                onValueChange={field.onChange}
                options={[
                  { value: "female", label: "Mujer" },
                  { value: "male", label: "Hombre" },
                ]}
              />
              <FormDescription>Solo cambia la constante de la fórmula del metabolismo basal (Mifflin-St Jeor).</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="heightCm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Estatura</FormLabel>
              <FormControl>
                <NumberStepper value={field.value ?? null} onValueChange={field.onChange} min={100} max={250} step={1} unit="cm" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="countryCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>País</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Elige tu país" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {COUNTRY_OPTIONS.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="currencyCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Moneda</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Elige tu moneda" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="timezone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Zona horaria</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Elige tu zona horaria" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {timezones.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>Define qué día es «hoy» en tu diario.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="countExerciseCalories"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-4">
                <div className="grid gap-1">
                  <FormLabel>Sumar las calorías del ejercicio a mi meta</FormLabel>
                  <FormDescription>
                    Desactivado por defecto: tu nivel de actividad ya incluye tu ejercicio habitual y sumarlo otra vez lo contaría dos
                    veces. Actívalo si registras entrenamientos extra.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </div>
            </FormItem>
          )}
        />

        <Alert variant="info">
          <AlertDescription>
            <p>
              Si cambias tu edad, sexo o estatura, tu meta no se recalcula sola:{" "}
              <Link href="/app/perfil/metas" className="font-medium text-primary-strong underline underline-offset-4">
                recalcúlala en Metas
              </Link>
              .
            </p>
          </AlertDescription>
        </Alert>

        <Button type="submit" size="lg" loading={pending} disabled={!form.formState.isDirty}>
          Guardar cambios
        </Button>
      </form>
    </Form>
  );
}
