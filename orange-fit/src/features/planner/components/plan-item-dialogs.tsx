"use client";

import * as React from "react";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Switch } from "@/components/ui/switch";
import { formatNumber } from "@/lib/format";
import { normalizeKey } from "@/lib/nutrition";
import { FoodSearchField } from "@/features/recipes/components/food-search-field";
import type { FoodSearchResult } from "@/features/recipes/lib/food-api";
import { clampServings, MANUAL_MAX_SERVINGS, MANUAL_MIN_SERVINGS, recipeAllowed, type SwapOption } from "../lib/plan";
import type { DraftItem, PlanParams, PlanRecipeOption, PlanSlot } from "../lib/types";

/** Elegir una receta para un hueco del plan (respeta alérgenos y dieta del plan). */
export function RecipePickerDialog({
  open,
  onOpenChange,
  slot,
  slotTargetKcal,
  pool,
  params,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: PlanSlot | null;
  slotTargetKcal: number | null;
  pool: readonly PlanRecipeOption[];
  params: PlanParams;
  onPick: (recipe: PlanRecipeOption, servings: number) => void;
}) {
  const [q, setQ] = React.useState("");
  const [allMeals, setAllMeals] = React.useState(false);
  const id = React.useId();
  const words = normalizeKey(q).split(" ").filter(Boolean);
  const list = pool
    .filter((r) => recipeAllowed(r, params))
    .filter((r) => allMeals || !slot || r.mealTypes.includes(slot.mealType))
    .filter((r) => words.every((w) => normalizeKey(r.title).includes(w)))
    .sort((a, b) => a.title.localeCompare(b.title, "es"))
    .slice(0, 60);
  const servingsFor = (r: PlanRecipeOption) => (slotTargetKcal ? clampServings(slotTargetKcal / r.perServing.kcal) : 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)]">
        <DialogHeader>
          <DialogTitle>Añadir receta{slot ? ` · ${slot.label}` : ""}</DialogTitle>
          <DialogDescription>Mostramos recetas sin tus alérgenos y acordes a tu dieta. Ajustamos las porciones a esta comida.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Label htmlFor={id} className="sr-only">
            Buscar receta
          </Label>
          <Input id={id} type="search" placeholder="Buscar receta" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={`${id}-all`}>Ver recetas de cualquier comida</Label>
            <Switch id={`${id}-all`} checked={allMeals} onCheckedChange={setAllMeals} />
          </div>
          {list.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No hay recetas que coincidan.</p>
          ) : (
            <ul className="flex max-h-[50dvh] flex-col gap-1 overflow-y-auto">
              {list.map((r) => {
                const s = servingsFor(r);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(r, s);
                        onOpenChange(false);
                        setQ("");
                      }}
                      className="flex min-h-14 w-full flex-col items-start rounded-xl px-3 py-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="font-medium">{r.title}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatNumber(s, 2)} porc. · {formatNumber(r.perServing.kcal * s)} kcal · {formatNumber(r.perServing.p * s, 1)} g proteína
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Añadir un alimento suelto (búsqueda en la base + gramos). */
export function FoodPickerDialog({
  open,
  onOpenChange,
  slot,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: PlanSlot | null;
  onPick: (food: FoodSearchResult, grams: number) => void;
}) {
  const [food, setFood] = React.useState<FoodSearchResult | null>(null);
  const [grams, setGrams] = React.useState(100);
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setFood(null);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Añadir alimento{slot ? ` · ${slot.label}` : ""}</DialogTitle>
          <DialogDescription>Busca en la base de alimentos y elige la cantidad.</DialogDescription>
        </DialogHeader>
        {food ? (
          <div className="flex flex-col gap-4">
            <div>
              <p className="font-medium">{food.name}</p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {formatNumber((food.per100g.energyKcal * grams) / 100)} kcal · {formatNumber((food.per100g.proteinG * grams) / 100, 1)} g proteína
              </p>
            </div>
            {food.portions.length ? (
              <div className="flex flex-wrap gap-2">
                {food.portions.map((p) => (
                  <Button key={p.id} type="button" size="sm" variant={grams === p.gramWeight ? "secondary" : "outline"} onClick={() => setGrams(p.gramWeight)}>
                    {p.label} ({formatNumber(p.gramWeight)} g)
                  </Button>
                ))}
              </div>
            ) : null}
            <NumberStepper label="Gramos" value={grams} onValueChange={setGrams} min={1} max={5000} step={5} unit="g" />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setFood(null)}>
                Elegir otro
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onPick(food, grams);
                  onOpenChange(false);
                }}
              >
                Añadir
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <FoodSearchField
            autoFocus
            onSelect={(f) => {
              setFood(f);
              setGrams(f.portions.find((p) => p.isDefault)?.gramWeight ?? 100);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Cambiar una receta por otra del mismo tipo de comida y kcal parecidas. */
export function SwapDialog({
  open,
  onOpenChange,
  item,
  options,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: DraftItem | null;
  options: SwapOption[];
  onPick: (option: SwapOption) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar receta</DialogTitle>
          <DialogDescription>
            {item ? `En lugar de ${item.name} (${formatNumber(item.kcal)} kcal). ` : ""}Opciones del mismo tipo de comida con calorías parecidas.
          </DialogDescription>
        </DialogHeader>
        {options.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No hay otras recetas que encajen con tus filtros para esta comida.</p>
        ) : (
          <ul className="flex max-h-[55dvh] flex-col gap-1 overflow-y-auto">
            {options.map((o) => (
              <li key={o.recipe.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(o);
                    onOpenChange(false);
                  }}
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArrowLeftRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{o.recipe.title}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {formatNumber(o.servings, 2)} porc. · {formatNumber(o.kcal)} kcal · {formatNumber(o.proteinG, 1)} g proteína
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Ajustar porciones (recetas) o gramos (alimentos). */
export function AmountDialog({
  open,
  onOpenChange,
  item,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: DraftItem | null;
  onSave: (amount: number) => void;
}) {
  const [value, setValue] = React.useState<number>(1);
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && item) setValue(item.kind === "recipe" ? (item.servings ?? 1) : (item.grams ?? 100));
  }
  const isRecipe = item?.kind === "recipe";
  const ratio = item ? (isRecipe ? value / (item.servings || 1) : value / (item.grams || 1)) : 1;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isRecipe ? "Ajustar porciones" : "Ajustar cantidad"}</DialogTitle>
          <DialogDescription>{item?.name}</DialogDescription>
        </DialogHeader>
        {isRecipe ? (
          <NumberStepper label="Porciones" value={value} onValueChange={setValue} min={MANUAL_MIN_SERVINGS} max={MANUAL_MAX_SERVINGS} step={0.25} unit="porc." />
        ) : (
          <NumberStepper label="Gramos" value={value} onValueChange={setValue} min={1} max={5000} step={5} unit="g" />
        )}
        {item ? (
          <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
            ≈ {formatNumber(item.kcal * ratio)} kcal · {formatNumber(item.proteinG * ratio, 1)} g proteína
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave(value);
              onOpenChange(false);
            }}
          >
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
