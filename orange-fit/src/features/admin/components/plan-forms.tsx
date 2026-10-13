"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { FEATURE_LABELS, PREMIUM_FEATURES } from "@/lib/billing/features";
import { formatCents } from "@/lib/format";
import { savePlanPriceAction, updatePlanAction } from "../actions/plans";
import { applyFieldErrors } from "../lib/form-errors";
import { AI_KIND_LABELS, AI_KINDS, BILLING_INTERVAL_LABELS, BILLING_INTERVALS } from "../lib/labels";
import { planPriceSchema, planSchema, type PlanInput, type PlanPriceInput } from "../schemas";
import { NativeSelect } from "./admin-ui";
import { NumberInput } from "./form-fields";

/** Edición de un plan: nombre, descripción, funciones de pago y cupos mensuales de IA. */
export function PlanForm({ initial, baseFeatures }: { initial: PlanInput; baseFeatures: string[] }) {
  const router = useRouter();
  const form = useForm<PlanInput, unknown, z.output<typeof planSchema>>({ resolver: zodResolver(planSchema), defaultValues: initial, mode: "onBlur" });
  const selected = useWatch({ control: form.control, name: "premiumFeatures" }) ?? [];

  const onSubmit = form.handleSubmit(async () => {
    const result = await updatePlanAction(form.getValues());
    if (!result.ok) {
      applyFieldErrors(form.setError, result.error);
      toast.error(result.error.message);
      return;
    }
    toast.success("Plan guardado.");
    form.reset(form.getValues());
    router.refresh();
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={60} autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sortOrder"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Orden</FormLabel>
                <FormControl>
                  <NumberInput decimals={false} name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value} onValueChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción</FormLabel>
              <FormControl>
                <Textarea {...field} value={field.value ?? ""} rows={2} maxLength={500} />
              </FormControl>
              <FormDescription>Se muestra en Precios. Sin promesas de resultados.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Funciones de pago incluidas</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {PREMIUM_FEATURES.map((feature) => {
              const id = `${initial.planId}-${feature}`;
              const checked = selected.includes(feature);
              return (
                <div key={feature} className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3">
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(on) =>
                      form.setValue("premiumFeatures", on === true ? [...selected, feature] : selected.filter((f) => f !== feature), { shouldDirty: true })
                    }
                  />
                  <label htmlFor={id} className="min-w-0 flex-1 py-2 text-sm">
                    {FEATURE_LABELS[feature]}
                  </label>
                </div>
              );
            })}
          </div>
          {baseFeatures.length ? (
            <p className="text-xs text-muted-foreground">
              Funciones base (se conservan tal cual): <span className="font-mono">{baseFeatures.join(", ")}</span>
            </p>
          ) : null}
        </fieldset>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Cupos de IA por mes</legend>
          <p className="text-xs text-muted-foreground">0 = sin acceso a ese tipo. Cuentan las solicitudes en curso, correctas y con error.</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {AI_KINDS.map((kind) => (
              <FormField
                key={kind}
                control={form.control}
                name={`aiLimits.${kind}`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{AI_KIND_LABELS[kind]}</FormLabel>
                    <FormControl>
                      <NumberInput decimals={false} name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value} onValueChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
        </fieldset>
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between gap-3 rounded-xl border border-border px-3 py-3">
              <div className="grid gap-1">
                <FormLabel>Plan activo</FormLabel>
                <FormDescription>Un plan inactivo deja de mostrarse en Precios. Las suscripciones vigentes no cambian.</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
        {form.formState.errors.root ? <p className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={form.formState.isSubmitting}>
            Guardar plan
          </Button>
          {form.formState.isDirty ? <p className="text-sm text-muted-foreground">Tienes cambios sin guardar.</p> : null}
        </div>
      </form>
    </Form>
  );
}

/** Botón + diálogo para crear o editar un precio de un plan. */
export function PlanPriceDialog({ initial, mode, planName }: { initial: PlanPriceInput; mode: "create" | "edit"; planName: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      {mode === "create" ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Plus aria-hidden="true" />
          Agregar precio
        </Button>
      ) : (
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar precio" onClick={() => setOpen(true)}>
          <Pencil aria-hidden="true" />
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? `Nuevo precio de ${planName}` : `Editar precio de ${planName}`}</DialogTitle>
            <DialogDescription>Solo puede haber un precio activo por plan, intervalo y moneda.</DialogDescription>
          </DialogHeader>
          {open ? <PlanPriceForm initial={initial} onDone={() => setOpen(false)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PlanPriceForm({ initial, onDone }: { initial: PlanPriceInput; onDone: () => void }) {
  const router = useRouter();
  const form = useForm<PlanPriceInput, unknown, z.output<typeof planPriceSchema>>({ resolver: zodResolver(planPriceSchema), defaultValues: initial });
  const [cents, currency] = useWatch({ control: form.control, name: ["amountCents", "currencyCode"] });
  const preview = typeof cents === "number" && Number.isInteger(cents) && cents >= 0 && /^[A-Za-z]{3}$/.test(currency ?? "") ? formatCents(cents, currency.toUpperCase()) : null;

  const onSubmit = form.handleSubmit(async () => {
    const result = await savePlanPriceAction(form.getValues());
    if (!result.ok) {
      applyFieldErrors(form.setError, result.error);
      toast.error(result.error.message);
      return;
    }
    toast.success(result.data.created ? "Precio creado." : "Precio guardado.");
    onDone();
    router.refresh();
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="interval"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Periodo</FormLabel>
                <FormControl>
                  <NativeSelect {...field}>
                    {BILLING_INTERVALS.map((i) => (
                      <option key={i} value={i}>
                        {BILLING_INTERVAL_LABELS[i]}
                      </option>
                    ))}
                  </NativeSelect>
                </FormControl>
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
                <FormControl>
                  <Input {...field} maxLength={3} className="uppercase" autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="amountCents"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Monto en céntimos</FormLabel>
                <FormControl>
                  <NumberInput decimals={false} name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value} onValueChange={field.onChange} />
                </FormControl>
                <FormDescription aria-live="polite">{preview ? `= ${preview}` : "Ej.: 2990 = S/ 29.90"}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="trialDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Días de prueba</FormLabel>
                <FormControl>
                  <NumberInput decimals={false} name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value} onValueChange={field.onChange} />
                </FormControl>
                <FormDescription>0 = usa los días por defecto de Configuración.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="stripePriceId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ID de precio en Stripe</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} placeholder="price_…" autoComplete="off" spellCheck={false} />
              </FormControl>
              <FormDescription>Debe tener el mismo monto, moneda e intervalo en Stripe. Sin él, este precio no se cobra con tarjeta.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="mercadopagoPlanId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ID de plan en Mercado Pago (opcional)</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} autoComplete="off" spellCheck={false} />
              </FormControl>
              <FormDescription>Hoy no se usa: Mercado Pago cobra el monto de este precio sin plan asociado.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between gap-3 rounded-xl border border-border px-3 py-3">
              <div className="grid gap-1">
                <FormLabel>Activo</FormLabel>
                <FormDescription>Solo los precios activos se ofrecen. Quien ya pagó conserva su suscripción.</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
        {form.formState.errors.root ? <p className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onDone} disabled={form.formState.isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" loading={form.formState.isSubmitting}>
            Guardar precio
          </Button>
        </div>
      </form>
    </Form>
  );
}
