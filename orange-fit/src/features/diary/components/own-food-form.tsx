"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { toast } from "@/components/ui/sonner";
import { formatNumber } from "@/lib/format";
import { createOwnFoodAction, deleteOwnFoodAction, updateOwnFoodAction } from "../actions";
import { decimalField, parseDecimal } from "../lib/form-numbers";
import { toPer100g } from "../lib/own-food";
import type { OwnFoodInput } from "../schemas";

const portionSchema = z.object({
  label: z.string().trim().min(1, "Describe la porción.").max(60),
  quantity: decimalField({ required: true, positive: true, max: 1000 }),
  unit: z.string().trim().min(1, "Indica la unidad.").max(30),
  gramWeight: decimalField({ required: true, positive: true, max: 5000 }),
  isDefault: z.boolean(),
});

const formSchema = z
  .object({
    name: z.string().trim().min(1, "Escribe el nombre.").max(200),
    brandName: z.string().trim().max(120),
    barcode: z
      .string()
      .trim()
      .refine((v) => v === "" || /^[0-9]{6,14}$/.test(v), "El código debe tener entre 6 y 14 dígitos."),
    basis: z.enum(["per100g", "perPortion"]),
    basisGrams: decimalField({ positive: true, max: 5000 }),
    energyKcal: decimalField({ required: true, max: 10000 }),
    proteinG: decimalField({ required: true, max: 10000 }),
    carbsG: decimalField({ required: true, max: 10000 }),
    fatG: decimalField({ required: true, max: 10000 }),
    fiberG: decimalField({ max: 10000 }),
    sugarG: decimalField({ max: 10000 }),
    saturatedFatG: decimalField({ max: 10000 }),
    sodiumMg: decimalField({ max: 100000 }),
    portions: z.array(portionSchema).max(10, "Máximo 10 porciones."),
  })
  .refine((v) => v.basis === "per100g" || parseDecimal(v.basisGrams) != null, {
    message: "Indica cuántos gramos pesa la porción.",
    path: ["basisGrams"],
  });

export type OwnFoodFormValues = z.infer<typeof formSchema>;

export type OwnFoodDefaults = Partial<Omit<OwnFoodFormValues, "portions">> & { portions?: OwnFoodFormValues["portions"] };

function toPayload(v: OwnFoodFormValues): OwnFoodInput {
  return {
    name: v.name,
    brandName: v.brandName || null,
    barcode: v.barcode || null,
    basis: v.basis,
    basisGrams: v.basis === "perPortion" ? parseDecimal(v.basisGrams) : null,
    energyKcal: parseDecimal(v.energyKcal) ?? 0,
    proteinG: parseDecimal(v.proteinG) ?? 0,
    carbsG: parseDecimal(v.carbsG) ?? 0,
    fatG: parseDecimal(v.fatG) ?? 0,
    fiberG: parseDecimal(v.fiberG),
    sugarG: parseDecimal(v.sugarG),
    saturatedFatG: parseDecimal(v.saturatedFatG),
    sodiumMg: parseDecimal(v.sodiumMg),
    portions: v.portions.map((p) => ({
      label: p.label,
      quantity: parseDecimal(p.quantity) ?? 1,
      unit: p.unit,
      gramWeight: parseDecimal(p.gramWeight) ?? 0,
      isDefault: p.isDefault,
    })),
  };
}

const NUTRIENT_FIELDS = [
  { name: "energyKcal", label: "Calorías (kcal)", required: true },
  { name: "proteinG", label: "Proteína (g)", required: true },
  { name: "carbsG", label: "Carbohidratos (g)", required: true },
  { name: "fatG", label: "Grasas (g)", required: true },
  { name: "fiberG", label: "Fibra (g)", required: false },
  { name: "sugarG", label: "Azúcares (g)", required: false },
  { name: "saturatedFatG", label: "Grasa saturada (g)", required: false },
  { name: "sodiumMg", label: "Sodio (mg)", required: false },
] as const;

/**
 * Crear o editar un alimento propio. Los valores pueden escribirse por 100 g o por porción
 * (p. ej. la etiqueta dice "por 30 g"); se guardan siempre por 100 g y nunca son públicos.
 */
export function OwnFoodForm({
  foodId,
  defaults,
  returnTo,
}: {
  foodId?: string;
  defaults?: OwnFoodDefaults;
  /** Ruta a la que volver al guardar (ya validada en el servidor). */
  returnTo?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const form = useForm<OwnFoodFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      brandName: "",
      barcode: "",
      basis: "per100g",
      basisGrams: "",
      energyKcal: "",
      proteinG: "",
      carbsG: "",
      fatG: "",
      fiberG: "",
      sugarG: "",
      saturatedFatG: "",
      sodiumMg: "",
      portions: [],
      ...defaults,
    },
  });
  const portions = useFieldArray({ control: form.control, name: "portions" });
  const watched = useWatch({ control: form.control });
  const basis = watched.basis ?? "per100g";

  // Vista previa por 100 g cuando se escribe por porción.
  const preview = React.useMemo(() => {
    if (basis !== "perPortion") return null;
    const grams = parseDecimal(watched.basisGrams ?? "");
    const kcal = parseDecimal(watched.energyKcal ?? "");
    if (!grams || kcal == null) return null;
    return toPer100g({
      basis: "perPortion",
      basisGrams: grams,
      energyKcal: kcal,
      proteinG: parseDecimal(watched.proteinG ?? "") ?? 0,
      carbsG: parseDecimal(watched.carbsG ?? "") ?? 0,
      fatG: parseDecimal(watched.fatG ?? "") ?? 0,
      fiberG: parseDecimal(watched.fiberG ?? ""),
      sugarG: parseDecimal(watched.sugarG ?? ""),
      saturatedFatG: parseDecimal(watched.saturatedFatG ?? ""),
      sodiumMg: parseDecimal(watched.sodiumMg ?? ""),
    });
  }, [basis, watched.basisGrams, watched.energyKcal, watched.proteinG, watched.carbsG, watched.fatG, watched.fiberG, watched.sugarG, watched.saturatedFatG, watched.sodiumMg]);

  const onSubmit = (values: OwnFoodFormValues) => {
    setFormError(null);
    const payload = toPayload(values);
    const check = toPer100g({ ...payload, basisGrams: payload.basisGrams ?? null, fiberG: payload.fiberG ?? null });
    if (!check.ok) {
      form.setError(check.field as keyof OwnFoodFormValues, { message: check.message });
      setFormError(check.message);
      return;
    }
    startTransition(async () => {
      const res = foodId ? await updateOwnFoodAction(foodId, payload) : await createOwnFoodAction(payload);
      if (!res.ok) {
        for (const [field, messages] of Object.entries(res.error.fieldErrors ?? {})) {
          if (field in values && messages?.[0]) form.setError(field as keyof OwnFoodFormValues, { message: messages[0] });
        }
        setFormError(res.error.message);
        toast.error(res.error.message);
        return;
      }
      toast.success(foodId ? "Alimento actualizado" : "Alimento creado");
      if (returnTo) {
        const sep = returnTo.includes("?") ? "&" : "?";
        router.push(`${returnTo}${sep}q=${encodeURIComponent(values.name)}`);
      } else {
        router.push("/app/alimentos");
      }
    });
  };

  const remove = () => {
    if (!foodId) return;
    startTransition(async () => {
      const res = await deleteOwnFoodAction({ foodId });
      if (!res.ok) {
        toast.error(res.error.message);
        setConfirmDelete(false);
        return;
      }
      toast.success("Alimento eliminado");
      router.push("/app/alimentos");
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6" noValidate>
        <fieldset className="grid gap-4" disabled={pending}>
          <legend className="mb-1 text-base font-semibold">Datos</legend>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Pan integral de la panadería" autoComplete="off" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="brandName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marca (opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="barcode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código de barras (opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} inputMode="numeric" autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </fieldset>

        <fieldset className="grid gap-4" disabled={pending}>
          <legend className="mb-1 text-base font-semibold">Información nutricional</legend>
          <FormField
            control={form.control}
            name="basis"
            render={({ field }) => (
              <FormItem>
                <FormLabel id="basis-label">Los valores son</FormLabel>
                <SegmentedControl
                  aria-labelledby="basis-label"
                  options={[
                    { value: "per100g", label: "Por 100 g" },
                    { value: "perPortion", label: "Por porción" },
                  ]}
                  value={field.value}
                  onValueChange={field.onChange}
                />
                <FormDescription>Copia los valores tal como aparecen en la etiqueta; nosotros los pasamos a 100 g.</FormDescription>
              </FormItem>
            )}
          />
          {basis === "perPortion" ? (
            <FormField
              control={form.control}
              name="basisGrams"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>La porción pesa (g)</FormLabel>
                  <FormControl>
                    <Input {...field} inputMode="decimal" autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            {NUTRIENT_FIELDS.map((n) => (
              <FormField
                key={n.name}
                control={form.control}
                name={n.name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {n.label}
                      {n.required ? null : <span className="font-normal text-muted-foreground">(opcional)</span>}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="decimal" autoComplete="off" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
          {preview ? (
            preview.ok ? (
              <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground" data-numeric="">
                Por 100 g: <span className="font-semibold text-foreground">{formatNumber(preview.values.energy_kcal)} kcal</span> · P{" "}
                {formatNumber(preview.values.protein_g, 1)} g · C {formatNumber(preview.values.carbs_g, 1)} g · G{" "}
                {formatNumber(preview.values.fat_g, 1)} g
              </p>
            ) : (
              <p className="text-sm text-destructive" role="alert">
                {preview.message}
              </p>
            )
          ) : null}
        </fieldset>

        <fieldset className="grid gap-3" disabled={pending}>
          <legend className="mb-1 text-base font-semibold">Porciones caseras (opcional)</legend>
          <p className="text-sm text-muted-foreground">Por ejemplo «1 rebanada» de 30 g. Así lo registras sin pesar.</p>
          {portions.fields.map((p, index) => (
            <div key={p.id} className="grid gap-3 rounded-2xl border border-border p-3">
              <div className="grid grid-cols-[1fr_auto] items-start gap-2">
                <FormField
                  control={form.control}
                  name={`portions.${index}.label`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="1 rebanada" autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="mt-7 rounded-full"
                  aria-label={`Quitar porción ${index + 1}`}
                  onClick={() => portions.remove(index)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <FormField
                  control={form.control}
                  name={`portions.${index}.quantity`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad</FormLabel>
                      <FormControl>
                        <Input {...field} inputMode="decimal" autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`portions.${index}.unit`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unidad</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="rebanada" autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`portions.${index}.gramWeight`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Peso (g)</FormLabel>
                      <FormControl>
                        <Input {...field} inputMode="decimal" autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name={`portions.${index}.isDefault`}
                render={({ field }) => (
                  <FormItem className="flex min-h-11 flex-row items-center gap-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          // Solo una porción por defecto.
                          if (checked) portions.fields.forEach((_, i) => i !== index && form.setValue(`portions.${i}.isDefault`, false));
                          field.onChange(checked === true);
                        }}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">Usar por defecto al registrar</FormLabel>
                  </FormItem>
                )}
              />
            </div>
          ))}
          {portions.fields.length < 10 ? (
            <Button
              type="button"
              variant="outline"
              className="justify-self-start"
              onClick={() => portions.append({ label: "", quantity: "1", unit: "", gramWeight: "", isDefault: portions.fields.length === 0 })}
            >
              <Plus aria-hidden="true" />
              Agregar porción
            </Button>
          ) : null}
        </fieldset>

        {formError ? (
          <Alert variant="destructive">
            <AlertTitle>No se pudo guardar</AlertTitle>
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Tus alimentos son privados: solo tú los ves y quedan marcados como «Creado por ti · pendiente de verificación».
        </p>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {foodId ? (
            <Button type="button" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)} disabled={pending}>
              <Trash2 aria-hidden="true" />
              Eliminar alimento
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" size="lg" loading={pending}>
            {foodId ? "Guardar cambios" : "Crear alimento"}
          </Button>
        </div>
      </form>

      <Dialog open={confirmDelete} onOpenChange={(open) => !pending && setConfirmDelete(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar este alimento?</DialogTitle>
            <DialogDescription>
              Lo que ya registraste en tu diario se conserva con sus valores. Se quita de tus favoritos y plantillas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={remove} loading={pending}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  );
}
