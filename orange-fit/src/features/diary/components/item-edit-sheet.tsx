"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
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
import { updateItemQuantityAction } from "../actions";
import { buildAmountOptions, gramsForAmount, matchItemAmount, storedQuantity } from "../lib/portion-options";
import type { DiaryItem } from "../types";
import { AmountFields } from "./amount-fields";
import { NutrientPreview } from "./nutrient-preview";

/**
 * Editar la cantidad de un ítem. La vista previa usa los mismos cálculos que el servidor, que
 * vuelve a calcular desde `foods` (por 100 g) o `recipe_nutrition` (por porción) al guardar.
 */
export function ItemEditSheet({
  item,
  open,
  onOpenChange,
}: {
  item: DiaryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <BottomSheet open={open && item !== null} onOpenChange={onOpenChange}>
      <BottomSheetContent>{item ? <EditBody key={item.id} item={item} onDone={() => onOpenChange(false)} /> : null}</BottomSheetContent>
    </BottomSheet>
  );
}

function scaleItem(item: DiaryItem, factor: number) {
  const s = (v: number | null) => (v == null ? null : Math.round(v * factor * 10) / 10);
  return {
    energyKcal: Math.round(item.energyKcal * factor),
    proteinG: s(item.proteinG) ?? 0,
    carbsG: s(item.carbsG) ?? 0,
    fatG: s(item.fatG) ?? 0,
    fiberG: s(item.fiberG),
    sugarG: s(item.sugarG),
    sodiumMg: item.sodiumMg == null ? null : Math.round(item.sodiumMg * factor),
  };
}

function EditBody({ item, onDone }: { item: DiaryItem; onDone: () => void }) {
  const [pending, startTransition] = React.useTransition();
  const id = React.useId();

  // Alimento vigente: porciones de la base. Receta: porciones de receta. Resto: escala lo guardado.
  const food = item.kind === "food" ? item.food : null;
  const options = React.useMemo(() => (food ? buildAmountOptions(food) : []), [food]);
  const start = React.useMemo(
    () => (food ? matchItemAmount(options, { quantity: item.quantity, unit: item.unit, grams: item.grams }) : null),
    [food, options, item.quantity, item.unit, item.grams],
  );
  const [optionKey, setOptionKey] = React.useState(start?.option.key ?? "g");
  const [amount, setAmount] = React.useState<number>(
    start?.amount ?? (item.kind !== "recipe" && item.grams ? item.grams : item.quantity),
  );

  let grams: number | null = null;
  let preview: ReturnType<typeof scaleItem> | null = null;
  let payload: Parameters<typeof updateItemQuantityAction>[0] | null = null;

  if (food && start) {
    const option = options.find((o) => o.key === optionKey) ?? start.option;
    grams = gramsForAmount(option, amount);
    if (grams > 0) {
      const n = roundNutrients(scaleNutrients(food.per100g, grams), 1);
      preview = { ...n, energyKcal: Math.round(n.energyKcal) };
      payload = { itemId: item.id, grams, ...storedQuantity(option, amount) };
    }
  } else if (item.kind === "recipe") {
    if (amount > 0) {
      preview = scaleItem(item, amount / item.quantity);
      grams = item.grams ? Math.round((item.grams * amount) / item.quantity) : null;
      payload = { itemId: item.id, servings: amount };
    }
  } else if (item.grams) {
    if (amount > 0) {
      preview = scaleItem(item, amount / item.grams);
      grams = amount;
      payload = { itemId: item.id, grams: amount };
    }
  } else if (amount > 0) {
    preview = scaleItem(item, amount / item.quantity);
    payload = { itemId: item.id, quantity: amount };
  }

  const save = () => {
    if (!payload) return;
    startTransition(async () => {
      const res = await updateItemQuantityAction(payload);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Cantidad actualizada");
      onDone();
    });
  };

  const description =
    item.kind === "recipe" || (item.kind === "food" && food)
      ? item.provenance
      : item.source === "manual"
        ? "Valores ingresados por ti: se ajustan en proporción a la nueva cantidad."
        : "Su alimento ya no está en la base: se ajustan sus valores guardados en proporción.";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <BottomSheetHeader>
        <BottomSheetTitle className="line-clamp-2">Editar {item.name}</BottomSheetTitle>
        <BottomSheetDescription>{description}</BottomSheetDescription>
      </BottomSheetHeader>
      <div className="grid gap-4 px-5 pb-2">
        {food && start ? (
          <AmountFields
            options={options}
            optionKey={optionKey}
            amount={amount}
            onChange={(next) => {
              setOptionKey(next.optionKey);
              setAmount(next.amount);
            }}
            disabled={pending}
          />
        ) : (
          <div className="grid gap-2">
            <Label htmlFor={`${id}-amount`}>
              {item.kind === "recipe" ? "Porciones" : item.grams ? "Gramos" : `Cantidad (${item.unit})`}
            </Label>
            <NumberStepper
              id={`${id}-amount`}
              value={amount}
              onValueChange={setAmount}
              min={item.kind === "recipe" ? 0.25 : item.grams ? 1 : 0.25}
              max={item.kind === "recipe" ? 20 : item.grams ? 5000 : 10000}
              step={item.kind === "recipe" ? 0.25 : item.grams ? 5 : 0.5}
              decimals={item.kind === "recipe" ? 2 : item.grams ? 0 : 2}
              unit={item.kind === "recipe" ? "porc." : item.grams ? "g" : undefined}
              label={item.kind === "recipe" ? "Porciones" : "Cantidad"}
              disabled={pending}
            />
          </div>
        )}
        {preview ? <NutrientPreview nutrients={preview} grams={grams} /> : null}
      </div>
      <BottomSheetFooter>
        <Button type="submit" size="lg" loading={pending} disabled={!payload}>
          Guardar cantidad
        </Button>
      </BottomSheetFooter>
    </form>
  );
}
