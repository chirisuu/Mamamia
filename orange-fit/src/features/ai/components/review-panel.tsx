"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Info, Plus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { mealKey, parseMealKey } from "@/features/diary/lib/day-totals";
import type { MealOption, MealType } from "@/features/diary/types";
import type { FoodWithPortions } from "@/lib/foods/api-types";
import { formatGrams, formatNumber, formatShortDate } from "@/lib/format";
import { confirmAiItemsAction } from "../actions";
import { addedReviewItem, itemProblem, reviewTotals, selectFood, toConfirmItems, type ReviewItem } from "../lib/review";
import type { AiLogSource } from "../schemas";
import { FoodSearchSheet } from "./food-search-sheet";
import { ReviewItemCard } from "./review-item-card";

export type ReviewPanelProps = {
  requestId: string;
  source: AiLogSource;
  initialItems: ReviewItem[];
  localDate: string;
  maxDate: string;
  defaultMeal: MealType;
  defaultCustomName: string | null;
  mealOptions: MealOption[];
  /** Nota de incertidumbre de la IA (foto). */
  uncertaintyNote?: string | null;
  onLogged?: () => void;
  onDiscard: () => void;
};

/**
 * Revisión y confirmación. Hasta que la persona toca «Registrar», no se escribe nada en el diario.
 */
export function ReviewPanel({
  requestId,
  source,
  initialItems,
  localDate,
  maxDate,
  defaultMeal,
  defaultCustomName,
  mealOptions,
  uncertaintyNote,
  onLogged,
  onDiscard,
}: ReviewPanelProps) {
  const router = useRouter();
  const id = React.useId();
  const [items, setItems] = React.useState<ReviewItem[]>(initialItems);
  const [searchFor, setSearchFor] = React.useState<{ key: string | null; query: string } | null>(null);
  const [date, setDate] = React.useState(localDate);
  const allMeals = React.useMemo(() => {
    const list = [...mealOptions];
    if (defaultMeal === "custom" && defaultCustomName && !list.some((m) => m.customName === defaultCustomName)) {
      list.push({ mealType: "custom", customName: defaultCustomName, label: defaultCustomName });
    }
    return list;
  }, [mealOptions, defaultMeal, defaultCustomName]);
  const [meal, setMeal] = React.useState(mealKey({ mealType: defaultMeal, customName: defaultMeal === "custom" ? defaultCustomName : null }));
  const [pending, startTransition] = React.useTransition();
  const [logged, setLogged] = React.useState(false);
  const addedCounter = React.useRef(0);

  const totals = reviewTotals(items);
  const { items: toLog, blocked } = toConfirmItems(items);
  const target = parseMealKey(meal);
  const mealName = allMeals.find((m) => mealKey(m) === meal)?.label ?? "la comida";
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= maxDate && date >= "2000-01-01";
  const canSubmit = !pending && !logged && toLog.length > 0 && blocked.length === 0 && target !== null && dateValid;

  const update = (key: string, fn: (item: ReviewItem) => ReviewItem) => setItems((list) => list.map((i) => (i.key === key ? fn(i) : i)));

  const pick = (food: FoodWithPortions) => {
    if (!searchFor) return;
    if (searchFor.key) {
      update(searchFor.key, (item) => selectFood(item, food));
    } else {
      addedCounter.current += 1;
      setItems((list) => [...list, addedReviewItem(food, `a${addedCounter.current}`)]);
    }
    setSearchFor(null);
  };

  const submit = () => {
    if (!canSubmit || !target) return;
    startTransition(async () => {
      const res = await confirmAiItemsAction({
        requestId,
        source,
        localDate: date,
        mealType: target.mealType,
        customName: target.customName,
        items: toLog,
      });
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setLogged(true);
      toast.success(`${res.data.count === 1 ? "1 alimento agregado" : `${res.data.count} alimentos agregados`} a ${res.data.mealLabel}`, {
        description: formatShortDate(res.data.localDate),
        action: { label: "Ver diario", onClick: () => router.push(`/app/diario/${res.data.localDate}`) },
      });
      onLogged?.();
      router.push(`/app/diario/${res.data.localDate}`);
    });
  };

  return (
    <section aria-labelledby={`${id}-title`} className="grid gap-4">
      <div className="grid gap-1">
        <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight">
          Revisa antes de registrar
        </h2>
        <p className="text-sm text-muted-foreground">
          La IA sugiere qué comiste y cuánto; los nutrientes salen de nuestra base de alimentos. Nada se guarda hasta que confirmes.
        </p>
      </div>

      {uncertaintyNote ? (
        <Alert variant="info">
          <Info aria-hidden="true" />
          <AlertTitle>Lo que la foto no muestra</AlertTitle>
          <AlertDescription>
            <p>{uncertaintyNote}</p>
          </AlertDescription>
        </Alert>
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          No hay alimentos en la lista. Agrega uno con la búsqueda o vuelve a intentarlo.
        </p>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.key}>
              <ReviewItemCard
                item={item}
                disabled={pending || logged}
                onChange={(next) => update(item.key, () => next)}
                onSelectFood={(food) => update(item.key, (i) => selectFood(i, food))}
                onSearch={() => setSearchFor({ key: item.key, query: item.title })}
                onRemove={() => setItems((list) => list.filter((i) => i.key !== item.key))}
              />
            </li>
          ))}
        </ul>
      )}

      <Button type="button" variant="outline" onClick={() => setSearchFor({ key: null, query: "" })} disabled={pending || logged}>
        <Plus aria-hidden="true" />
        Añadir otro alimento
      </Button>

      <div className="grid gap-4 rounded-2xl border border-border bg-card p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor={`${id}-meal`}>Comida</Label>
            <Select value={meal} onValueChange={setMeal} disabled={pending || logged}>
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
              disabled={pending || logged}
            />
          </div>
        </div>
        {!dateValid ? <p className="text-sm text-destructive">Elige una fecha hasta mañana.</p> : null}

        <div aria-live="polite" className="text-sm">
          {totals.nutrients ? (
            <p>
              <span className="font-semibold">
                {totals.count === 1 ? "1 alimento" : `${totals.count} alimentos`} · {formatNumber(totals.nutrients.energyKcal)} kcal
              </span>
              <span className="text-muted-foreground">
                {" "}
                · P {formatGrams(totals.nutrients.proteinG, 1)} · C {formatGrams(totals.nutrients.carbsG, 1)} · G{" "}
                {formatGrams(totals.nutrients.fatG, 1)}
              </span>
            </p>
          ) : (
            <p className="text-muted-foreground">Marca al menos un alimento con su cantidad para registrarlo.</p>
          )}
          {blocked.length > 0 ? (
            <p className="mt-1 text-destructive">
              {blocked.length === 1 ? "Un alimento marcado" : `${blocked.length} alimentos marcados`} no tiene{blocked.length === 1 ? "" : "n"}{" "}
              {blocked.some((b) => itemProblem(b) === "no_food") ? "alimento de la base o " : ""}cantidad válida. Complétalo o desmárcalo.
            </p>
          ) : null}
        </div>

        <Button type="button" size="lg" onClick={submit} loading={pending} disabled={!canSubmit}>
          {logged ? "Registrado" : `Registrar en ${mealName}`}
        </Button>
        <Button type="button" variant="ghost" onClick={onDiscard} disabled={pending}>
          Descartar y empezar de nuevo
        </Button>
      </div>

      <FoodSearchSheet
        open={searchFor !== null}
        onOpenChange={(open) => !open && setSearchFor(null)}
        initialQuery={searchFor?.query ?? ""}
        title={searchFor?.key ? "Elegir otro alimento" : "Añadir alimento"}
        onPick={pick}
      />
    </section>
  );
}
