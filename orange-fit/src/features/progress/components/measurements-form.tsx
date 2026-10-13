"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { isIsoDate } from "@/lib/dates";
import { formatShortDate } from "@/lib/format";
import { logMeasurementsAction } from "../actions";
import type { MeasurementRecord } from "../server/progress";
import { MEASUREMENT_FIELDS, parseDecimalInput, type MeasurementKey } from "../schemas";

function makeSchema(today: string) {
  const fields = Object.fromEntries(
    MEASUREMENT_FIELDS.map((f) => [
      f.key,
      z.string().superRefine((raw, ctx) => {
        const v = parseDecimalInput(raw);
        if (v == null) return;
        if (Number.isNaN(v)) ctx.addIssue({ code: "custom", message: "Usa solo números." });
        else if (v < f.min || v > f.max) ctx.addIssue({ code: "custom", message: `Entre ${f.min} y ${f.max} cm.` });
      }),
    ]),
  ) as Record<MeasurementKey, z.ZodString>;
  return z
    .object({
      localDate: z
        .string()
        .refine(isIsoDate, "Elige una fecha válida.")
        .refine((d) => d <= today, "No puedes registrar una fecha futura."),
      ...fields,
      note: z.string().max(500, "Máximo 500 caracteres."),
    })
    .refine((v) => MEASUREMENT_FIELDS.some((f) => parseDecimalInput(v[f.key]) != null), {
      message: "Ingresa al menos una medida.",
      path: ["waistCm"],
    });
}

type Values = z.infer<ReturnType<typeof makeSchema>>;

function valuesFor(date: string, record: MeasurementRecord | undefined): Values {
  const out = { localDate: date, note: record?.note ?? "" } as Values;
  for (const f of MEASUREMENT_FIELDS) {
    const v = record?.[f.column];
    out[f.key] = v == null ? "" : String(v);
  }
  return out;
}

/** Medidas corporales del día (cm). Un registro por fecha: si ya hay, se carga para editarlo. */
export function MeasurementsForm({ today, byDate }: { today: string; byDate: Record<string, MeasurementRecord> }) {
  const schema = React.useMemo(() => makeSchema(today), [today]);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: valuesFor(today, byDate[today]) });
  const date = useWatch({ control: form.control, name: "localDate" });
  const existing = byDate[date];

  const lastDate = React.useRef(date);
  React.useEffect(() => {
    if (lastDate.current === date) return;
    lastDate.current = date;
    if (!isIsoDate(date)) return;
    form.reset(valuesFor(date, byDate[date]));
  }, [date, byDate, form]);

  async function onSubmit(v: Values) {
    const payload = {
      localDate: v.localDate,
      note: v.note.trim() || null,
      ...(Object.fromEntries(MEASUREMENT_FIELDS.map((f) => [f.key, parseDecimalInput(v[f.key])])) as Record<MeasurementKey, number | null>),
    };
    const res = await logMeasurementsAction(payload);
    if (!res.ok) {
      for (const [field, messages] of Object.entries(res.error.fieldErrors ?? {})) {
        if (messages?.[0] && field in v) form.setError(field as keyof Values, { message: messages[0] });
      }
      toast.error(res.error.message);
      return;
    }
    toast.success(res.data.replaced ? "Actualizamos tus medidas de ese día." : "Medidas guardadas.");
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
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
        {existing ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Ya tienes medidas del {formatShortDate(date)}: las cargamos para que las edites. Un campo vacío queda sin dato.
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {MEASUREMENT_FIELDS.map((f) => (
            <FormField
              key={f.key}
              control={form.control}
              name={f.key}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{f.label} (cm)</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>
        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nota (opcional)</FormLabel>
              <FormControl>
                <Input maxLength={500} placeholder="Medido al despertar, con cinta…" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <p className="text-xs text-muted-foreground">
          Mide siempre en el mismo punto y con la cinta sin apretar. Las medidas cambian más lento que el peso: una vez cada 2–4
          semanas es suficiente.
        </p>
        <Button type="submit" variant="secondary" loading={form.formState.isSubmitting}>
          {existing ? "Actualizar medidas" : "Guardar medidas"}
        </Button>
      </form>
    </Form>
  );
}
