"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link2, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { FoodSearchField } from "@/features/recipes/components/food-search-field";
import { saveReferencePriceAction } from "../actions/foods";
import { applyFieldErrors } from "../lib/form-errors";
import { PRICE_UNIT_LABELS, PRICE_UNITS } from "../lib/labels";
import { referencePriceSchema, type ReferencePriceInput } from "../schemas";
import { NativeSelect } from "./admin-ui";
import { NumberInput } from "./form-fields";

export type PriceFormValues = ReferencePriceInput & { foodName?: string | null };

/** Botón + diálogo para crear o editar un precio referencial. */
export function PriceDialog({ initial, mode }: { initial: PriceFormValues; mode: "create" | "edit" }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      {mode === "create" ? (
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus aria-hidden="true" />
          Nuevo precio
        </Button>
      ) : (
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar precio de ${initial.itemName}`} onClick={() => setOpen(true)}>
          <Pencil aria-hidden="true" />
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Nuevo precio referencial" : "Editar precio referencial"}</DialogTitle>
            <DialogDescription>Precio observado en una fecha y lugar concretos. Se muestra como referencia, nunca como precio en tiempo real.</DialogDescription>
          </DialogHeader>
          {open ? <PriceForm initial={initial} onDone={() => setOpen(false)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PriceForm({ initial, onDone }: { initial: PriceFormValues; onDone: () => void }) {
  const router = useRouter();
  const { foodName: initialFoodName, ...defaults } = initial;
  const form = useForm<ReferencePriceInput>({ resolver: zodResolver(referencePriceSchema), defaultValues: defaults });
  const [foodName, setFoodName] = React.useState<string | null>(initialFoodName ?? null);
  const foodId = useWatch({ control: form.control, name: "foodId" });

  const onSubmit = form.handleSubmit(async () => {
    const result = await saveReferencePriceAction(form.getValues());
    if (!result.ok) {
      applyFieldErrors(form.setError, result.error);
      toast.error(result.error.message);
      return;
    }
    toast.success(initial.id ? "Precio guardado." : "Precio creado.");
    onDone();
    router.refresh();
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormField
          control={form.control}
          name="itemName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Producto</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Pollo entero" maxLength={200} autoComplete="off" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-2">
          <p className="text-sm font-medium">Alimento del catálogo (opcional)</p>
          {foodId ? (
            <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2">
              <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm">{foodName ?? "Alimento vinculado"}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Quitar vínculo"
                onClick={() => {
                  form.setValue("foodId", null, { shouldDirty: true });
                  setFoodName(null);
                }}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <FoodSearchField
              label="Vincular con un alimento"
              placeholder="Busca en el catálogo"
              onSelect={(food) => {
                if (food.isOwn) {
                  toast.error("Ese alimento es tuyo (privado). Vincula uno del catálogo público.");
                  return;
                }
                form.setValue("foodId", food.id, { shouldDirty: true });
                setFoodName(food.brandName ? `${food.name} · ${food.brandName}` : food.name);
                if (!form.getValues("itemName")) form.setValue("itemName", food.name);
              }}
            />
          )}
          <FormField control={form.control} name="foodId" render={() => <FormMessage />} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Precio</FormLabel>
                <FormControl>
                  <NumberInput name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value} onValueChange={field.onChange} />
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
                  <Input {...field} maxLength={3} autoComplete="off" className="uppercase" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="perQuantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Por cantidad</FormLabel>
                <FormControl>
                  <NumberInput name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value} onValueChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="perUnit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unidad</FormLabel>
                <FormControl>
                  <NativeSelect {...field}>
                    {PRICE_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {PRICE_UNIT_LABELS[u]}
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
            name="countryCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>País</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={2} autoComplete="off" className="uppercase" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="observedOn"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha</FormLabel>
                <FormControl>
                  <Input {...field} type="date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="source"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fuente</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Mercado N.º 1 de Surquillo" maxLength={300} autoComplete="off" />
              </FormControl>
              <FormDescription>Dónde y cómo se observó el precio.</FormDescription>
              <FormMessage />
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
