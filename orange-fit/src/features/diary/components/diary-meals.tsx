"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  BookmarkPlus,
  CalendarPlus,
  Copy,
  Eraser,
  EllipsisVertical,
  LayoutTemplate,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/components/ui/sonner";
import { addDays } from "@/lib/dates";
import { formatGrams, formatNumber, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  applyTemplateAction,
  clearMealAction,
  copyMealAction,
  createCustomMealAction,
  deleteCustomMealAction,
  deleteItemAction,
  deleteTemplateAction,
  duplicateItemAction,
  moveItemAction,
  saveTemplateAction,
  setFavoriteFoodAction,
} from "../actions";
import { mealKey, parseMealKey } from "../lib/day-totals";
import { logTargetQuery } from "../lib/log-target";
import { dayLabel } from "../lib/meal-time";
import type { DiaryItem, DiaryMeal, MealOption, TemplateSummary } from "../types";
import { ItemEditSheet } from "./item-edit-sheet";

type DialogState =
  | { type: "edit"; item: DiaryItem }
  | { type: "move"; item: DiaryItem }
  | { type: "deleteItem"; item: DiaryItem }
  | { type: "copy"; meal: DiaryMeal }
  | { type: "saveTemplate"; meal: DiaryMeal }
  | { type: "applyTemplate"; meal: DiaryMeal }
  | { type: "clear"; meal: DiaryMeal }
  | { type: "deleteMeal"; meal: DiaryMeal }
  | { type: "newMeal" }
  | null;

export type DiaryMealsProps = {
  date: string;
  today: string;
  maxDate: string;
  meals: DiaryMeal[];
  templates: TemplateSummary[];
};

/** Comidas del día con sus acciones (editar, mover, duplicar, copiar, plantillas, vaciar). */
export function DiaryMeals({ date, today, maxDate, meals, templates }: DiaryMealsProps) {
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const close = () => setDialog(null);
  const mealOptions: MealOption[] = meals.map((m) => ({ mealType: m.mealType, customName: m.customName, label: m.label }));

  return (
    <>
      <div className="flex flex-col gap-4">
        {meals.map((meal) => (
          <MealSection
            key={mealKey(meal)}
            meal={meal}
            date={date}
            hasTemplates={templates.length > 0}
            onAction={(state) => {
              if (state?.type === "edit") setEditOpen(true);
              setDialog(state);
            }}
          />
        ))}
        <Button variant="outline" onClick={() => setDialog({ type: "newMeal" })} className="self-start">
          <Plus aria-hidden="true" />
          Agregar otra comida
        </Button>
      </div>

      <ItemEditSheet
        item={dialog?.type === "edit" ? dialog.item : null}
        open={editOpen && dialog?.type === "edit"}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) close();
        }}
      />
      {dialog?.type === "move" ? (
        <MoveDialog
          item={dialog.item}
          options={mealOptions.filter((_, i) => meals[i]!.id !== dialog.item.mealLogId)}
          onClose={close}
        />
      ) : null}
      {dialog?.type === "deleteItem" ? (
        <ConfirmDialog
          title={`¿Eliminar ${dialog.item.name}?`}
          description="Se quita de tu diario. Puedes volver a registrarlo cuando quieras."
          confirmLabel="Eliminar"
          onClose={close}
          run={() => deleteItemAction({ itemId: dialog.item.id })}
          success="Eliminado del diario"
        />
      ) : null}
      {dialog?.type === "copy" ? <CopyMealDialog meal={dialog.meal} date={date} today={today} maxDate={maxDate} onClose={close} /> : null}
      {dialog?.type === "saveTemplate" ? <SaveTemplateDialog meal={dialog.meal} date={date} onClose={close} /> : null}
      {dialog?.type === "applyTemplate" ? (
        <ApplyTemplateDialog meal={dialog.meal} date={date} templates={templates} onClose={close} />
      ) : null}
      {dialog?.type === "clear" && dialog.meal.id ? (
        <ConfirmDialog
          title={`¿Vaciar ${dialog.meal.label}?`}
          description={`Se quitan los ${dialog.meal.items.length} registros de esta comida en este día.`}
          confirmLabel="Vaciar"
          onClose={close}
          run={() => clearMealAction({ mealLogId: dialog.meal.id! })}
          success="Comida vaciada"
        />
      ) : null}
      {dialog?.type === "deleteMeal" && dialog.meal.id ? (
        <ConfirmDialog
          title={`¿Eliminar la comida «${dialog.meal.label}»?`}
          description={
            dialog.meal.items.length
              ? `Se elimina la comida de este día con sus ${dialog.meal.items.length} registros.`
              : "Se elimina la comida de este día."
          }
          confirmLabel="Eliminar comida"
          onClose={close}
          run={() => deleteCustomMealAction({ mealLogId: dialog.meal.id! })}
          success="Comida eliminada"
        />
      ) : null}
      {dialog?.type === "newMeal" ? <NewMealDialog date={date} onClose={close} /> : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Sección de comida                                                            */
/* -------------------------------------------------------------------------- */

function MealSection({
  meal,
  date,
  hasTemplates,
  onAction,
}: {
  meal: DiaryMeal;
  date: string;
  hasTemplates: boolean;
  onAction: (state: DialogState) => void;
}) {
  const headingId = React.useId();
  const addHref = `/app/agregar/buscar?${logTargetQuery({ localDate: date, mealType: meal.mealType, customName: meal.customName })}`;
  const empty = meal.items.length === 0;

  return (
    <section aria-labelledby={headingId} className="rounded-2xl border border-border bg-card shadow-sm">
      <header className="flex items-center gap-2 px-4 pb-2 pt-3">
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="truncate text-base font-semibold tracking-tight">
            {meal.label}
          </h2>
          <p className="text-sm text-muted-foreground" data-numeric="">
            {empty
              ? "Sin registros"
              : `${formatNumber(meal.kcal)} kcal · P ${formatNumber(meal.proteinG)} g · C ${formatNumber(meal.carbsG)} g · G ${formatNumber(meal.fatG)} g`}
          </p>
        </div>
        <Button asChild variant="secondary" size="icon-sm" className="rounded-full">
          <Link href={addHref} aria-label={`Agregar a ${meal.label}`}>
            <Plus aria-hidden="true" />
          </Link>
        </Button>
        {(!empty || hasTemplates || meal.mealType === "custom") && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label={`Más acciones de ${meal.label}`}>
                <EllipsisVertical aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!empty ? (
                <>
                  <DropdownMenuItem onSelect={() => onAction({ type: "copy", meal })}>
                    <CalendarPlus aria-hidden="true" />
                    Copiar a otro día
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onAction({ type: "saveTemplate", meal })}>
                    <BookmarkPlus aria-hidden="true" />
                    Guardar como plantilla
                  </DropdownMenuItem>
                </>
              ) : null}
              {hasTemplates ? (
                <DropdownMenuItem onSelect={() => onAction({ type: "applyTemplate", meal })}>
                  <LayoutTemplate aria-hidden="true" />
                  Aplicar plantilla
                </DropdownMenuItem>
              ) : null}
              {!empty || meal.mealType === "custom" ? <DropdownMenuSeparator /> : null}
              {!empty ? (
                <DropdownMenuItem variant="destructive" onSelect={() => onAction({ type: "clear", meal })}>
                  <Eraser aria-hidden="true" />
                  Vaciar comida
                </DropdownMenuItem>
              ) : null}
              {meal.mealType === "custom" && meal.id ? (
                <DropdownMenuItem variant="destructive" onSelect={() => onAction({ type: "deleteMeal", meal })}>
                  <Trash2 aria-hidden="true" />
                  Eliminar comida
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {empty ? (
        <div className="px-4 pb-4">
          <Link
            href={addHref}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <UtensilsCrossed className="size-4" aria-hidden="true" />
            Agregar a {meal.label.toLowerCase()}
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {meal.items.map((item) => (
            <MealItemRow key={item.id} item={item} onAction={onAction} />
          ))}
        </ul>
      )}
    </section>
  );
}

function decimalsFor(value: number): number {
  if (Number.isInteger(value)) return 0;
  return Number.isInteger(Math.round(value * 1000) / 100) ? 1 : 2;
}

function quantityLabel(item: DiaryItem): string {
  const qty = formatNumber(item.quantity, decimalsFor(item.quantity));
  if (item.unit === "g") return formatGrams(item.quantity, decimalsFor(item.quantity));
  const grams = item.grams ? ` (${formatGrams(item.grams, 0)})` : "";
  return `${qty} ${item.unit}${grams}`;
}

function MealItemRow({ item, onAction }: { item: DiaryItem; onAction: (state: DialogState) => void }) {
  const [pending, startTransition] = React.useTransition();
  const isFavorite = Boolean(item.food?.isFavorite);

  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, success: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error?.message ?? "No se pudo completar.");
      else toast.success(success);
    });

  return (
    <li className={cn("flex items-start gap-1 py-1 pl-4 pr-2", pending && "opacity-60")} aria-busy={pending || undefined}>
      <button
        type="button"
        onClick={() => onAction({ type: "edit", item })}
        className="min-w-0 flex-1 rounded-lg py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="sr-only">Editar cantidad: </span>
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block font-medium leading-snug">
              {item.name}
              {isFavorite ? <Star className="ml-1 inline size-3.5 -translate-y-px fill-primary stroke-primary-strong" aria-label="Favorito" /> : null}
            </span>
            <span className="block truncate text-sm text-muted-foreground">
              {item.brandName ? `${item.brandName} · ` : ""}
              {quantityLabel(item)}
            </span>
          </span>
          <span className="shrink-0 text-right font-semibold" data-numeric="">
            {formatNumber(item.energyKcal)} <span className="text-xs font-normal text-muted-foreground">kcal</span>
          </span>
        </span>
        <span className="mt-1 block text-xs text-muted-foreground" data-numeric="">
          P {formatNumber(item.proteinG, 1)} g · C {formatNumber(item.carbsG, 1)} g · G {formatNumber(item.fatG, 1)} g
          {item.fiberG != null ? ` · Fibra ${formatNumber(item.fiberG, 1)} g` : ""}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {item.isAi ? (
            <Badge variant="soft">
              <Sparkles aria-hidden="true" />
              IA
            </Badge>
          ) : null}
          {item.isEstimate && !item.isAi ? <Badge variant="outline">Estimación</Badge> : null}
          <span className="min-w-0">{item.provenance}</span>
        </span>
      </button>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" className="mt-1 rounded-full" aria-label={`Acciones de ${item.name}`} disabled={pending}>
            <EllipsisVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onAction({ type: "edit", item })}>
            <Pencil aria-hidden="true" />
            Editar cantidad
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onAction({ type: "move", item })}>
            <ArrowRightLeft aria-hidden="true" />
            Mover a otra comida
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => run(() => duplicateItemAction({ itemId: item.id }), "Duplicado")}>
            <Copy aria-hidden="true" />
            Duplicar
          </DropdownMenuItem>
          {item.foodId && item.food ? (
            <DropdownMenuItem
              onSelect={() =>
                run(
                  () => setFavoriteFoodAction({ foodId: item.foodId!, favorite: !isFavorite }),
                  isFavorite ? "Quitado de favoritos" : "Agregado a favoritos",
                )
              }
            >
              <Star aria-hidden="true" />
              {isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
            </DropdownMenuItem>
          ) : null}
          {item.recipeSlug ? (
            <DropdownMenuItem asChild>
              <Link href={`/app/recetas/${item.recipeSlug}`}>
                <UtensilsCrossed aria-hidden="true" />
                Ver receta
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => onAction({ type: "deleteItem", item })}>
            <Trash2 aria-hidden="true" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Diálogos                                                                     */
/* -------------------------------------------------------------------------- */

type RunResult = { ok: true } | { ok: false; error: { message: string } };

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  run,
  success,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  run: () => Promise<RunResult>;
  success: string;
  onClose: () => void;
}) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await run();
                if (!res.ok) {
                  toast.error(res.error.message);
                  return;
                }
                toast.success(success);
                onClose();
              })
            }
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({ item, options, onClose }: { item: DiaryItem; options: MealOption[]; onClose: () => void }) {
  const [value, setValue] = React.useState<string>("");
  const [pending, startTransition] = React.useTransition();
  const target = parseMealKey(value);
  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover {item.name}</DialogTitle>
          <DialogDescription>Elige la comida de este mismo día.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!target) return;
            startTransition(async () => {
              const res = await moveItemAction({ itemId: item.id, mealType: target.mealType, customName: target.customName });
              if (!res.ok) {
                toast.error(res.error.message);
                return;
              }
              toast.success(`Movido a ${res.data.mealLabel}`);
              onClose();
            });
          }}
        >
          <RadioGroup value={value} onValueChange={setValue} aria-label="Comida de destino" className="grid gap-1">
            {options.map((o) => {
              const key = mealKey(o);
              const optionId = `move-${key}`;
              return (
                <Label
                  key={key}
                  htmlFor={optionId}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border px-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
                >
                  <RadioGroupItem id={optionId} value={key} />
                  {o.label}
                </Label>
              );
            })}
          </RadioGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending} disabled={!target}>
              Mover
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CopyMealDialog({
  meal,
  date,
  today,
  maxDate,
  onClose,
}: {
  meal: DiaryMeal;
  date: string;
  today: string;
  maxDate: string;
  onClose: () => void;
}) {
  const id = React.useId();
  const router = useRouter();
  const suggestions = [...new Set([today, addDays(date, 1), maxDate].filter((d) => d !== date && d <= maxDate))];
  const [target, setTarget] = React.useState(suggestions[0] ?? today);
  const [pending, startTransition] = React.useTransition();
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(target) && target <= maxDate && target >= "2000-01-01";
  const dayName = (d: string) => dayLabel(d, today);

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copiar {meal.label.toLowerCase()}</DialogTitle>
          <DialogDescription>
            Se copian sus {meal.items.length} registros a la misma comida del día que elijas, con los valores actuales de la base.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid || !meal.id) return;
            startTransition(async () => {
              const res = await copyMealAction({ mealLogId: meal.id!, targetDate: target });
              if (!res.ok) {
                toast.error(res.error.message);
                return;
              }
              toast.success(`${res.data.copied} registros copiados a ${dayName(res.data.targetDate).toLowerCase()}`, {
                action: { label: "Ver", onClick: () => router.push(`/app/diario/${res.data.targetDate}`) },
              });
              onClose();
            });
          }}
        >
          {suggestions.length ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Atajos de fecha">
              {suggestions.map((d) => (
                <Button
                  key={d}
                  type="button"
                  size="sm"
                  variant={target === d ? "default" : "outline"}
                  aria-pressed={target === d}
                  onClick={() => setTarget(d)}
                >
                  {dayName(d)}
                </Button>
              ))}
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor={`${id}-date`}>Fecha de destino</Label>
            <Input
              id={`${id}-date`}
              type="date"
              value={target}
              min="2000-01-01"
              max={maxDate}
              onChange={(e) => setTarget(e.target.value)}
              aria-invalid={!valid || undefined}
            />
            {!valid ? <p className="text-sm text-destructive">Elige una fecha hasta mañana.</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending} disabled={!valid}>
              Copiar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SaveTemplateDialog({ meal, date, onClose }: { meal: DiaryMeal; date: string; onClose: () => void }) {
  const id = React.useId();
  const [name, setName] = React.useState(`${meal.label} del ${formatShortDate(date)}`.slice(0, 80));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const manual = meal.items.filter((i) => !i.foodId && !i.recipeId).length;
  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Guardar como plantilla</DialogTitle>
          <DialogDescription>
            Podrás aplicar esta comida otro día en un toque.
            {manual ? ` Los ${manual} registros manuales o sin alimento de la base no se incluyen.` : ""}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!meal.id) return;
            startTransition(async () => {
              const res = await saveTemplateAction({ mealLogId: meal.id!, name });
              if (!res.ok) {
                setError(res.error.fieldErrors?.name?.[0] ?? res.error.message);
                return;
              }
              toast.success(
                res.data.skipped ? `Plantilla guardada (${res.data.skipped} registros no se incluyeron)` : "Plantilla guardada",
              );
              onClose();
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor={`${id}-name`}>Nombre</Label>
            <Input
              id={`${id}-name`}
              value={name}
              maxLength={80}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
            />
            {error ? (
              <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending} disabled={!name.trim()}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ApplyTemplateDialog({
  meal,
  date,
  templates,
  onClose,
}: {
  meal: DiaryMeal;
  date: string;
  templates: TemplateSummary[];
  onClose: () => void;
}) {
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();
  const [removed, setRemoved] = React.useState<Set<string>>(new Set());
  const visible = templates.filter((t) => !removed.has(t.id));
  // Las de esta misma comida primero.
  const sorted = [...visible].sort((a, b) => Number(b.mealType === meal.mealType) - Number(a.mealType === meal.mealType));

  const apply = (t: TemplateSummary) => {
    setPendingId(t.id);
    startTransition(async () => {
      const res = await applyTemplateAction({ templateId: t.id, localDate: date, mealType: meal.mealType, customName: meal.customName });
      setPendingId(null);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(
        res.data.skipped
          ? `${res.data.added} agregados a ${meal.label} (${res.data.skipped} ya no están disponibles)`
          : `${res.data.added} agregados a ${meal.label}`,
      );
      onClose();
    });
  };

  const remove = (t: TemplateSummary) => {
    setPendingId(t.id);
    startTransition(async () => {
      const res = await deleteTemplateAction({ templateId: t.id });
      setPendingId(null);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setRemoved((prev) => new Set(prev).add(t.id));
      toast.success("Plantilla eliminada");
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !pendingId && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aplicar plantilla a {meal.label.toLowerCase()}</DialogTitle>
          <DialogDescription>Se registran sus alimentos con los valores actuales de la base.</DialogDescription>
        </DialogHeader>
        {sorted.length ? (
          <ul className="grid gap-2">
            {sorted.map((t) => (
              <li key={t.id} className="flex items-center gap-2 rounded-xl border border-border p-2 pl-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.itemsCount} {t.itemsCount === 1 ? "alimento" : "alimentos"}
                  </p>
                </div>
                <Button size="sm" onClick={() => apply(t)} loading={pendingId === t.id} disabled={pendingId !== null}>
                  Aplicar
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="rounded-full"
                  aria-label={`Eliminar plantilla ${t.name}`}
                  onClick={() => remove(t)}
                  disabled={pendingId !== null}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No te quedan plantillas. Guarda una desde el menú de cualquier comida.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewMealDialog({ date, onClose }: { date: string; onClose: () => void }) {
  const id = React.useId();
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva comida</DialogTitle>
          <DialogDescription>Por ejemplo «Media mañana» o «Post entreno». Se crea para este día.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const res = await createCustomMealAction({ localDate: date, name });
              if (!res.ok) {
                setError(res.error.fieldErrors?.name?.[0] ?? res.error.message);
                return;
              }
              toast.success("Comida creada");
              onClose();
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor={`${id}-name`}>Nombre</Label>
            <Input
              id={`${id}-name`}
              value={name}
              maxLength={60}
              autoFocus
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
            />
            {error ? (
              <p id={`${id}-error`} role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending} disabled={!name.trim()}>
              Crear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
