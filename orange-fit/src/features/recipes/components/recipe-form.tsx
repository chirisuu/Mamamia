"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/format";
import type { NutrientsPer100g } from "@/lib/nutrition";
import { cn } from "@/lib/utils";
import { saveRecipeAction } from "../actions";
import { totalMinutes } from "../lib/adapters";
import { amountFor, GRAMS_UNIT, newIngredientRow, rowWithQuantity, toRecipeFormInput, type IngredientRow, type RecipeEditorValues } from "../lib/editor";
import type { FoodPortion, FoodSearchResult } from "../lib/food-api";
import {
  ALLERGEN_LABELS,
  ALLERGENS,
  DECLARED_DIET_TAGS,
  DIET_TAG_LABELS,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  RECIPE_MEAL_TYPE_LABELS,
  RECIPE_MEAL_TYPES,
} from "../lib/labels";
import { computedDietTags, liveRecipeNutrition } from "../lib/nutrition";
import { recipeFormSchema } from "../schemas";
import { FoodSearchField } from "./food-search-field";
import { ToggleChip } from "./toggle-chip";

export interface KnownFood {
  name: string;
  per100g: NutrientsPer100g | null;
  portions: FoodPortion[];
  isOwn?: boolean;
}

/** Texto numérico → número (acepta coma). Vacío → null. */
function parseNum(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function NumberInput({
  id,
  value,
  onChange,
  invalid,
  decimals = true,
  ...rest
}: {
  id: string;
  value: number | null;
  onChange: (v: number | null) => void;
  invalid?: boolean;
  decimals?: boolean;
} & Omit<React.ComponentProps<"input">, "value" | "onChange" | "id">) {
  const [draft, setDraft] = React.useState<string | null>(null);
  return (
    <Input
      id={id}
      inputMode={decimals ? "decimal" : "numeric"}
      value={draft ?? (value == null ? "" : String(value))}
      aria-invalid={invalid || undefined}
      onChange={(e) => {
        const next = e.target.value;
        if (!/^\d*[.,]?\d*$/.test(next)) return;
        setDraft(next);
        onChange(parseNum(next));
      }}
      onBlur={() => setDraft(null)}
      {...rest}
    />
  );
}

/**
 * Crear o editar una receta propia. La nutrición se calcula en vivo desde los ingredientes (y el
 * servidor la vuelve a calcular). Se guarda como borrador o se envía a revisión; publicar es del staff.
 */
export function RecipeForm({
  recipeId,
  initialValues,
  initialFoods,
  wasPublished = false,
}: {
  recipeId?: string;
  initialValues: RecipeEditorValues;
  initialFoods: Record<string, KnownFood>;
  wasPublished?: boolean;
}) {
  const router = useRouter();
  const [foods, setFoods] = React.useState<Record<string, KnownFood>>(initialFoods);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [intent, setIntent] = React.useState<"draft" | "review" | null>(null);
  const form = useForm<RecipeEditorValues>({ defaultValues: initialValues });
  const { control, register, handleSubmit, setError, clearErrors, formState } = form;
  const ingredients = useFieldArray({ control, name: "ingredients" });
  const steps = useFieldArray({ control, name: "steps" });

  const watchedIngredients = useWatch({ control, name: "ingredients" });
  const servings = useWatch({ control, name: "servings" });
  const prep = useWatch({ control, name: "prepMinutes" });
  const cook = useWatch({ control, name: "cookMinutes" });
  const live = React.useMemo(
    () =>
      liveRecipeNutrition(
        (watchedIngredients ?? []).map((i) => ({ grams: i.grams, per100g: foods[i.foodId]?.per100g ?? null })),
        servings ?? 0,
      ),
    [watchedIngredients, servings, foods],
  );
  const autoTags = computedDietTags(live.perServing, totalMinutes(prep, cook));
  const ownFoods = (watchedIngredients ?? []).filter((i) => foods[i.foodId]?.isOwn);

  const addFood = (food: FoodSearchResult) => {
    setFoods((prev) => ({ ...prev, [food.id]: { name: food.name, per100g: food.per100g, portions: food.portions, isOwn: food.isOwn } }));
    ingredients.append(newIngredientRow(food));
    clearErrors("ingredients");
  };

  const submit = (which: "draft" | "review") =>
    handleSubmit((values) => {
      setFormError(null);
      const input = toRecipeFormInput(values, which);
      const parsed = recipeFormSchema.safeParse(input);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const [head, index, leaf] = issue.path as [string, number | undefined, string | undefined];
          if (head === "ingredients" && typeof index === "number") {
            setError(`ingredients.${index}.quantity`, { message: leaf === "grams" ? "Indica una cantidad mayor que 0." : issue.message });
          } else if (head === "steps" && typeof index === "number") {
            setError(`steps.${index}.text`, { message: issue.message });
          } else if (head === "tags") {
            setError("tagsText", { message: issue.message });
          } else if (head) {
            setError(head as keyof RecipeEditorValues, { message: issue.message });
          }
        }
        setFormError("Revisa los campos marcados.");
        return;
      }
      setIntent(which);
      startTransition(async () => {
        const res = await saveRecipeAction({ ...parsed.data, recipeId: recipeId ?? null });
        setIntent(null);
        if (!res.ok) {
          setFormError(res.error.message);
          toast.error(res.error.message);
          return;
        }
        toast.success(which === "review" ? "Enviada a revisión" : "Borrador guardado");
        router.push(`/app/recetas/${res.data.slug}`);
        router.refresh();
      });
    })();

  const err = formState.errors;

  return (
    <form
      className="flex flex-col gap-8 pb-10"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit("draft");
      }}
    >
      {wasPublished ? (
        <Alert variant="info">
          <AlertTitle>Esta receta está publicada</AlertTitle>
          <AlertDescription>
            <p>Si guardas cambios, vuelve a revisión y deja de verse en el catálogo hasta que el equipo la apruebe.</p>
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="flex flex-col gap-4" aria-labelledby="datos">
        <h2 id="datos" className="text-lg font-semibold tracking-tight">
          Datos
        </h2>
        <div className="flex flex-col gap-2">
          <Label htmlFor="title">Título</Label>
          <Input id="title" aria-invalid={err.title ? true : undefined} aria-describedby={err.title ? "title-error" : undefined} {...register("title")} />
          {err.title ? (
            <p id="title-error" className="text-sm text-destructive">
              {err.title.message}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="description">Descripción (opcional)</Label>
          <Textarea id="description" rows={3} {...register("description")} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="servings">Porciones</Label>
            <Controller
              control={control}
              name="servings"
              render={({ field }) => <NumberInput id="servings" value={field.value} onChange={field.onChange} invalid={Boolean(err.servings)} />}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="prep">Preparación (min)</Label>
            <Controller
              control={control}
              name="prepMinutes"
              render={({ field }) => <NumberInput id="prep" decimals={false} value={field.value} onChange={field.onChange} invalid={Boolean(err.prepMinutes)} />}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cook">Cocción (min)</Label>
            <Controller
              control={control}
              name="cookMinutes"
              render={({ field }) => <NumberInput id="cook" decimals={false} value={field.value} onChange={field.onChange} invalid={Boolean(err.cookMinutes)} />}
            />
          </div>
        </div>
        {err.servings || err.prepMinutes || err.cookMinutes ? (
          <p className="text-sm text-destructive">{err.servings?.message ?? err.prepMinutes?.message ?? err.cookMinutes?.message}</p>
        ) : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="difficulty">Dificultad</Label>
          <Controller
            control={control}
            name="difficulty"
            render={({ field }) => (
              <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                <SelectTrigger id="difficulty">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin indicar</SelectItem>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {DIFFICULTY_LABELS[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <Controller
          control={control}
          name="mealTypes"
          render={({ field }) => (
            <fieldset className="flex flex-col gap-2" aria-invalid={err.mealTypes ? true : undefined}>
              <legend className="mb-2 text-sm font-medium">¿Para qué comidas sirve?</legend>
              <div className="flex flex-wrap gap-2">
                {RECIPE_MEAL_TYPES.map((m) => (
                  <ToggleChip
                    key={m}
                    pressed={field.value.includes(m)}
                    onPressedChange={(on) => field.onChange(on ? [...field.value, m] : field.value.filter((x) => x !== m))}
                  >
                    {RECIPE_MEAL_TYPE_LABELS[m]}
                  </ToggleChip>
                ))}
              </div>
              {err.mealTypes ? <p className="text-sm text-destructive">{err.mealTypes.message}</p> : null}
            </fieldset>
          )}
        />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="ingredientes">
        <h2 id="ingredientes" className="text-lg font-semibold tracking-tight">
          Ingredientes
        </h2>
        <FoodSearchField onSelect={addFood} label="Agregar ingrediente" />
        {err.ingredients?.message || err.ingredients?.root?.message ? (
          <p className="text-sm text-destructive" role="alert">
            {err.ingredients?.message ?? err.ingredients?.root?.message}
          </p>
        ) : null}
        {ingredients.fields.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Busca y agrega los ingredientes con su cantidad. La nutrición se calcula sola.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {ingredients.fields.map((field, index) => {
              const known = foods[field.foodId];
              const row = watchedIngredients?.[index] ?? field;
              const rowError = err.ingredients?.[index]?.quantity?.message;
              return (
                <li key={field.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">{field.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {formatNumber(row.grams, row.grams < 10 ? 1 : 0)} g
                        {known?.per100g ? ` · ${formatNumber((known.per100g.energyKcal * row.grams) / 100)} kcal` : ""}
                        {known?.isOwn ? " · alimento propio" : ""}
                      </p>
                    </div>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Quitar ${field.name}`} onClick={() => ingredients.remove(index)}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-[1fr_1.4fr] gap-3">
                    <Controller
                      control={control}
                      name={`ingredients.${index}.quantity`}
                      render={({ field: q }) => (
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`ing-q-${field.id}`}>Cantidad</Label>
                          <NumberInput
                            id={`ing-q-${field.id}`}
                            value={q.value}
                            invalid={Boolean(rowError)}
                            onChange={(v) => {
                              q.onChange(v);
                              const current = form.getValues(`ingredients.${index}`) as IngredientRow;
                              const next = rowWithQuantity(current, v, known?.portions ?? []);
                              form.setValue(`ingredients.${index}.unit`, next.unit);
                              form.setValue(`ingredients.${index}.grams`, next.grams);
                              form.setValue(`ingredients.${index}.displayQuantity`, next.displayQuantity);
                              form.setValue(`ingredients.${index}.displayUnit`, next.displayUnit);
                            }}
                          />
                        </div>
                      )}
                    />
                    <Controller
                      control={control}
                      name={`ingredients.${index}.unit`}
                      render={({ field: u }) => (
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor={`ing-u-${field.id}`}>Medida</Label>
                          <Select
                            value={u.value}
                            onValueChange={(unit) => {
                              u.onChange(unit);
                              // Al pasar a gramos se conservan los gramos actuales; a una porción, 1 porción.
                              const qty = unit === GRAMS_UNIT ? form.getValues(`ingredients.${index}.grams`) : 1;
                              form.setValue(`ingredients.${index}.quantity`, qty);
                              const a = amountFor(qty, unit, known?.portions ?? []);
                              form.setValue(`ingredients.${index}.grams`, a.grams);
                              form.setValue(`ingredients.${index}.displayQuantity`, a.displayQuantity);
                              form.setValue(`ingredients.${index}.displayUnit`, a.displayUnit);
                            }}
                          >
                            <SelectTrigger id={`ing-u-${field.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {u.value === "display" ? (
                                <SelectItem value="display">
                                  {row.displayQuantity != null ? `${formatNumber(row.displayQuantity, 2)} ` : ""}
                                  {row.displayUnit ?? "Medida guardada"}
                                </SelectItem>
                              ) : null}
                              <SelectItem value={GRAMS_UNIT}>gramos</SelectItem>
                              {(known?.portions ?? []).map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.label} ({formatNumber(p.gramWeight)} g)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    />
                  </div>
                  {rowError ? <p className="text-sm text-destructive">{rowError}</p> : null}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`ing-n-${field.id}`}>Nota (opcional)</Label>
                    <Input id={`ing-n-${field.id}`} placeholder="Ej.: picado en cubos" {...register(`ingredients.${index}.note`)} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {ownFoods.length ? (
          <p className="text-xs text-muted-foreground">
            Usas alimentos que creaste tú. Puedes guardar la receta para ti; para publicarla, el equipo necesitará alimentos del catálogo.
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5" aria-labelledby="nutricion-vivo" aria-live="polite">
        <h2 id="nutricion-vivo" className="text-base font-semibold">
          Nutrición por porción (en vivo)
        </h2>
        {live.perServing ? (
          <>
            <p className="text-sm tabular-nums">
              <span className="text-lg font-semibold">{formatNumber(live.perServing.kcal)} kcal</span> · {formatNumber(live.perServing.proteinG, 1)} g proteína ·{" "}
              {formatNumber(live.perServing.carbsG, 1)} g carbohidratos · {formatNumber(live.perServing.fatG, 1)} g grasas ·{" "}
              {live.perServing.fiberIncomplete ? "≥ " : ""}
              {formatNumber(live.perServing.fiberG, 1)} g fibra
            </p>
            <p className="text-xs text-muted-foreground">Calculada desde los ingredientes. Al guardar, el servidor la vuelve a calcular con la base.</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Agrega ingredientes e indica las porciones para ver la nutrición.</p>
        )}
        {autoTags.length ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            Se marcará como:
            {autoTags.map((t) => (
              <Badge key={t} variant="soft">
                {DIET_TAG_LABELS[t as keyof typeof DIET_TAG_LABELS]}
              </Badge>
            ))}
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="pasos">
        <h2 id="pasos" className="text-lg font-semibold tracking-tight">
          Pasos
        </h2>
        <ol className="flex flex-col gap-3">
          {steps.fields.map((field, index) => (
            <li key={field.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`step-${field.id}`}>Paso {index + 1}</Label>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Subir paso ${index + 1}`} disabled={index === 0} onClick={() => steps.move(index, index - 1)}>
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Bajar paso ${index + 1}`}
                    disabled={index === steps.fields.length - 1}
                    onClick={() => steps.move(index, index + 1)}
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Quitar paso ${index + 1}`} onClick={() => steps.remove(index)}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
              <Textarea id={`step-${field.id}`} rows={2} aria-invalid={err.steps?.[index]?.text ? true : undefined} {...register(`steps.${index}.text`)} />
              {err.steps?.[index]?.text ? <p className="text-sm text-destructive">{err.steps[index]?.text?.message}</p> : null}
            </li>
          ))}
        </ol>
        <Button type="button" variant="outline" onClick={() => steps.append({ text: "" })} disabled={steps.fields.length >= 30}>
          <Plus aria-hidden="true" />
          Agregar paso
        </Button>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="etiquetas">
        <h2 id="etiquetas" className="text-lg font-semibold tracking-tight">
          Dieta, alérgenos y etiquetas
        </h2>
        <Controller
          control={control}
          name="dietTags"
          render={({ field }) => (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Tipo de dieta (según tus ingredientes)</legend>
              <div className="flex flex-wrap gap-2">
                {DECLARED_DIET_TAGS.map((t) => (
                  <ToggleChip key={t} pressed={field.value.includes(t)} onPressedChange={(on) => field.onChange(on ? [...field.value, t] : field.value.filter((x) => x !== t))}>
                    {DIET_TAG_LABELS[t]}
                  </ToggleChip>
                ))}
              </div>
            </fieldset>
          )}
        />
        <Controller
          control={control}
          name="allergens"
          render={({ field }) => (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Contiene</legend>
              <p className="text-xs text-muted-foreground">Marca los alérgenos de tus ingredientes (por ejemplo, la avena se marca con gluten).</p>
              <div className="flex flex-wrap gap-2">
                {ALLERGENS.map((a) => (
                  <ToggleChip key={a} pressed={field.value.includes(a)} onPressedChange={(on) => field.onChange(on ? [...field.value, a] : field.value.filter((x) => x !== a))}>
                    {ALLERGEN_LABELS[a]}
                  </ToggleChip>
                ))}
              </div>
            </fieldset>
          )}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="tags">Etiquetas (separadas por comas)</Label>
          <Input id="tags" placeholder="casero, para llevar" {...register("tagsText")} aria-invalid={err.tagsText ? true : undefined} />
          {err.tagsText ? <p className="text-sm text-destructive">{err.tagsText.message}</p> : null}
        </div>
      </section>

      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>
            <p>{formError}</p>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className={cn("sticky bottom-[calc(env(safe-area-inset-bottom)+9rem)] z-20 flex flex-col gap-3 rounded-2xl border border-border bg-popover/95 p-3 shadow-lg backdrop-blur sm:flex-row lg:bottom-4")}>
        <Button type="button" variant="outline" className="flex-1" loading={pending && intent === "draft"} disabled={pending} onClick={() => void submit("draft")}>
          Guardar borrador
        </Button>
        <Button type="button" className="flex-1" loading={pending && intent === "review"} disabled={pending} onClick={() => void submit("review")}>
          Enviar a revisión
        </Button>
      </div>
      <p className="-mt-6 text-xs text-muted-foreground">
        El borrador solo lo ves tú. Si la envías a revisión, el equipo la revisa antes de publicarla en el catálogo.
      </p>
    </form>
  );
}
