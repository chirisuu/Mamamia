"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { isIsoDate } from "@/lib/dates";
import { formatKg, formatShortDate } from "@/lib/format";
import { logWeightAction } from "../actions";
import { BODY_FAT_METHOD_LABELS, BODY_FAT_METHODS, parseDecimalInput, type BodyFatMethod } from "../schemas";

export type ExistingWeight = { weightKg: number; bodyFatPct: number | null; bodyFatMethod: string | null; note: string | null };

const decimalText = (label: string, min: number, max: number, required: boolean) =>
  z.string().superRefine((raw, ctx) => {
    const v = parseDecimalInput(raw);
    if (v == null) {
      if (required) ctx.addIssue({ code: "custom", message: `Indica ${label}.` });
      return;
    }
    if (Number.isNaN(v)) ctx.addIssue({ code: "custom", message: "Usa solo números (por ejemplo 72.5)." });
    else if (v < min || v > max) ctx.addIssue({ code: "custom", message: `Debe estar entre ${min} y ${max}.` });
  });

function makeSchema(today: string) {
  return z
    .object({
      localDate: z
        .string()
        .refine(isIsoDate, "Elige una fecha válida.")
        .refine((d) => d <= today, "No puedes registrar una fecha futura."),
      weightKg: decimalText("tu peso", 20, 400, true),
      withBodyFat: z.boolean(),
      bodyFatPct: decimalText("el % de grasa", 2, 75, false),
      bodyFatMethod: z.string(),
      note: z.string().max(500, "Máximo 500 caracteres."),
    })
    .superRefine((v, ctx) => {
      if (!v.withBodyFat) return;
      if (parseDecimalInput(v.bodyFatPct) == null) ctx.addIssue({ code: "custom", path: ["bodyFatPct"], message: "Indica el % de grasa." });
      if (!(BODY_FAT_METHODS as readonly string[]).includes(v.bodyFatMethod)) {
        ctx.addIssue({ code: "custom", path: ["bodyFatMethod"], message: "Indica cómo se estimó." });
      }
    });
}

type Values = z.infer<ReturnType<typeof makeSchema>>;

export function WeightForm({ today, existing }: { today: string; existing: Record<string, ExistingWeight> }) {
  const schema = React.useMemo(() => makeSchema(today), [today]);
  const initial = existing[today];
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      localDate: today,
      weightKg: initial ? String(initial.weightKg) : "",
      withBodyFat: initial?.bodyFatPct != null,
      bodyFatPct: initial?.bodyFatPct != null ? String(initial.bodyFatPct) : "",
      bodyFatMethod: initial?.bodyFatMethod ?? "",
      note: initial?.note ?? "",
    },
  });
  const date = useWatch({ control: form.control, name: "localDate" });
  const withBodyFat = useWatch({ control: form.control, name: "withBodyFat" });
  const current = existing[date];

  // Al cambiar de fecha, carga lo que ya había ese día (si había) para editarlo.
  const lastDate = React.useRef(date);
  React.useEffect(() => {
    if (lastDate.current === date) return;
    lastDate.current = date;
    const e = existing[date];
    form.setValue("weightKg", e ? String(e.weightKg) : "");
    form.setValue("withBodyFat", e?.bodyFatPct != null);
    form.setValue("bodyFatPct", e?.bodyFatPct != null ? String(e.bodyFatPct) : "");
    form.setValue("bodyFatMethod", e?.bodyFatMethod ?? "");
    form.setValue("note", e?.note ?? "");
  }, [date, existing, form]);

  async function onSubmit(v: Values) {
    const res = await logWeightAction({
      localDate: v.localDate,
      weightKg: parseDecimalInput(v.weightKg) ?? Number.NaN,
      bodyFatPct: v.withBodyFat ? parseDecimalInput(v.bodyFatPct) : null,
      bodyFatMethod: v.withBodyFat ? (v.bodyFatMethod as BodyFatMethod) : null,
      note: v.note.trim() || null,
    });
    if (!res.ok) {
      for (const [field, messages] of Object.entries(res.error.fieldErrors ?? {})) {
        if (messages?.[0] && field in v) form.setError(field as keyof Values, { message: messages[0] });
      }
      toast.error(res.error.message);
      return;
    }
    toast.success(res.data.replaced ? "Actualizamos tu peso de ese día." : "Peso guardado.");
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="localDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha</FormLabel>
                <FormControl>
                  <Input type="date" max={today} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="weightKg"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Peso (kg)</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" autoComplete="off" placeholder="72.5" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {current ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Ya registraste {formatKg(current.weightKg)} el {formatShortDate(date)}: al guardar se reemplaza (un pesaje por día).
          </p>
        ) : null}

        <FormField
          control={form.control}
          name="withBodyFat"
          render={({ field }) => (
            <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 px-4 py-3">
              <Label htmlFor="with-body-fat" className="font-medium">
                Agregar % de grasa (opcional)
              </Label>
              <Switch id="with-body-fat" checked={field.value} onCheckedChange={field.onChange} />
            </div>
          )}
        />
        {withBodyFat ? (
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="bodyFatPct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>% de grasa</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" autoComplete="off" placeholder="25" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bodyFatMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Método</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Elige" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BODY_FAT_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {BODY_FAT_METHOD_LABELS[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Es una <strong className="font-semibold text-foreground">estimación no clínica</strong>: balanzas y fórmulas caseras
              pueden variar varios puntos de un día a otro. Úsala solo para ver tendencias con el mismo método.
            </p>
          </div>
        ) : null}

        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nota (opcional)</FormLabel>
              <FormControl>
                <Input placeholder="En ayunas, después de entrenar…" maxLength={500} {...field} />
              </FormControl>
              <FormDescription>Pesarte a la misma hora y en condiciones parecidas hace la tendencia más clara.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" loading={form.formState.isSubmitting}>
          {current ? "Actualizar peso" : "Guardar peso"}
        </Button>
      </form>
    </Form>
  );
}
