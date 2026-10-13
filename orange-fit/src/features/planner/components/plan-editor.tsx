"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeftRight,
  CalendarCheck,
  FileDown,
  NotebookPen,
  Plus,
  RefreshCw,
  RotateCcw,
  Scale,
  ShoppingBasket,
  Trash2,
  Utensils,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { addDays } from "@/lib/dates";
import { formatNumber, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LogToDiaryDialog } from "@/features/recipes/components/log-to-diary-dialog";
import { generateShoppingListAction } from "@/features/shopping/actions";
import { deletePlanAction, logPlanItemAction, savePlanAction, setPlanStatusAction } from "../actions";
import type { SavePlanInput } from "../schemas";
import { computeDraftDiagnostics, dayLabelFor } from "../lib/diagnostics";
import {
  foodItem,
  itemsWithPositions,
  planSlots,
  recipeItem,
  regenerateDay,
  slotItems,
  swapAlternatives,
  updateItemAmount,
  type FoodForPlan,
} from "../lib/plan";
import { PLAN_STATUS_LABELS, type DraftItem, type PlanDraft, type PlanRecipeOption, type PlanStatus } from "../lib/types";
import { PlanDiagnostics } from "./plan-diagnostics";
import { AmountDialog, FoodPickerDialog, RecipePickerDialog, SwapDialog } from "./plan-item-dialogs";
import { SharePlanDialog } from "./share-plan-dialog";

type Picker = { kind: "recipe" | "food"; slotIndex: number } | null;

const snapshot = (d: PlanDraft) =>
  JSON.stringify({
    name: d.name,
    startDate: d.startDate,
    items: d.items.map((i) => [i.id, i.dayIndex, i.slotIndex, i.recipeId, i.foodId, i.servings, i.grams]),
  });

function amountText(it: DraftItem): string {
  return it.kind === "recipe"
    ? `${formatNumber(it.servings ?? 1, Number.isInteger(it.servings ?? 1) ? 0 : 2)} ${it.servings === 1 ? "porción" : "porciones"}`
    : `${formatNumber(it.grams ?? 0)} g`;
}

/**
 * Editor del plan (nuevo o guardado). Todo cambio es local hasta "Guardar": entonces el servidor
 * recalcula los nutrientes desde la base y reemplaza las comidas del plan.
 */
export function PlanEditor({
  initialDraft,
  pool,
  planId,
  shareToken,
  today,
  tomorrow,
  canRegenerate,
  canExport,
  canShop,
  floorNote,
}: {
  initialDraft: PlanDraft;
  pool: PlanRecipeOption[];
  planId: string | null;
  shareToken: string | null;
  today: string;
  tomorrow: string;
  canRegenerate: boolean;
  canExport: boolean;
  canShop: boolean;
  floorNote?: string | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = React.useState(initialDraft);
  const [saved] = React.useState(() => snapshot(initialDraft));
  const dirty = !planId || snapshot(draft) !== saved;
  const [selectedDay, setSelectedDay] = React.useState(() => {
    const idx = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${initialDraft.startDate}T00:00:00Z`)) / 86_400_000);
    return idx >= 0 && idx < initialDraft.days ? idx : 0;
  });
  const [picker, setPicker] = React.useState<Picker>(null);
  const [swapKey, setSwapKey] = React.useState<string | null>(null);
  const [amountKey, setAmountKey] = React.useState<string | null>(null);
  const [logKey, setLogKey] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [foodData, setFoodData] = React.useState<Record<string, FoodForPlan["per100g"]>>({});
  const [pending, startTransition] = React.useTransition();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const slots = planSlots(draft.params.mealsPerDay);
  const diagnostics = React.useMemo(() => computeDraftDiagnostics(draft), [draft]);
  const findItem = (key: string | null) => (key ? (draft.items.find((i) => i.key === key) ?? null) : null);
  const swapItem = findItem(swapKey);
  const amountItem = findItem(amountKey);
  const logItem = findItem(logKey);
  const orphanCount = draft.items.filter((i) => !i.recipeId && !i.foodId).length;

  // Aviso al salir con cambios sin guardar.
  React.useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const update = (fn: (d: PlanDraft) => PlanDraft) => setDraft((d) => fn(d));
  const replaceItem = (key: string, next: DraftItem) => update((d) => ({ ...d, items: d.items.map((i) => (i.key === key ? next : i)) }));
  const removeItem = (key: string) => update((d) => ({ ...d, items: d.items.filter((i) => i.key !== key) }));

  const save = () => {
    setError(null);
    const items = itemsWithPositions(draft).filter((i) => i.recipeId || i.foodId);
    setBusy("save");
    startTransition(async () => {
      const res = await savePlanAction({
        planId,
        name: draft.name.trim() || "Mi plan",
        startDate: draft.startDate,
        days: draft.days,
        generator: draft.generator,
        params: { ...draft.params, dietPattern: draft.params.dietPattern as SavePlanInput["params"]["dietPattern"] },
        items: items.map((i) => ({
          dayIndex: i.dayIndex,
          slotIndex: i.slotIndex,
          mealType: slots[i.slotIndex]?.mealType ?? "snack",
          recipeId: i.recipeId,
          foodId: i.recipeId ? null : i.foodId,
          servings: i.recipeId ? i.servings : null,
          grams: i.recipeId ? null : i.grams,
        })),
      });
      setBusy(null);
      if (!res.ok) {
        setError(res.error.message);
        toast.error(res.error.message);
        return;
      }
      toast.success(planId ? "Cambios guardados" : "Plan guardado");
      if (planId) router.refresh();
      else router.push(`/app/plan/${res.data.id}`);
    });
  };

  const setStatus = (status: PlanStatus) => {
    if (!planId) return;
    setBusy(status);
    startTransition(async () => {
      const res = await setPlanStatusAction({ planId, status });
      setBusy(null);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(
        status === "active"
          ? res.data.archivedOthers
            ? "Plan activado. Tu plan anterior pasó a archivados."
            : "Plan activado"
          : status === "archived"
            ? "Plan archivado"
            : "Plan en borrador",
      );
      router.refresh();
    });
  };

  const createShoppingList = () => {
    if (!planId) return;
    setBusy("shop");
    startTransition(async () => {
      const res = await generateShoppingListAction({ planId });
      setBusy(null);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success(res.data.unpriced ? `Lista creada (${res.data.unpriced} ítems sin precio referencial)` : "Lista creada");
      router.push(`/app/compras/${res.data.id}`);
    });
  };

  const regenerate = (dayIndex: number) => {
    try {
      update((d) => regenerateDay(d, dayIndex, pool));
      toast.success(`Regeneramos el día ${dayIndex + 1}. Recuerda guardar.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo regenerar el día.");
    }
  };

  const dayItems = draft.items.filter((i) => i.dayIndex === selectedDay);
  const dayDiag = diagnostics.days[selectedDay];
  const planDate = (dayIndex: number) => addDays(draft.startDate, dayIndex);

  return (
    <div className="flex flex-col gap-6 pb-40 lg:pb-24">
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm" aria-labelledby="datos-plan">
        <h2 id="datos-plan" className="sr-only">
          Datos del plan
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={draft.status === "active" ? "default" : "secondary"}>{PLAN_STATUS_LABELS[draft.status]}</Badge>
          <Badge variant="outline">{draft.generator === "engine" ? "Generado sin IA" : "Armado a mano"}</Badge>
          {dirty && planId ? <Badge variant="warning">Cambios sin guardar</Badge> : null}
          {!planId ? <Badge variant="warning">Sin guardar</Badge> : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <div className="flex flex-col gap-2">
            <Label htmlFor="plan-name">Nombre</Label>
            <Input id="plan-name" value={draft.name} maxLength={120} onChange={(e) => update((d) => ({ ...d, name: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="plan-start">Empieza</Label>
            <Input id="plan-start" type="date" value={draft.startDate} onChange={(e) => e.target.value && update((d) => ({ ...d, startDate: e.target.value }))} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {draft.days} {draft.days === 1 ? "día" : "días"}: del {formatShortDate(draft.startDate)} al {formatShortDate(planDate(draft.days - 1))} · {slots.length} comidas por día
        </p>
      </section>

      <PlanDiagnostics diagnostics={diagnostics} generation={draft.params.generation} selectedDay={selectedDay} onSelectDay={setSelectedDay} floorNote={floorNote} />

      <section aria-labelledby="dia-detalle" className="flex flex-col gap-4">
        <nav aria-label="Días del plan" className="-mx-4 overflow-x-auto px-4 scrollbar-none lg:mx-0 lg:px-0">
          <ul className="flex gap-2">
            {Array.from({ length: draft.days }, (_, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setSelectedDay(i)}
                  aria-current={selectedDay === i ? "true" : undefined}
                  className={cn(
                    "flex h-14 min-w-16 flex-col items-center justify-center rounded-2xl border px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selectedDay === i ? "border-primary bg-accent font-semibold text-accent-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span>Día {i + 1}</span>
                  <span className="text-xs">{formatShortDate(planDate(i)).split(" ").slice(0, 2).join(" ")}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="dia-detalle" className="text-lg font-semibold tracking-tight">
              {dayLabelFor(draft.startDate, selectedDay)}
            </h2>
            {dayDiag ? (
              <p className="text-sm text-muted-foreground tabular-nums">
                {formatNumber(dayDiag.kcal)} kcal{dayDiag.targetKcal ? ` de ${formatNumber(dayDiag.targetKcal)}` : ""} · {formatNumber(dayDiag.proteinG)} g proteína
              </p>
            ) : null}
          </div>
          {canRegenerate ? (
            <Button type="button" variant="outline" size="sm" onClick={() => regenerate(selectedDay)}>
              <RefreshCw aria-hidden="true" />
              Regenerar este día
            </Button>
          ) : null}
        </div>

        <ol className="flex flex-col gap-3">
          {slots.map((slot) => {
            const items = slotItems({ items: dayItems }, selectedDay, slot.index);
            const slotTarget = draft.params.targetKcal ? Math.round(draft.params.targetKcal * slot.share) : null;
            return (
              <li key={slot.index} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{slot.label}</h3>
                  {slotTarget ? <span className="text-xs text-muted-foreground tabular-nums">~{formatNumber(slotTarget)} kcal sugeridas</span> : null}
                </div>
                {items.length === 0 ? <p className="text-sm text-muted-foreground">Sin asignar.</p> : null}
                <ul className="flex flex-col divide-y divide-border">
                  {items.map((it) => {
                    const canLog = Boolean(planId && it.id && !dirty && (it.recipeId || it.foodId));
                    return (
                      <li key={it.key} className="flex flex-col gap-2 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            {it.slug ? (
                              <Link href={`/app/recetas/${it.slug}`} className="font-medium underline-offset-4 hover:underline">
                                {it.name}
                              </Link>
                            ) : (
                              <p className="font-medium">{it.name}</p>
                            )}
                            <p className="text-sm text-muted-foreground tabular-nums">
                              {amountText(it)} · {formatNumber(it.kcal)} kcal · {formatNumber(it.proteinG, 1)} g proteína
                            </p>
                          </div>
                        </div>
                        <div className="-ml-2 flex flex-wrap gap-1">
                          {it.kind === "recipe" && it.recipeId ? (
                            <Button type="button" variant="ghost" size="sm" onClick={() => setSwapKey(it.key)}>
                              <ArrowLeftRight aria-hidden="true" className="size-4" />
                              Cambiar
                            </Button>
                          ) : null}
                          {it.recipeId || it.foodId ? (
                            <Button type="button" variant="ghost" size="sm" onClick={() => setAmountKey(it.key)}>
                              <Scale aria-hidden="true" className="size-4" />
                              {it.kind === "recipe" ? "Porciones" : "Cantidad"}
                            </Button>
                          ) : null}
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(it.key)} aria-label={`Quitar ${it.name}`}>
                            <Trash2 aria-hidden="true" className="size-4" />
                            Quitar
                          </Button>
                          {planId ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={!canLog}
                              title={canLog ? undefined : "Guarda los cambios para registrar"}
                              onClick={() => setLogKey(it.key)}
                            >
                              <NotebookPen aria-hidden="true" className="size-4" />
                              Registrar esta comida
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setPicker({ kind: "recipe", slotIndex: slot.index })}>
                    <Plus aria-hidden="true" className="size-4" />
                    Receta
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPicker({ kind: "food", slotIndex: slot.index })}>
                    <Utensils aria-hidden="true" className="size-4" />
                    Alimento
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
        {planId && dirty ? <p className="text-xs text-muted-foreground">Para registrar comidas en tu diario, primero guarda los cambios.</p> : null}
      </section>

      {planId ? (
        <section aria-labelledby="acciones-plan" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <h2 id="acciones-plan" className="text-base font-semibold">
            Acciones
          </h2>
          {dirty ? <p className="text-sm text-muted-foreground">Guarda los cambios para activar, exportar, compartir o crear la lista de compras.</p> : null}
          <div className="flex flex-wrap gap-2">
            {draft.status !== "active" ? (
              <Button type="button" disabled={dirty || pending} loading={busy === "active"} onClick={() => setStatus("active")}>
                <CalendarCheck aria-hidden="true" />
                {draft.status === "archived" ? "Reactivar" : "Activar plan"}
              </Button>
            ) : null}
            {draft.status !== "archived" ? (
              <Button type="button" variant="outline" disabled={dirty || pending} loading={busy === "archived"} onClick={() => setStatus("archived")}>
                <Archive aria-hidden="true" />
                Archivar
              </Button>
            ) : (
              <Button type="button" variant="outline" disabled={dirty || pending} loading={busy === "draft"} onClick={() => setStatus("draft")}>
                <RotateCcw aria-hidden="true" />
                Volver a borrador
              </Button>
            )}
            {canExport ? (
              dirty ? (
                <Button type="button" variant="outline" disabled>
                  <FileDown aria-hidden="true" />
                  Exportar PDF
                </Button>
              ) : (
                <Button asChild variant="outline">
                  <a href={`/api/plan/${planId}/pdf`} download>
                    <FileDown aria-hidden="true" />
                    Exportar PDF
                  </a>
                </Button>
              )
            ) : (
              <Button asChild variant="outline">
                <Link href="/app/premium">
                  <FileDown aria-hidden="true" />
                  Exportar PDF (Premium)
                </Link>
              </Button>
            )}
            {canShop ? (
              <Button type="button" variant="outline" disabled={dirty || pending} loading={busy === "shop"} onClick={createShoppingList}>
                <ShoppingBasket aria-hidden="true" />
                Lista de compras
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/app/premium">
                  <ShoppingBasket aria-hidden="true" />
                  Lista de compras (Premium)
                </Link>
              </Button>
            )}
            {!dirty ? <SharePlanDialog planId={planId} initialToken={shareToken} /> : null}
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden="true" />
              Eliminar
            </Button>
          </div>
        </section>
      ) : null}

      {dirty ? (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+9rem)] z-30 px-4 lg:bottom-6 lg:left-72">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 rounded-2xl border border-border bg-popover/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center">
            <p className="flex-1 text-sm" role="status">
              {planId ? "Tienes cambios sin guardar." : "Revisa el plan y guárdalo para usarlo."}
              {orphanCount ? ` Se quitarán ${orphanCount} comidas cuya receta ya no está disponible.` : ""}
              {error ? <span className="block font-medium text-destructive">{error}</span> : null}
            </p>
            <div className="flex gap-2">
              {planId ? (
                <Button type="button" variant="ghost" className="flex-1 sm:flex-none" onClick={() => setDraft(initialDraft)} disabled={pending}>
                  Descartar
                </Button>
              ) : null}
              <Button type="button" className="flex-1 sm:flex-none" onClick={save} loading={busy === "save"} disabled={pending}>
                {planId ? "Guardar cambios" : "Guardar plan"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <RecipePickerDialog
        open={picker?.kind === "recipe"}
        onOpenChange={(o) => !o && setPicker(null)}
        slot={picker ? (slots[picker.slotIndex] ?? null) : null}
        slotTargetKcal={picker && draft.params.targetKcal ? draft.params.targetKcal * (slots[picker.slotIndex]?.share ?? 0) : null}
        pool={pool}
        params={draft.params}
        onPick={(recipe, servings) => {
          if (!picker) return;
          const slotIndex = picker.slotIndex;
          update((d) => ({ ...d, items: [...d.items, recipeItem(recipe, servings, selectedDay, slotIndex)] }));
        }}
      />
      <FoodPickerDialog
        open={picker?.kind === "food"}
        onOpenChange={(o) => !o && setPicker(null)}
        slot={picker ? (slots[picker.slotIndex] ?? null) : null}
        onPick={(food, grams) => {
          if (!picker) return;
          const slotIndex = picker.slotIndex;
          setFoodData((m) => ({ ...m, [food.id]: food.per100g }));
          update((d) => ({ ...d, items: [...d.items, foodItem({ id: food.id, name: food.name, per100g: food.per100g }, grams, selectedDay, slotIndex)] }));
        }}
      />
      <SwapDialog
        open={Boolean(swapItem)}
        onOpenChange={(o) => !o && setSwapKey(null)}
        item={swapItem}
        options={swapItem ? swapAlternatives(draft, swapItem, pool) : []}
        onPick={(o) => swapItem && replaceItem(swapItem.key, recipeItem(o.recipe, o.servings, swapItem.dayIndex, swapItem.slotIndex, swapItem.key))}
      />
      <AmountDialog
        open={Boolean(amountItem)}
        onOpenChange={(o) => !o && setAmountKey(null)}
        item={amountItem}
        onSave={(amount) => amountItem && replaceItem(amountItem.key, updateItemAmount(amountItem, amount, pool, amountItem.foodId ? foodData[amountItem.foodId] : undefined))}
      />
      {logItem && planId ? (
        <LogToDiaryDialog
          open={Boolean(logItem)}
          onOpenChange={(o) => !o && setLogKey(null)}
          title={logItem.name}
          description={`${logItem.name} · ${amountText(logItem)} (${formatNumber(logItem.kcal)} kcal)`}
          defaultDate={planDate(logItem.dayIndex) <= tomorrow ? planDate(logItem.dayIndex) : today}
          maxDate={tomorrow}
          defaultMeal={slots[logItem.slotIndex]?.mealType ?? "snack"}
          servingsEditable={false}
          amountLabel={amountText(logItem)}
          onSubmit={(v) => logPlanItemAction({ itemId: logItem.id!, localDate: v.localDate, mealType: v.mealType })}
        />
      ) : null}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar este plan?</DialogTitle>
            <DialogDescription>
              No se puede deshacer. Lo que ya registraste en tu diario se conserva. Si lo compartiste, el enlace dejará de funcionar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={busy === "delete"}
              onClick={() => {
                if (!planId) return;
                setBusy("delete");
                startTransition(async () => {
                  const res = await deletePlanAction({ planId });
                  setBusy(null);
                  if (!res.ok) {
                    toast.error(res.error.message);
                    return;
                  }
                  toast.success("Plan eliminado");
                  router.push("/app/plan");
                });
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
