"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { formatNumber } from "@/lib/format";
import { saveFoodAction } from "../actions/foods";
import { applyFieldErrors } from "../lib/form-errors";
import { FOOD_SOURCE_LABELS, FOOD_TYPE_LABELS, FOOD_TYPES, STAFF_FOOD_SOURCES, VERIFICATION_LABELS, VERIFICATION_STATUSES } from "../lib/labels";
import { atwaterKcal, foodSchema, parseCodes, type FoodData, type FoodInput } from "../schemas";
import { NativeSelect } from "./admin-ui";
import { NumberInput } from "./form-fields";

type NumericField = Extract<
  FieldPath<FoodInput>,
  "energyKcal" | "proteinG" | "carbsG" | "fatG" | "fiberG" | "sugarG" | "saturatedFatG" | "sodiumMg" | "densityGPerMl"
>;

const NUTRIENTS: Array<{ name: NumericField; label: string; unit: string; required?: boolean }> = [
  { name: "energyKcal", label: "Energía", unit: "kcal", required: true },
  { name: "proteinG", label: "Proteína", unit: "g", required: true },
  { name: "carbsG", label: "Carbohidratos", unit: "g", required: true },
  { name: "fatG", label: "Grasa", unit: "g", required: true },
  { name: "fiberG", label: "Fibra", unit: "g" },
  { name: "sugarG", label: "Azúcares", unit: "g" },
  { name: "saturatedFatG", label: "Grasa saturada", unit: "g" },
  { name: "sodiumMg", label: "Sodio", unit: "mg" },
];

export const EMPTY_FOOD: FoodInput = {
  id: null,
  name: "",
  brandName: "",
  description: "",
  foodType: "generic",
  barcode: "",
  countryCodes: ["PE"],
  energyKcal: null as unknown as number,
  proteinG: null as unknown as number,
  carbsG: null as unknown as number,
  fatG: null as unknown as number,
  fiberG: null,
  sugarG: null,
  saturatedFatG: null,
  sodiumMg: null,
  densityGPerMl: null,
  source: "curated",
  sourceRef: "",
  sourceUrl: "",
  license: "",
  verificationStatus: "unverified",
  isPublic: true,
  portions: [],
};

/** Crear o editar un alimento del catálogo público (macros por 100 g, porciones y procedencia). */
export function FoodForm({ initial, usedInPublishedRecipes = 0 }: { initial: FoodInput; usedInPublishedRecipes?: number }) {
  const router = useRouter();
  const form = useForm<FoodInput, unknown, FoodData>({ resolver: zodResolver(foodSchema), defaultValues: initial, mode: "onBlur" });
  const portions = useFieldArray({ control: form.control, name: "portions" });
  const [countriesText, setCountriesText] = React.useState((initial.countryCodes ?? []).join(", "));
  const isEdit = Boolean(initial.id);

  const [energy, protein, carbs, fat] = useWatch({ control: form.control, name: ["energyKcal", "proteinG", "carbsG", "fatG"] });
  const isPublic = useWatch({ control: form.control, name: "isPublic" });
  const macrosReady = [energy, protein, carbs, fat].every((v) => typeof v === "number" && Number.isFinite(v));
  const expected = macrosReady ? atwaterKcal({ proteinG: protein, carbsG: carbs, fatG: fat }) : null;
  // Aviso (no bloquea): fibra, alcohol o polioles pueden explicar diferencias moderadas.
  const atwaterOff = expected != null && Math.abs(energy - expected) > Math.max(25, expected * 0.15);

  const onSubmit = form.handleSubmit(async () => {
    const result = await saveFoodAction(form.getValues());
    if (!result.ok) {
      applyFieldErrors(form.setError, result.error);
      toast.error(result.error.message);
      return;
    }
    toast.success(isEdit ? "Alimento guardado." : "Alimento creado.");
    if (isEdit) {
      form.reset(form.getValues());
      router.refresh();
    } else {
      router.push(`/admin/alimentos/${result.data.id}`);
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle as="h2">Identificación</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={200} placeholder="Ej.: Quinua cocida" autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="brandName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marca (opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} maxLength={120} autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="foodType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <FormControl>
                    <NativeSelect {...field}>
                      {FOOD_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {FOOD_TYPE_LABELS[t]}
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
              name="barcode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código de barras (opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} inputMode="numeric" maxLength={20} autoComplete="off" />
                  </FormControl>
                  <FormDescription>De 6 a 14 dígitos.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="countryCodes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Países</FormLabel>
                  <FormControl>
                    <Input
                      name={field.name}
                      ref={field.ref}
                      value={countriesText}
                      onChange={(e) => {
                        setCountriesText(e.target.value);
                        field.onChange(parseCodes(e.target.value));
                      }}
                      onBlur={field.onBlur}
                      placeholder="PE, CL"
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormDescription>Códigos de 2 letras separados por coma. Vacío = cualquier país.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Descripción (opcional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} maxLength={2000} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Valores por 100 g</CardTitle>
            <CardDescription>Energía, proteína, carbohidratos y grasa son obligatorios. Deja vacío lo que la fuente no informa (no pongas 0).</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {NUTRIENTS.map((n) => (
                <FormField
                  key={n.name}
                  control={form.control}
                  name={n.name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {n.label} ({n.unit}){n.required ? null : <span className="font-normal text-muted-foreground"> · opcional</span>}
                      </FormLabel>
                      <FormControl>
                        <NumberInput name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value as number | null} onValueChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <FormField
                control={form.control}
                name="densityGPerMl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Densidad (g/ml)<span className="font-normal text-muted-foreground"> · opcional</span>
                    </FormLabel>
                    <FormControl>
                      <NumberInput name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value ?? null} onValueChange={field.onChange} />
                    </FormControl>
                    <FormDescription>Para líquidos medidos en ml.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {atwaterOff && expected != null ? (
              <Alert variant="warning">
                <AlertTriangle aria-hidden="true" />
                <AlertTitle>Revisa la energía</AlertTitle>
                <AlertDescription>
                  <p>
                    Con estos macros se esperarían unas {formatNumber(expected)} kcal (4/4/9) y escribiste {formatNumber(energy)} kcal. Puede ser
                    correcto (alcohol, polioles, fibra), pero confírmalo con la fuente.
                  </p>
                </AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Porciones caseras</CardTitle>
            <CardDescription>Ej.: «1 taza» = 1 taza = 185 g. La predeterminada aparece primero al registrar.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {portions.fields.length === 0 ? <p className="text-sm text-muted-foreground">Sin porciones: se registrará en gramos.</p> : null}
            <ul className="grid gap-3">
              {portions.fields.map((p, index) => (
                <li key={p.id} className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-start">
                  <FormField
                    control={form.control}
                    name={`portions.${index}.label`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="1 taza" maxLength={80} autoComplete="off" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`portions.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cantidad</FormLabel>
                        <FormControl>
                          <NumberInput name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value} onValueChange={field.onChange} />
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
                          <Input {...field} placeholder="taza" maxLength={30} autoComplete="off" />
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
                        <FormLabel>Gramos</FormLabel>
                        <FormControl>
                          <NumberInput name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value} onValueChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-center justify-between gap-3 sm:h-full sm:flex-col sm:items-end sm:justify-start sm:pt-7">
                    <FormField
                      control={form.control}
                      name={`portions.${index}.isDefault`}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                // Solo una predeterminada: al marcar una, se desmarcan las demás.
                                if (checked === true) {
                                  form.getValues("portions").forEach((_, i) => i !== index && form.setValue(`portions.${i}.isDefault`, false, { shouldDirty: true }));
                                }
                                field.onChange(checked === true);
                              }}
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal">Predeterminada</FormLabel>
                        </FormItem>
                      )}
                    />
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Quitar porción ${index + 1}`} onClick={() => portions.remove(index)}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            {form.formState.errors.portions?.message ? <p className="text-sm text-destructive">{form.formState.errors.portions.message}</p> : null}
            <div>
              <Button
                type="button"
                variant="outline"
                disabled={portions.fields.length >= 20}
                onClick={() => portions.append({ id: null, label: "", quantity: 1, unit: "", gramWeight: null as unknown as number, isDefault: portions.fields.length === 0 })}
              >
                <Plus aria-hidden="true" />
                Agregar porción
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Procedencia y publicación</CardTitle>
            <CardDescription>La procedencia es obligatoria: se muestra junto a los valores en toda la app.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fuente</FormLabel>
                  <FormControl>
                    <NativeSelect {...field}>
                      {STAFF_FOOD_SOURCES.map((s) => (
                        <option key={s} value={s}>
                          {FOOD_SOURCE_LABELS[s]}
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
              name="sourceRef"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Referencia de la fuente</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={300} placeholder="Tabla peruana de composición 2017, código A-12" autoComplete="off" />
                  </FormControl>
                  <FormDescription>Tabla, etiqueta o código exacto del que salen los valores.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sourceUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL de la fuente (opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} type="url" inputMode="url" maxLength={500} placeholder="https://…" autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="license"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Licencia (opcional)</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} maxLength={200} placeholder="Dominio público, ODbL…" autoComplete="off" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="verificationStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Verificación</FormLabel>
                  <FormControl>
                    <NativeSelect {...field}>
                      {VERIFICATION_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {VERIFICATION_LABELS[s]}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormControl>
                  <FormDescription>Rechazado lo saca de las búsquedas sin borrarlo.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isPublic"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-3 rounded-xl border border-border px-3 py-3">
                  <div className="grid gap-1">
                    <FormLabel>Publicado en el catálogo</FormLabel>
                    <FormDescription>
                      {usedInPublishedRecipes > 0
                        ? `Lo usan ${usedInPublishedRecipes} receta(s) publicada(s): no se puede despublicar sin fusionarlo antes.`
                        : "Visible para todas las personas al buscar."}
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {form.formState.errors.root ? <p className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
            {isEdit ? "Guardar cambios" : "Crear alimento"}
          </Button>
          {!isPublic ? <p className="text-sm text-muted-foreground">Quedará fuera del catálogo público.</p> : null}
          {form.formState.isDirty && isEdit ? <p className="text-sm text-muted-foreground">Tienes cambios sin guardar.</p> : null}
        </div>
      </form>
    </Form>
  );
}
