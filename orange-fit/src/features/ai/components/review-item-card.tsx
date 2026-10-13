"use client";

import * as React from "react";
import { HelpCircle, Search, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { AmountFields } from "@/features/diary/components/amount-fields";
import { NutrientPreview } from "@/features/diary/components/nutrient-preview";
import { buildAmountOptions } from "@/features/diary/lib/portion-options";
import type { FoodWithPortions } from "@/lib/foods/api-types";
import { provenanceLabel } from "@/lib/foods/types";
import { formatGrams, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { confidenceLevel, itemGrams, itemNutrients, itemProblem, MAX_ITEM_GRAMS, type ReviewItem } from "../lib/review";
import { CreateFoodLink } from "./food-search-sheet";

type ReviewItemCardProps = {
  item: ReviewItem;
  disabled?: boolean;
  onChange: (next: ReviewItem) => void;
  onSelectFood: (food: FoodWithPortions | null) => void;
  onSearch: () => void;
  onRemove: () => void;
};

/**
 * Un candidato de la IA: elegir el alimento REAL de la base (o buscar/crear otro), ajustar la
 * cantidad (en foto, dentro del rango estimado) y ver los nutrientes calculados desde la base.
 */
export function ReviewItemCard({ item, disabled, onChange, onSelectFood, onSearch, onRemove }: ReviewItemCardProps) {
  const id = React.useId();
  const titleId = `${id}-title`;
  const grams = itemGrams(item);
  const nutrients = itemNutrients(item);
  const problem = itemProblem(item);
  const conf = item.confidence != null ? confidenceLevel(item.confidence) : null;

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-sm transition-opacity",
        item.included ? "border-border" : "border-dashed border-border opacity-80",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          <Checkbox
            id={`${id}-include`}
            checked={item.included}
            disabled={disabled || !item.food}
            onCheckedChange={(v) => onChange({ ...item, included: v === true })}
            aria-describedby={!item.food ? `${id}-nofood` : undefined}
          />
        </div>
        <div className="min-w-0 flex-1">
          <Label htmlFor={`${id}-include`} id={titleId} className="block text-base font-semibold leading-snug">
            {item.title}
            <span className="sr-only">{item.included ? " (se registrará)" : " (no se registrará)"}</span>
          </Label>
          {item.detail ? <p className="text-sm text-muted-foreground">{item.detail}</p> : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {item.origin === "added" ? <Badge variant="outline">Agregado por ti</Badge> : null}
            {conf ? (
              <Badge variant={conf.label === "alta" ? "soft" : "outline"}>
                Confianza {conf.label} · {conf.percent} %
              </Badge>
            ) : null}
            {item.range ? (
              <Badge variant="outline">
                Estimado {formatNumber(item.range.min)}–{formatNumber(item.range.max)} g
              </Badge>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="-mr-2 -mt-1 shrink-0 rounded-full"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Quitar ${item.title}`}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>

      {item.evidence ? <p className="mt-2 text-sm text-muted-foreground">Se ve: {item.evidence}</p> : null}

      {item.clarification ? (
        <Alert variant="info" className="mt-3">
          <HelpCircle aria-hidden="true" />
          <AlertTitle>{item.clarification}</AlertTitle>
          <AlertDescription>
            <p>Elige el alimento y la cantidad que correspondan, o corrige el texto y vuelve a analizar.</p>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-4 grid gap-4">
        <fieldset className="grid gap-2" disabled={disabled}>
          <legend className="mb-1 text-sm font-medium">Alimento de la base</legend>
          {item.matches.length > 0 ? (
            <RadioGroup
              value={item.food?.id ?? ""}
              onValueChange={(foodId) => onSelectFood(item.matches.find((m) => m.id === foodId) ?? null)}
              className="gap-2"
              aria-label={`Alimento para ${item.title}`}
            >
              {item.matches.map((food) => {
                const optionId = `${id}-food-${food.id}`;
                return (
                  <label
                    key={food.id}
                    htmlFor={optionId}
                    className={cn(
                      "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2",
                      item.food?.id === food.id ? "border-primary bg-accent" : "border-border",
                    )}
                  >
                    <RadioGroupItem id={optionId} value={food.id} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-snug">{food.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {food.brandName ? `${food.brandName} · ` : ""}
                        {provenanceLabel(food)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatNumber(food.per100g.energyKcal)} kcal/100 g
                    </span>
                  </label>
                );
              })}
            </RadioGroup>
          ) : (
            <Alert variant="warning" id={`${id}-nofood`}>
              <AlertTitle>Sin dato verificado</AlertTitle>
              <AlertDescription>
                <p>No encontramos «{item.title}» en la base. Búscalo con otro nombre o créalo con los datos de su etiqueta.</p>
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onSearch} disabled={disabled}>
              <Search aria-hidden="true" />
              {item.matches.length ? "Buscar otro" : "Buscar"}
            </Button>
            {item.matches.length === 0 ? <CreateFoodLink name={item.title} /> : null}
          </div>
        </fieldset>

        {item.food ? (
          <AmountEditor item={item} disabled={disabled} onChange={onChange} />
        ) : null}

        {item.note ? <p className="text-sm text-muted-foreground">{item.note}</p> : null}
        {problem === "no_amount" && item.food ? (
          <p className="text-sm font-medium text-destructive">Indica la cantidad para poder registrarlo.</p>
        ) : null}
        {problem === "too_much" ? <p className="text-sm font-medium text-destructive">Máximo 5 kg por alimento.</p> : null}

        {nutrients && grams != null ? (
          <div className="grid gap-1">
            <NutrientPreview nutrients={nutrients} grams={grams} />
            <p className="text-xs text-muted-foreground">
              Calculado con los valores por 100 g de la base{item.food ? ` (${provenanceLabel(item.food).toLowerCase()})` : ""}
              {item.range ? ". La cantidad es una estimación." : "."}
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** Foto: deslizador dentro del rango estimado + gramos exactos. Texto/voz: porciones de la base. */
function AmountEditor({ item, disabled, onChange }: { item: ReviewItem; disabled?: boolean; onChange: (next: ReviewItem) => void }) {
  const id = React.useId();
  const food = item.food!;
  const options = React.useMemo(() => buildAmountOptions(food), [food]);

  if (item.range && item.optionKey === "g") {
    const { min, max } = item.range;
    const value = item.amount ?? item.range.best;
    const inRange = value >= min && value <= max;
    const step = max - min >= 100 ? 5 : 1;
    return (
      <div className="grid gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <Label id={`${id}-slider-label`}>Cantidad estimada</Label>
          <span className="text-sm font-semibold tabular-nums">{formatGrams(value)}</span>
        </div>
        {max > min ? (
          <Slider
            min={min}
            max={max}
            step={step}
            value={[Math.min(max, Math.max(min, value))]}
            onValueChange={([v]) => onChange({ ...item, amount: v ?? value })}
            disabled={disabled}
            aria-labelledby={`${id}-slider-label`}
            aria-valuetext={`${formatNumber(value)} gramos`}
          />
        ) : null}
        <div className="flex justify-between text-xs text-muted-foreground" aria-hidden="true">
          <span>{formatGrams(min)}</span>
          <span>{formatGrams(max)}</span>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-grams`}>Gramos exactos (si los sabes)</Label>
          <NumberStepper
            id={`${id}-grams`}
            value={item.amount}
            onValueChange={(v) => onChange({ ...item, amount: v })}
            min={1}
            max={MAX_ITEM_GRAMS}
            step={5}
            decimals={0}
            unit="g"
            label="Gramos"
            disabled={disabled}
          />
          {!inRange ? <p className="text-xs text-muted-foreground">Fuera del rango estimado por la IA: usaremos lo que indicaste.</p> : null}
        </div>
      </div>
    );
  }

  return (
    <AmountFields
      options={options}
      optionKey={options.some((o) => o.key === item.optionKey) ? item.optionKey : "g"}
      amount={item.amount ?? 0}
      onChange={(next) => onChange({ ...item, optionKey: next.optionKey, amount: next.amount > 0 ? next.amount : null, note: null })}
      disabled={disabled}
    />
  );
}
