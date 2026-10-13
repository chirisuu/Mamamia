"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { formatNumber } from "@/lib/format";
import { importUsdaAction } from "../actions/foods";
import { applyFieldErrors } from "../lib/form-errors";
import { usdaImportSchema, type UsdaImportInput } from "../schemas";
import { NumberInput } from "./form-fields";

type Result = { inserted: number; updated: number; skipped: number; errors: string[] };

/** Importación desde USDA FoodData Central por búsqueda o por FDC ID. Muestra el resultado real. */
export function UsdaImportForm({ disabledReason }: { disabledReason: string | null }) {
  const router = useRouter();
  const form = useForm<UsdaImportInput, unknown, z.output<typeof usdaImportSchema>>({
    resolver: zodResolver(usdaImportSchema),
    defaultValues: { mode: "query", query: "", fdcIds: "", limit: 10 },
  });
  const mode = useWatch({ control: form.control, name: "mode" });
  const [result, setResult] = React.useState<Result | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);
  const disabled = Boolean(disabledReason);

  const onSubmit = form.handleSubmit(async () => {
    setFailure(null);
    setResult(null);
    const res = await importUsdaAction(form.getValues());
    if (!res.ok) {
      if (!applyFieldErrors(form.setError, res.error)) setFailure(res.error.message);
      toast.error(res.error.message);
      return;
    }
    setResult(res.data);
    toast.success("Importación terminada.");
    router.refresh();
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        <fieldset disabled={disabled} className="grid gap-5 disabled:opacity-60">
          <FormField
            control={form.control}
            name="mode"
            render={({ field }) => (
              <div className="grid gap-2">
                <p id="usda-mode" className="text-sm font-medium">
                  Cómo importar
                </p>
                <SegmentedControl
                  aria-labelledby="usda-mode"
                  value={field.value}
                  onValueChange={(v) => field.onChange(v)}
                  options={[
                    { value: "query", label: "Por búsqueda" },
                    { value: "ids", label: "Por FDC ID" },
                  ]}
                />
              </div>
            )}
          />
          {mode === "query" ? (
            <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
              <FormField
                control={form.control}
                name="query"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Buscar en USDA (en inglés)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="quinoa, cooked" autoComplete="off" maxLength={100} />
                    </FormControl>
                    <FormDescription>Solo alimentos genéricos (Foundation y SR Legacy).</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="limit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Máximo a importar</FormLabel>
                    <FormControl>
                      <NumberInput decimals={false} name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value} onValueChange={field.onChange} />
                    </FormControl>
                    <FormDescription>De 1 a 50.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          ) : (
            <FormField
              control={form.control}
              name="fdcIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>FDC ID</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={typeof field.value === "string" ? field.value : ""} rows={3} placeholder="2346404, 168917" inputMode="numeric" />
                  </FormControl>
                  <FormDescription>Separados por coma o espacio (máximo 50). Sirve también para productos de marca.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <div>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Importar
            </Button>
          </div>
        </fieldset>

        {failure ? (
          <Alert variant="destructive">
            <AlertTitle>No se pudo importar</AlertTitle>
            <AlertDescription>
              <p>{failure}</p>
            </AlertDescription>
          </Alert>
        ) : null}
        {result ? (
          <Alert variant="success" aria-live="polite">
            <AlertTitle>Resultado</AlertTitle>
            <AlertDescription>
              <p data-numeric="">
                {formatNumber(result.inserted)} nuevos · {formatNumber(result.updated)} actualizados · {formatNumber(result.skipped)} omitidos
              </p>
              {result.errors.length ? (
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {result.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
      </form>
    </Form>
  );
}
