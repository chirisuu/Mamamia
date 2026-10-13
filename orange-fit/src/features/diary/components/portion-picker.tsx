"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import { roundNutrients, scaleNutrients } from "@/lib/nutrition";
import { formatShortDate } from "@/lib/format";
import { logFoodAction } from "../actions";
import { mealKey, parseMealKey } from "../lib/day-totals";
import { STANDARD_MEAL_OPTIONS } from "../lib/meal-time";
import {
  buildAmountOptions,
  defaultAmountOption,
  gramsForAmount,
  matchItemAmount,
  storedQuantity,
} from "../lib/portion-options";
import type { MealOption, MealType, PickerFood } from "../types";
import { AmountFields } from "./amount-fields";
import { FavoriteButton } from "./favorite-button";
import { NutrientPreview } from "./nutrient-preview";

export type PortionPickerProps = {
  /** Alimento elegido; null mientras no hay selección. */
  food: PickerFood | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fecha local (YYYY-MM-DD) por defecto. */
  localDate: string;
  /** Fecha máxima permitida (mañana en la zona del usuario). */
  maxDate: string;
  defaultMeal: MealType;
  defaultCustomName?: string | null;
  /** Comidas elegibles; por defecto las 4 estándar. */
  mealOptions?: MealOption[];
  /** Procedencia del registro: "search" (buscador), "barcode" (escáner)… */
  source?: "search" | "barcode" | "manual" | "plan";
  /** Cantidad inicial (p. ej. la última vez que lo registró). */
  initial?: { grams?: number | null; quantity?: number | null; unit?: string | null } | null;
  onLogged?: (result: { localDate: string; mealLabel: string }) => void;
};

/**
 * Hoja inferior para elegir cuánto se comió de un alimento (porciones de la base o gramos),
 * en qué comida y qué día, con la vista previa de nutrientes calculada con `scaleNutrients`
 * desde los valores por 100 g de la base. Registra con `logFoodAction` → `addItemsToMeal`.
 * Reutilizable desde el buscador, el escáner de código de barras o favoritos.
 */
export function PortionPicker(props: PortionPickerProps) {
  const { food, open, onOpenChange } = props;
  return (
    <BottomSheet open={open && food !== null} onOpenChange={onOpenChange}>
      <BottomSheetContent>
        {food ? <PortionPickerBody key={food.id} {...props} food={food} /> : null}
      </BottomSheetContent>
    </BottomSheet>
  );
}

function PortionPickerBody({
  food,
  onOpenChange,
  localDate,
  maxDate,
  defaultMeal,
  defaultCustomName = null,
  mealOptions = STANDARD_MEAL_OPTIONS as MealOption[],
  source = "search",
  initial,
  onLogged,
}: PortionPickerProps & { food: PickerFood }) {
  const router = useRouter();
  const id = React.useId();
  const options = React.useMemo(() => buildAmountOptions(food), [food]);
  const start = React.useMemo(() => {
    if (initial?.grams && initial.grams > 0) {
      return matchItemAmount(options, { grams: initial.grams, quantity: initial.quantity ?? initial.grams, unit: initial.unit ?? "g" });
    }
    const option = defaultAmountOption(options, food.portions);
    return { option, amount: option.defaultAmount };
  }, [options, food.portions, initial]);

  const [optionKey, setOptionKey] = React.useState(start.option.key);
  const [amount, setAmount] = React.useState(start.amount);
  const allMeals = React.useMemo(() => {
    const list = [...mealOptions];
    if (defaultMeal === "custom" && defaultCustomName && !list.some((m) => m.customName === defaultCustomName)) {
      list.push({ mealType: "custom", customName: defaultCustomName, label: defaultCustomName });
    }
    return list;
  }, [mealOptions, defaultMeal, defaultCustomName]);
  const [meal, setMeal] = React.useState(mealKey({ mealType: defaultMeal, customName: defaultMeal === "custom" ? defaultCustomName : null }));
  const [date, setDate] = React.useState(localDate);
  const [pending, startTransition] = React.useTransition();

  const option = options.find((o) => o.key === optionKey) ?? start.option;
  const grams = gramsForAmount(option, amount);
  const preview = grams > 0 ? roundNutrients(scaleNutrients(food.per100g, grams), 1) : null;
  const target = parseMealKey(meal);
  const mealName = allMeals.find((m) => mealKey(m) === meal)?.label ?? "la comida";
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= maxDate;
  const canSubmit = grams > 0 && grams <= 5000 && target !== null && dateValid && !pending;

  const submit = () => {
    if (!target || !canSubmit) return;
    const { quantity, unit } = storedQuantity(option, amount);
    startTransition(async () => {
      const res = await logFoodAction({
        localDate: date,
        mealType: target.mealType,
        customName: target.customName,
        foodId: food.id,
        grams,
        quantity,
        unit,
        source,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Agregado a ${res.data.mealLabel}`, {
        description: `${food.name} · ${formatShortDate(res.data.localDate)}`,
        action: { label: "Ver diario", onClick: () => router.push(`/app/diario/${res.data.localDate}`) },
      });
      onLogged?.({ localDate: res.data.localDate, mealLabel: res.data.mealLabel });
      onOpenChange(false);
    });
  };

  return (
    <form
      className="flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <BottomSheetHeader className="flex-row items-start gap-2">
        <div className="min-w-0 flex-1">
          <BottomSheetTitle className="line-clamp-2">{food.name}</BottomSheetTitle>
          <BottomSheetDescription>
            {food.brandName ? `${food.brandName} · ` : ""}
            {food.provenance}
          </BottomSheetDescription>
        </div>
        <FavoriteButton foodId={food.id} foodName={food.name} initial={Boolean(food.isFavorite)} className="-mr-2 shrink-0" />
      </BottomSheetHeader>

      <div className="grid gap-4 px-5 pb-2">
        <AmountFields
          options={options}
          optionKey={option.key}
          amount={amount}
          onChange={(next) => {
            setOptionKey(next.optionKey);
            setAmount(next.amount);
          }}
          disabled={pending}
        />

        {preview ? (
          <NutrientPreview nutrients={preview} grams={grams} />
        ) : (
          <p className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">Indica una cantidad mayor que 0.</p>
        )}
        {grams > 5000 ? <p className="text-sm text-destructive">Máximo 5 kg por registro.</p> : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor={`${id}-meal`}>Comida</Label>
            <Select value={meal} onValueChange={setMeal} disabled={pending}>
              <SelectTrigger id={`${id}-meal`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allMeals.map((m) => (
                  <SelectItem key={mealKey(m)} value={mealKey(m)}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${id}-date`}>Fecha</Label>
            <Input
              id={`${id}-date`}
              type="date"
              value={date}
              max={maxDate}
              min="2000-01-01"
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={!dateValid || undefined}
              disabled={pending}
            />
          </div>
        </div>
        {!dateValid ? <p className="text-sm text-destructive">Elige una fecha hasta mañana.</p> : null}

        <p className="flex gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Valores calculados desde la base por 100 g ({food.provenance.toLowerCase()}).
        </p>
      </div>

      <BottomSheetFooter>
        <Button type="submit" size="lg" loading={pending} disabled={!canSubmit}>
          Agregar a {mealName}
        </Button>
      </BottomSheetFooter>
    </form>
  );
}
