"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FoodSearchField } from "@/features/recipes/components/food-search-field";
import { ToggleChip } from "@/features/recipes/components/toggle-chip";
import {
  ALLERGEN_LABELS,
  ALLERGENS,
  DIET_TAG_LABELS,
  DIET_TAGS,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  RECIPE_MEAL_TYPE_LABELS,
  RECIPE_MEAL_TYPES,
} from "@/features/recipes/lib/labels";
import { saveOfficialRecipeAction } from "../actions/recipes";
import { applyFieldErrors } from "../lib/form-errors";
import { officialRecipeSchema, type OfficialRecipeData, type OfficialRecipeInput } from "../schemas";
import { NativeSelect } from "./admin-ui";
import { NumberInput } from "./form-fields";

export type IngredientFood = {
  name: string;
  brandName: string | null;
  per100g: { energyKcal: number; proteinG: number; carbsG: number; fatG: number } | null;
};

export const EMPTY_OFFICIAL_RECIPE: OfficialRecipeInput = {
  recipeId: null,
  title: "",
  description: "",
  servings: 1,
  prepMinutes: null,
  cookMinutes: null,
  difficulty: null,
  steps: [""],
  tags: [],
  dietTags: [],
  allergens: [],
  mealTypes: [],
  estimatedCost: null,
  costCurrency: "PEN",
  status: "draft",
  ingredients: [],
};

function toggle<T extends string>(list: readonly T[] | undefined, value: T, on: boolean): T[] {
  const set = new Set(list ?? []);
  if (on) set.add(value);
  else set.delete(value);
  return [...set];
}

/** Crear o editar una receta oficial: ingredientes del catálogo público, pasos, etiquetas y alérgenos. */
export function OfficialRecipeForm({ initial, foods }: { initial: OfficialRecipeInput; foods: Record<string, IngredientFood> }) {
  const router = useRouter();
  const form = useForm<OfficialRecipeInput, unknown, OfficialRecipeData>({ resolver: zodResolver(officialRecipeSchema), defaultValues: initial, mode: "onBlur" });
  const ingredients = useFieldArray({ control: form.control, name: "ingredients" });
  const [foodInfo, setFoodInfo] = React.useState<Record<string, IngredientFood>>(foods);
  const [tagsText, setTagsText] = React.useState((initial.tags ?? []).join(", "));
  const isEdit = Boolean(initial.recipeId);

  const values = useWatch({ control: form.control }) as OfficialRecipeInput;
  const steps = values.steps ?? [];
  const servings = typeof values.servings === "number" && values.servings > 0 ? values.servings : null;
  const totals = (values.ingredients ?? []).reduce(
    (acc, ing) => {
      const f = foodInfo[ing.foodId]?.per100g;
      const g = typeof ing.grams === "number" && Number.isFinite(ing.grams) ? ing.grams : 0;
      if (!f) return { ...acc, missing: acc.missing + 1 };
      return {
        ...acc,
        kcal: acc.kcal + (f.energyKcal * g) / 100,
        protein: acc.protein + (f.proteinG * g) / 100,
        carbs: acc.carbs + (f.carbsG * g) / 100,
        fat: acc.fat + (f.fatG * g) / 100,
      };
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0, missing: 0 },
  );

  const onSubmit = form.handleSubmit(async () => {
    const result = await saveOfficialRecipeAction(form.getValues());
    if (!result.ok) {
      applyFieldErrors(form.setError, result.error);
      toast.error(result.error.message);
      return;
    }
    toast.success(isEdit ? "Receta guardada." : "Receta creada. Ahora puedes subir su imagen.");
    if (isEdit) {
      form.reset(form.getValues());
      router.refresh();
    } else {
      router.push(`/admin/recetas/${result.data.id}`);
    }
  });

  function setSteps(next: string[]) {
    form.setValue("steps", next, { shouldDirty: true });
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle as="h2">Datos generales</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={160} autoComplete="off" />
                  </FormControl>
                  {isEdit ? <FormDescription>Cambiar el título no cambia la dirección (slug) ni la imagen.</FormDescription> : null}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} rows={3} maxLength={4000} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-3 gap-4 sm:col-span-2">
              <FormField
                control={form.control}
                name="servings"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Porciones</FormLabel>
                    <FormControl>
                      <NumberInput name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value} onValueChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="prepMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preparación (min)</FormLabel>
                    <FormControl>
                      <NumberInput decimals={false} name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value ?? null} onValueChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cookMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cocción (min)</FormLabel>
                    <FormControl>
                      <NumberInput decimals={false} name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value ?? null} onValueChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="difficulty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dificultad</FormLabel>
                  <FormControl>
                    <NativeSelect
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
                    >
                      <option value="">Sin indicar</option>
                      {DIFFICULTIES.map((d) => (
                        <option key={d} value={d}>
                          {DIFFICULTY_LABELS[d]}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-[2fr_1fr] gap-4">
              <FormField
                control={form.control}
                name="estimatedCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Costo estimado</FormLabel>
                    <FormControl>
                      <NumberInput name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value ?? null} onValueChange={field.onChange} />
                    </FormControl>
                    <FormDescription>Total de la receta. Opcional.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="costCurrency"
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
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Clasificación</CardTitle>
            <CardDescription>Comidas, dieta y alérgenos se usan en filtros y en los planes. Revisa los alérgenos con los ingredientes.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <ChipGroup
              label="Comidas"
              error={form.formState.errors.mealTypes?.message}
              options={RECIPE_MEAL_TYPES.map((v) => ({ value: v, label: RECIPE_MEAL_TYPE_LABELS[v] }))}
              selected={values.mealTypes ?? []}
              onToggle={(v, on) => form.setValue("mealTypes", toggle(values.mealTypes, v, on), { shouldDirty: true, shouldValidate: true })}
            />
            <ChipGroup
              label="Dieta"
              options={DIET_TAGS.map((v) => ({ value: v, label: DIET_TAG_LABELS[v] }))}
              selected={values.dietTags ?? []}
              onToggle={(v, on) => form.setValue("dietTags", toggle(values.dietTags, v, on), { shouldDirty: true })}
            />
            <ChipGroup
              label="Alérgenos"
              options={ALLERGENS.map((v) => ({ value: v, label: ALLERGEN_LABELS[v] }))}
              selected={values.allergens ?? []}
              onToggle={(v, on) => form.setValue("allergens", toggle(values.allergens, v, on), { shouldDirty: true })}
            />
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Etiquetas libres</FormLabel>
                  <FormControl>
                    <Input
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={tagsText}
                      onChange={(e) => {
                        setTagsText(e.target.value);
                        field.onChange(
                          e.target.value
                            .split(",")
                            .map((t) => t.trim().toLowerCase())
                            .filter(Boolean),
                        );
                      }}
                      placeholder="peruana, sin horno"
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormDescription>Separadas por coma (máximo 15).</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Ingredientes</CardTitle>
            <CardDescription>Solo alimentos del catálogo público: la nutrición se calcula con sus valores por 100 g.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {ingredients.fields.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay ingredientes.</p> : null}
            <ol className="grid gap-3">
              {ingredients.fields.map((ing, index) => {
                const info = foodInfo[ing.foodId];
                return (
                  <li key={ing.id} className="grid gap-3 rounded-xl border border-border p-3">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 font-medium">
                        {info?.name ?? "Alimento no disponible"}
                        {info?.brandName ? <span className="font-normal text-muted-foreground"> · {info.brandName}</span> : null}
                      </p>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Subir ingrediente" disabled={index === 0} onClick={() => ingredients.move(index, index - 1)}>
                        <ArrowUp aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Bajar ingrediente"
                        disabled={index === ingredients.fields.length - 1}
                        onClick={() => ingredients.move(index, index + 1)}
                      >
                        <ArrowDown aria-hidden="true" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Quitar ${info?.name ?? "ingrediente"}`} onClick={() => ingredients.remove(index)}>
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <FormField
                        control={form.control}
                        name={`ingredients.${index}.grams`}
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
                      <FormField
                        control={form.control}
                        name={`ingredients.${index}.displayQuantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cantidad casera</FormLabel>
                            <FormControl>
                              <NumberInput name={field.name} ref={field.ref} onBlur={field.onBlur} value={field.value ?? null} onValueChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`ingredients.${index}.displayUnit`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Medida</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value ?? ""} placeholder="taza" maxLength={40} autoComplete="off" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`ingredients.${index}.note`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nota</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value ?? ""} placeholder="picado" maxLength={300} autoComplete="off" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
            {form.formState.errors.ingredients?.message ? <p className="text-sm text-destructive">{form.formState.errors.ingredients.message}</p> : null}
            {ingredients.fields.length < 40 ? (
              <FoodSearchField
                label="Agregar ingrediente"
                onSelect={(food) => {
                  if (food.isOwn) {
                    toast.error("Ese alimento es tuyo (privado). Usa uno del catálogo público.");
                    return;
                  }
                  setFoodInfo((prev) => ({
                    ...prev,
                    [food.id]: {
                      name: food.name,
                      brandName: food.brandName,
                      per100g: { energyKcal: food.per100g.energyKcal, proteinG: food.per100g.proteinG, carbsG: food.per100g.carbsG, fatG: food.per100g.fatG },
                    },
                  }));
                  const portion = food.portions.find((p) => p.isDefault);
                  ingredients.append({
                    foodId: food.id,
                    grams: portion ? portion.gramWeight : 100,
                    displayQuantity: portion ? portion.quantity : null,
                    displayUnit: portion ? portion.unit : null,
                    note: null,
                  });
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Llegaste al máximo de 40 ingredientes.</p>
            )}
            <div className="grid gap-1 rounded-xl bg-muted px-4 py-3 text-sm" aria-live="polite">
              <p className="font-medium">Vista previa por porción{servings ? "" : " (indica las porciones)"}</p>
              {servings ? (
                <p data-numeric="">
                  {formatNumber(totals.kcal / servings)} kcal · P {formatNumber(totals.protein / servings, 1)} g · C {formatNumber(totals.carbs / servings, 1)} g · G{" "}
                  {formatNumber(totals.fat / servings, 1)} g
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Calculada con los valores del catálogo; al guardar, la base la recalcula.
                {totals.missing ? ` ${totals.missing} ingrediente(s) sin datos no se suman.` : ""}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Preparación</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ol className="grid gap-3">
              {steps.map((_, index) => (
                <li key={index} className="grid gap-2">
                  <FormField
                    control={form.control}
                    name={`steps.${index}`}
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <FormLabel className="flex-1">Paso {index + 1}</FormLabel>
                          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Subir paso ${index + 1}`} disabled={index === 0} onClick={() => setSteps(swap(steps, index, index - 1))}>
                            <ArrowUp aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Bajar paso ${index + 1}`}
                            disabled={index === steps.length - 1}
                            onClick={() => setSteps(swap(steps, index, index + 1))}
                          >
                            <ArrowDown aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Quitar paso ${index + 1}`}
                            disabled={steps.length === 1}
                            onClick={() => setSteps(steps.filter((__, i) => i !== index))}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                        <FormControl>
                          <Textarea {...field} value={field.value ?? ""} rows={2} maxLength={1000} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </li>
              ))}
            </ol>
            {form.formState.errors.steps?.message ? <p className="text-sm text-destructive">{form.formState.errors.steps.message}</p> : null}
            <div>
              <Button type="button" variant="outline" disabled={steps.length >= 30} onClick={() => setSteps([...steps, ""])}>
                <Plus aria-hidden="true" />
                Agregar paso
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-3">
                  <div className="grid gap-1">
                    <FormLabel>Publicada</FormLabel>
                    <FormDescription>{field.value === "published" ? "Visible en el catálogo de recetas." : "Borrador: solo la ve el equipo."}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value === "published"} onCheckedChange={(on) => field.onChange(on ? "published" : "draft")} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {form.formState.errors.root ? <p className="text-sm text-destructive">{form.formState.errors.root.message}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
            {isEdit ? "Guardar receta" : "Crear receta"}
          </Button>
          {form.formState.isDirty && isEdit ? <p className="text-sm text-muted-foreground">Tienes cambios sin guardar.</p> : null}
        </div>
      </form>
    </Form>
  );
}

function swap<T>(list: readonly T[], a: number, b: number): T[] {
  const next = [...list];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
  error,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  selected: readonly string[];
  onToggle: (value: T, on: boolean) => void;
  error?: string;
}) {
  const id = React.useId();
  return (
    <div role="group" aria-labelledby={id} className="grid gap-2">
      <p id={id} className="text-sm font-medium">
        {label}
      </p>
      <div className={cn("flex flex-wrap gap-2", error && "rounded-xl ring-1 ring-destructive")}>
        {options.map((o) => (
          <ToggleChip key={o.value} pressed={selected.includes(o.value)} onPressedChange={(on) => onToggle(o.value, on)}>
            {o.label}
          </ToggleChip>
        ))}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
