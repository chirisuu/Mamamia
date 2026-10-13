"use client";

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { formatNumber } from "@/lib/format";
import { proposeProfessionalTarget, saveManualTargets } from "../actions";
import { manualFloor, reviewManualTargets, type ManualTargetsContext } from "../manual-targets";
import { manualTargetsActionSchema, proposeTargetSchema } from "../schemas";

type Defaults = {
  energyKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  waterMl: number | null;
};

type ManualTargetsFormProps = {
  context: ManualTargetsContext;
  defaults: Defaults;
  /** Si viene, la meta la fija un profesional para esta persona. */
  professional?: { patientId: string; today: string };
};

/** Campo entero (teclado numérico); vacío = null. */
function IntegerInput({
  value,
  onChange,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
}) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value ?? ""}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 5);
        onChange(digits === "" ? null : Number(digits));
      }}
    />
  );
}

export function ManualTargetsForm({ context, defaults, professional }: ManualTargetsFormProps) {
  const [pending, startTransition] = React.useTransition();
  const byProfessional = Boolean(professional);
  const schema = professional ? proposeTargetSchema : manualTargetsActionSchema;
  const form = useForm({
    resolver: zodResolver(schema as typeof proposeTargetSchema),
    defaultValues: {
      energyKcal: defaults.energyKcal,
      proteinG: defaults.proteinG,
      carbsG: defaults.carbsG,
      fatG: defaults.fatG,
      fiberG: defaults.fiberG,
      waterMl: defaults.waterMl,
      notes: null,
      acknowledgeWarnings: false,
      patientId: professional?.patientId ?? "00000000-0000-4000-8000-000000000000",
      effectiveFrom: professional?.today ?? "2000-01-01",
    } as never,
  });
  const watched = useWatch({ control: form.control });
  const energy = typeof watched.energyKcal === "number" ? watched.energyKcal : null;
  const protein = typeof watched.proteinG === "number" ? watched.proteinG : 0;
  const carbs = typeof watched.carbsG === "number" ? watched.carbsG : 0;
  const fat = typeof watched.fatG === "number" ? watched.fatG : 0;
  const review = energy != null ? reviewManualTargets({ energyKcal: energy, proteinG: protein, carbsG: carbs, fatG: fat }, context, { byProfessional }) : null;
  const macroKcal = 4 * protein + 4 * carbs + 9 * fat;
  const hasWarnings = (review?.warnings.length ?? 0) > 0;
  const blocked = (review?.errors.length ?? 0) > 0;

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const v = values as Record<string, unknown>;
      const result = professional
        ? await proposeProfessionalTarget({ ...v, patientId: professional.patientId })
        : await saveManualTargets({
            energyKcal: v.energyKcal,
            proteinG: v.proteinG,
            carbsG: v.carbsG,
            fatG: v.fatG,
            fiberG: v.fiberG,
            waterMl: v.waterMl,
            notes: v.notes,
            acknowledgeWarnings: v.acknowledgeWarnings,
          });
      if (result.ok) {
        toast.success(professional ? "Meta guardada. La persona la verá en su perfil." : "Guardamos tu nueva meta.");
        form.setValue("acknowledgeWarnings", false);
        return;
      }
      for (const [field, messages] of Object.entries(result.error.fieldErrors ?? {})) {
        if (messages?.[0]) form.setError(field as never, { message: messages[0] });
      }
      toast.error(result.error.message);
    });
  });

  const numberField = (name: "energyKcal" | "proteinG" | "carbsG" | "fatG" | "fiberG" | "waterMl", label: string, unit: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {label} <span className="font-normal text-muted-foreground">({unit})</span>
          </FormLabel>
          <FormControl>
            <IntegerInput value={field.value as number | null} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        {numberField("energyKcal", "Calorías", "kcal")}
        <div className="grid grid-cols-3 gap-3">
          {numberField("proteinG", "Proteína", "g")}
          {numberField("carbsG", "Carbos", "g")}
          {numberField("fatG", "Grasa", "g")}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {numberField("fiberG", "Fibra", "g")}
          {numberField("waterMl", "Agua", "ml")}
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Los macros suman <span className="font-semibold text-foreground">{formatNumber(macroKcal)} kcal</span>
          {energy != null ? ` de ${formatNumber(energy)} kcal` : ""}. Piso sin supervisión: {formatNumber(manualFloor(context.sex))} kcal.
        </p>

        {professional ? (
          <FormField
            control={form.control}
            name="effectiveFrom"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Desde</FormLabel>
                <FormControl>
                  <Input type="date" min={professional.today} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Nota <span className="font-normal text-muted-foreground">(opcional)</span>
              </FormLabel>
              <FormControl>
                <Textarea
                  maxLength={2000}
                  placeholder={professional ? "Indicaciones para la persona" : "Por qué haces este ajuste"}
                  value={(field.value as string | null) ?? ""}
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

        {review && blocked ? (
          <Alert variant="destructive">
            <AlertTitle>No se puede guardar así</AlertTitle>
            <AlertDescription>
              <ul className="grid list-disc gap-1 pl-4">
                {review.errors.map((e) => (
                  <li key={e.code}>{e.message}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        {review && hasWarnings ? (
          <Alert variant="warning">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Antes de guardar</AlertTitle>
            <AlertDescription>
              <ul className="grid list-disc gap-1 pl-4">
                {review.warnings.map((w) => (
                  <li key={w.code}>{w.message}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        {hasWarnings && !blocked ? (
          <FormField
            control={form.control}
            name="acknowledgeWarnings"
            render={({ field }) => (
              <div className="flex items-start gap-3">
                <Checkbox
                  id="ack-warnings"
                  checked={Boolean(field.value)}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="ack-warnings" className="block font-normal leading-relaxed">
                  Leí los avisos y quiero guardar esta meta igual.
                </Label>
              </div>
            )}
          />
        ) : null}

        <Button
          type="submit"
          size="lg"
          loading={pending}
          disabled={blocked || (hasWarnings && !watched.acknowledgeWarnings)}
        >
          {professional ? "Fijar esta meta" : "Guardar meta manual"}
        </Button>
      </form>
    </Form>
  );
}
