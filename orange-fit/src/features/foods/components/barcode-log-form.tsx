"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import type { FoodDetail } from "@/lib/foods/api-types";
import { amountOptions, defaultAmountOption, resolveAmount, type AmountOption } from "@/lib/foods/units-portions";
import { formatNumber, formatShortDate } from "@/lib/format";
import { roundNutrients, scaleNutrients } from "@/lib/nutrition";
import { logBarcodeFoodAction } from "../actions";
import { mealChoiceKey, type MealChoice } from "../lib/meals";

export type BarcodeLogFormProps = {
  food: FoodDetail;
  localDate: string;
  isToday: boolean;
  meals: MealChoice[];
  defaultMeal: Pick<MealChoice, "mealType" | "customName">;
  onLogged: (result: { mealLabel: string; localDate: string }) => void;
};

const initialAmount = (option: AmountOption) => (option.kind === "grams" ? 100 : 1);

/** Cuánto comiste y en qué comida; registra con la acción del escáner (source 'barcode'). */
export function BarcodeLogForm({ food, localDate, isToday, meals, defaultMeal, onLogged }: BarcodeLogFormProps) {
  const ids = { measure: React.useId(), amount: React.useId(), meal: React.useId() };
  const options = React.useMemo(() => amountOptions(food), [food]);
  const [optionKey, setOptionKey] = React.useState(() => defaultAmountOption(options).key);
  const option = options.find((o) => o.key === optionKey) ?? options[0];
  const [amount, setAmount] = React.useState(() => initialAmount(defaultAmountOption(options)));
  const [mealKey, setMealKey] = React.useState(() => mealChoiceKey(defaultMeal));
  const [pending, startTransition] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);

  const meal = meals.find((m) => mealChoiceKey(m) === mealKey) ?? meals[0];
  const resolved = resolveAmount(option, amount);
  const preview = roundNutrients(scaleNutrients(food.per100g, resolved.grams), 1);
  const tooMuch = resolved.grams > 5000;

  const changeOption = (key: string) => {
    const next = options.find((o) => o.key === key);
    if (!next) return;
    // Al pasar a gramos se conserva el peso elegido; al pasar a una porción se empieza en 1.
    setAmount(next.kind === "grams" ? Math.max(1, Math.round(resolved.grams)) : 1);
    setOptionKey(key);
  };

  const submit = () => {
    if (!meal || tooMuch || !(resolved.grams > 0)) return;
    setFormError(null);
    startTransition(async () => {
      const result = await logBarcodeFoodAction({
        localDate,
        mealType: meal.mealType,
        customName: meal.customName,
        foodId: food.id,
        grams: resolved.grams,
        quantity: resolved.quantity,
        unit: resolved.unit,
      });
      if (!result.ok) {
        setFormError(result.error.message);
        toast.error(result.error.message);
        return;
      }
      toast.success(`Agregado a ${result.data.mealLabel}`);
      onLogged({ mealLabel: result.data.mealLabel, localDate: result.data.localDate });
    });
  };

  const isGrams = option.kind === "grams";
  const maxAmount = isGrams ? 5000 : Math.max(1, Math.floor((5000 / option.gramsPerUnit) * 4) / 4);

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle as="h2">¿Cuánto comiste?</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.measure}>Medida</Label>
          <Select value={optionKey} onValueChange={changeOption}>
            <SelectTrigger id={ids.measure}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.key} value={o.key}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.amount}>{isGrams ? "Gramos" : "Cantidad"}</Label>
          <NumberStepper
            id={ids.amount}
            value={amount}
            onValueChange={setAmount}
            min={isGrams ? 1 : 0.25}
            max={maxAmount}
            step={isGrams ? 10 : 0.5}
            decimals={isGrams ? 0 : 2}
            unit={isGrams ? "g" : undefined}
          />
          {!isGrams ? (
            <p className="text-sm text-muted-foreground tabular-nums">= {formatNumber(resolved.grams, resolved.grams < 10 ? 1 : 0)} g</p>
          ) : null}
        </div>

        <dl aria-label="Nutrientes de lo que vas a registrar" className="grid grid-cols-4 gap-2 rounded-2xl bg-muted/60 p-3 text-center">
          {[
            { label: "kcal", value: formatNumber(preview.energyKcal) },
            { label: "Proteína", value: `${formatNumber(preview.proteinG, 1)} g` },
            { label: "Carbos", value: `${formatNumber(preview.carbsG, 1)} g` },
            { label: "Grasa", value: `${formatNumber(preview.fatG, 1)} g` },
          ].map((m) => (
            <div key={m.label} className="flex min-w-0 flex-col-reverse">
              <dt className="text-xs text-muted-foreground">{m.label}</dt>
              <dd className="truncate text-base font-semibold tabular-nums">{m.value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-2">
          <Label htmlFor={ids.meal}>Comida</Label>
          <Select value={mealKey} onValueChange={setMealKey}>
            <SelectTrigger id={ids.meal}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {meals.map((m) => (
                <SelectItem key={mealChoiceKey(m)} value={mealChoiceKey(m)}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Se guarda en el diario de {isToday ? "hoy" : formatShortDate(localDate)}.</p>
        </div>

        {tooMuch ? <p className="text-sm font-medium text-destructive">Máximo 5 kg por registro.</p> : null}
        {formError ? (
          <Alert variant="destructive">
            <AlertDescription>
              <p>{formError}</p>
            </AlertDescription>
          </Alert>
        ) : null}

        <Button type="button" size="lg" onClick={submit} loading={pending} disabled={tooMuch || !meal}>
          {pending ? null : <Plus aria-hidden="true" />}
          Agregar a {meal?.label ?? "la comida"}
        </Button>
      </CardContent>
    </Card>
  );
}
