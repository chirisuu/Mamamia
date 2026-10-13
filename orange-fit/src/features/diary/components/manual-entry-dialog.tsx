"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { logManualAction } from "../actions";
import { decimalField, parseDecimal } from "../lib/form-numbers";
import type { MealType } from "../types";

const formSchema = z.object({
  name: z.string().trim().min(1, "Escribe qué comiste.").max(120, "Máximo 120 caracteres."),
  energyKcal: decimalField({ required: true, max: 10000 }),
  proteinG: decimalField({ max: 1000 }),
  carbsG: decimalField({ max: 2000 }),
  fatG: decimalField({ max: 1000 }),
});
type FormValues = z.infer<typeof formSchema>;

/**
 * Ingreso manual rápido: el usuario escribe los valores (p. ej. de una etiqueta o un restaurante).
 * Se guarda marcado como estimación ingresada por el usuario.
 */
export function ManualEntryDialog({
  localDate,
  mealType,
  customName,
  mealName,
}: {
  localDate: string;
  mealType: MealType;
  customName: string | null;
  mealName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", energyKcal: "", proteinG: "", carbsG: "", fatG: "" },
  });

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const res = await logManualAction({
        localDate,
        mealType,
        customName,
        name: values.name,
        energyKcal: parseDecimal(values.energyKcal) ?? 0,
        proteinG: parseDecimal(values.proteinG) ?? 0,
        carbsG: parseDecimal(values.carbsG) ?? 0,
        fatG: parseDecimal(values.fatG) ?? 0,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Agregado a ${res.data.mealLabel}`, {
        action: { label: "Ver diario", onClick: () => router.push(`/app/diario/${res.data.localDate}`) },
      });
      form.reset();
      setOpen(false);
    });
  };

  const numberField = (name: "energyKcal" | "proteinG" | "carbsG" | "fatG", label: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...field} inputMode="decimal" autoComplete="off" />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex h-full min-h-24 w-full flex-col gap-2 rounded-2xl border border-border bg-card p-3.5 text-left transition-colors duration-150 hover:border-primary/50 hover:bg-accent/50 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary-strong">
            <PencilLine className="size-5" aria-hidden="true" />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">Ingreso manual</span>
            <span className="text-xs text-muted-foreground">Escribe las calorías tú</span>
          </span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ingreso manual</DialogTitle>
          <DialogDescription>
            Se agrega a {mealName}. Como los valores los escribes tú, se guardan como estimación.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>¿Qué comiste?</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Menú del día" autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              {numberField("energyKcal", "Calorías (kcal)")}
              {numberField("proteinG", "Proteína (g)")}
              {numberField("carbsG", "Carbohidratos (g)")}
              {numberField("fatG", "Grasas (g)")}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={pending}>
                Agregar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
