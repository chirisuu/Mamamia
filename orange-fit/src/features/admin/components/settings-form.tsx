"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { saveSettingsAction } from "../actions/settings";
import { FLAGS_IN_USE, isPaymentFlag, PAYMENT_FLAGS } from "../lib/flags";
import { applyFieldErrors } from "../lib/form-errors";
import { numberOrNull, settingsSchema, type SettingsInput } from "../schemas";

export type PaymentsConfigured = Record<(typeof PAYMENT_FLAGS)[number]["provider"], boolean>;

export function SettingsForm({ initial, paymentsConfigured }: { initial: SettingsInput; paymentsConfigured: PaymentsConfigured }) {
  const router = useRouter();
  const form = useForm<SettingsInput>({ resolver: zodResolver(settingsSchema), defaultValues: initial, mode: "onBlur" });
  const flags = useFieldArray({ control: form.control, name: "featureFlags" });
  const otherFlags = flags.fields.map((flag, index) => ({ flag, index })).filter(({ flag }) => !isPaymentFlag(flag.key));
  const [newKey, setNewKey] = React.useState("");
  const [newKeyError, setNewKeyError] = React.useState<string | null>(null);

  const onSubmit = form.handleSubmit(async () => {
    const result = await saveSettingsAction(form.getValues());
    if (!result.ok) {
      applyFieldErrors(form.setError, result.error);
      toast.error(result.error.message);
      return;
    }
    toast.success(result.data.changed.length ? "Configuración guardada." : "No había cambios que guardar.");
    form.reset(form.getValues());
    router.refresh();
  });

  function addFlag() {
    const key = newKey.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]{1,39}$/.test(key)) {
      setNewKeyError("Usa minúsculas, números y _ (2 a 40 caracteres, empieza con letra).");
      return;
    }
    if (form.getValues("featureFlags").some((f) => f.key === key)) {
      setNewKeyError("Ya existe un interruptor con esa clave.");
      return;
    }
    flags.append({ key, enabled: false });
    setNewKey("");
    setNewKeyError(null);
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle as="h2">General</CardTitle>
            <CardDescription>El nombre se ve en todo el sitio, los correos y el título de cada página.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="appName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la app</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" maxLength={60} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="supportEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo de soporte</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} type="email" inputMode="email" autoComplete="off" placeholder="soporte@tudominio.com" />
                  </FormControl>
                  <FormDescription>Se muestra en el pie del sitio. Vacío = «pendiente de configurar».</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="defaultTrialDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Días de prueba por defecto</FormLabel>
                  <FormControl>
                    <Input
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={Number.isFinite(field.value) ? String(field.value) : ""}
                      onChange={(e) => field.onChange(numberOrNull(e.target.value))}
                      inputMode="numeric"
                    />
                  </FormControl>
                  <FormDescription>Cada precio tiene además sus propios días de prueba (Planes y precios).</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="maintenanceBanner"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Aviso de mantenimiento</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} maxLength={280} placeholder="Ej.: El sábado 18 de 2 a 4 a. m. la app puede estar lenta." />
                  </FormControl>
                  <FormDescription>Vacío = sin aviso. Máximo 280 caracteres.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Medios de pago</CardTitle>
            <CardDescription>
              Apagar un medio de pago lo oculta en Precios y Premium y el checkout responde «no disponible por ahora». Las
              suscripciones ya activas no se tocan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2">
              {PAYMENT_FLAGS.map((pf) => {
                const index = flags.fields.findIndex((f) => f.key === pf.key);
                if (index === -1) return null;
                const configured = paymentsConfigured[pf.provider];
                return (
                  <li key={pf.key} className="rounded-xl border border-border px-3 py-3">
                    <FormField
                      control={form.control}
                      name={`featureFlags.${index}.enabled`}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-3">
                          <div className="grid min-w-0 flex-1 gap-1">
                            <FormLabel className="text-base">{pf.label}</FormLabel>
                            <FormDescription>
                              {pf.hint}{" "}
                              {configured
                                ? field.value
                                  ? "Disponible para cobrar."
                                  : "Configurado, pero apagado."
                                : "Credenciales pendientes de configurar: aunque lo enciendas, no se podrá cobrar hasta configurarlas."}
                            </FormDescription>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge variant={configured ? "success" : "outline"}>{configured ? "Credenciales configuradas" : "Pendiente de configurar"}</Badge>
                              <Badge variant={field.value ? "soft" : "secondary"}>{field.value ? "Encendido" : "Apagado"}</Badge>
                            </div>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Interruptores de funciones</CardTitle>
            <CardDescription>
              Encender un interruptor no basta si la función necesita credenciales: el servicio también debe estar configurado.
              Los que dicen «sin efecto todavía» se guardan, pero ninguna parte de la app los lee aún.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {otherFlags.length === 0 ? <p className="text-sm text-muted-foreground">No hay otros interruptores todavía.</p> : null}
            <ul className="grid gap-2">
              {otherFlags.map(({ flag, index }) => (
                <li key={flag.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
                  <FormField
                    control={form.control}
                    name={`featureFlags.${index}.enabled`}
                    render={({ field }) => (
                      <FormItem className="flex min-w-0 flex-1 flex-row items-center gap-3">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <div className="grid min-w-0 flex-1">
                          <FormLabel className="truncate font-mono text-sm">{flag.key}</FormLabel>
                          <span className="truncate text-xs text-muted-foreground">{FLAGS_IN_USE[flag.key] ? `Lo usa: ${FLAGS_IN_USE[flag.key]}` : "Sin efecto todavía"}</span>
                        </div>
                      </FormItem>
                    )}
                  />
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Quitar ${flag.key}`} onClick={() => flags.remove(index)}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="grid gap-2 sm:flex sm:items-end">
              <div className="grid flex-1 gap-1.5">
                <label htmlFor="new-flag" className="text-sm font-medium">
                  Nuevo interruptor
                </label>
                <Input
                  id="new-flag"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addFlag();
                    }
                  }}
                  placeholder="ej.: weekly_digest"
                  aria-invalid={newKeyError ? true : undefined}
                  aria-describedby={newKeyError ? "new-flag-error" : undefined}
                  autoComplete="off"
                />
              </div>
              <Button type="button" variant="outline" onClick={addFlag}>
                <Plus aria-hidden="true" />
                Agregar
              </Button>
            </div>
            {newKeyError ? (
              <p id="new-flag-error" className="text-sm text-destructive">
                {newKeyError}
              </p>
            ) : null}
          </CardContent>
        </Card>

        {form.formState.errors.root ? <p className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
            Guardar configuración
          </Button>
          {form.formState.isDirty ? <p className="text-sm text-muted-foreground">Tienes cambios sin guardar.</p> : null}
        </div>
      </form>
    </Form>
  );
}
