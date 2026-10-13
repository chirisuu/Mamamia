"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Share2, Trash2, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { formatMoney } from "@/lib/format";
import { SHOPPING_CATEGORIES, type ShoppingCategory } from "@/lib/nutrition";
import { cn } from "@/lib/utils";
import {
  addManualShoppingItemAction,
  deleteShoppingItemAction,
  deleteShoppingListAction,
  toggleShoppingItemAction,
  updateShoppingItemAction,
  updateShoppingListAction,
} from "../actions";
import { quantityLabel, shoppingListText } from "../lib/build";
import { listTotals } from "../lib/totals";
import type { ShoppingItemView, ShoppingListDetail } from "../queries";
import { SHOPPING_UNITS } from "../schemas";

const CATEGORY_LABEL = Object.fromEntries(SHOPPING_CATEGORIES.map((c) => [c.code, c.label])) as Record<ShoppingCategory, string>;

function parseNum(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Lista de compras: marcar comprado, editar cantidad y precio (queda como precio tuyo), agregar
 * ítems, presupuesto vs total y compartir como texto. Los precios de la base son referenciales.
 */
export function ShoppingListView({ list }: { list: ShoppingListDetail }) {
  const router = useRouter();
  const [items, setItems] = React.useState<ShoppingItemView[]>(() => list.categories.flatMap((c) => c.items));
  const [budget, setBudget] = React.useState(list.budget);
  const [name, setName] = React.useState(list.name);
  const [editing, setEditing] = React.useState<ShoppingItemView | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [editingList, setEditingList] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const totals = listTotals(items, budget);
  const checked = items.filter((i) => i.checked).length;
  const grouped = SHOPPING_CATEGORIES.map((c) => ({
    ...c,
    items: items.filter((i) => i.category === c.code).sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name, "es")),
  })).filter((c) => c.items.length > 0);

  const toggle = (item: ShoppingItemView, next: boolean) => {
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, checked: next } : i)));
    startTransition(async () => {
      const res = await toggleShoppingItemAction({ itemId: item.id, checked: next });
      if (!res.ok) {
        setItems((list) => list.map((i) => (i.id === item.id ? { ...i, checked: !next } : i)));
        toast.error(res.error.message);
      }
    });
  };

  const share = async () => {
    const text = shoppingListText({ name, currency: list.currency, categories: grouped, total: totals.total, partial: totals.unpricedCount > 0 });
    try {
      if (navigator.share) {
        await navigator.share({ title: name, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast.success("Lista copiada: pégala donde quieras");
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("No se pudo compartir. Inténtalo de nuevo.");
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-10">
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm" aria-labelledby="resumen-lista">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 id="resumen-lista" className="truncate text-base font-semibold">
              {name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {checked} de {items.length} comprados
              {list.planId && list.planName ? (
                <>
                  {" · "}
                  <Link href={`/app/plan/${list.planId}`} className="font-medium text-primary-strong underline-offset-4 hover:underline">
                    {list.planName}
                  </Link>
                </>
              ) : null}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar nombre y presupuesto" onClick={() => setEditingList(true)}>
            <Pencil aria-hidden="true" />
          </Button>
        </div>
        <dl className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted px-3 py-2">
            <dt className="text-xs text-muted-foreground">Total referencial</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {totals.total != null ? formatMoney(totals.total, list.currency) : "—"}
              {totals.unpricedCount > 0 && totals.total != null ? <span className="text-xs font-normal text-muted-foreground"> (parcial)</span> : null}
            </dd>
          </div>
          <div className="rounded-xl bg-muted px-3 py-2">
            <dt className="text-xs text-muted-foreground">Presupuesto</dt>
            <dd className="text-lg font-semibold tabular-nums">{budget != null ? formatMoney(budget, list.currency) : "Sin definir"}</dd>
          </div>
        </dl>
        <div className="flex flex-col gap-1 text-sm" role="status">
          {totals.overBudget === true && budget != null && totals.total != null ? (
            <p>El total referencial supera tu presupuesto por {formatMoney(totals.total - budget, list.currency)}. Puedes ajustar cantidades o cambiar recetas del plan.</p>
          ) : totals.overBudget === false && budget != null && totals.total != null ? (
            <p>Dentro de tu presupuesto (te quedan {formatMoney(budget - totals.total, list.currency)}).</p>
          ) : null}
          {totals.unpricedCount > 0 ? (
            <p className="text-muted-foreground">
              {totals.unpricedCount === 1 ? "1 ítem no tiene" : `${totals.unpricedCount} ítems no tienen`} precio: el total es parcial. Puedes escribir el precio que pagaste.
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">Precios referenciales, no en tiempo real: pueden variar según el mercado o la tienda.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            Agregar ítem
          </Button>
          <Button type="button" variant="outline" onClick={share} disabled={items.length === 0}>
            <Share2 aria-hidden="true" />
            Compartir como texto
          </Button>
        </div>
      </section>

      {grouped.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">La lista está vacía. Agrega lo que necesites.</p>
      ) : (
        grouped.map((cat) => (
          <section key={cat.code} aria-labelledby={`cat-${cat.code}`} className="flex flex-col gap-2">
            <h3 id={`cat-${cat.code}`} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {cat.label}
            </h3>
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
              {cat.items.map((item) => {
                const id = `chk-${item.id}`;
                return (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-2">
                    <Checkbox id={id} checked={item.checked} onCheckedChange={(v) => toggle(item, v === true)} />
                    <label htmlFor={id} className={cn("min-w-0 flex-1 cursor-pointer py-2", item.checked && "text-muted-foreground line-through")}>
                      <span className="block font-medium">{item.name}</span>
                      <span className="block text-sm text-muted-foreground tabular-nums">
                        {quantityLabel(item.quantity, item.unit) || "Sin cantidad"}
                        {" · "}
                        {item.estimatedPrice != null ? (
                          <>
                            {formatMoney(item.estimatedPrice, list.currency)}
                            <span className="text-xs"> {item.priceSource === "user" ? "(tu precio)" : "(referencial)"}</span>
                          </>
                        ) : (
                          <span>sin precio</span>
                        )}
                      </span>
                    </label>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar ${item.name}`} onClick={() => setEditing(item)}>
                      <Pencil aria-hidden="true" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      <div className="border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)}>
          <Trash2 aria-hidden="true" />
          Eliminar lista
        </Button>
      </div>

      <ItemDialog
        item={editing}
        currency={list.currency}
        onClose={() => setEditing(null)}
        onSaved={(next) => setItems((list) => list.map((i) => (i.id === next.id ? next : i)))}
        onDeleted={(id) => setItems((list) => list.filter((i) => i.id !== id))}
      />
      <AddItemDialog
        open={adding}
        listId={list.id}
        currency={list.currency}
        onOpenChange={setAdding}
        onAdded={(item) => setItems((list) => [...list, item])}
      />
      <ListDialog
        open={editingList}
        onOpenChange={setEditingList}
        listId={list.id}
        name={name}
        budget={budget}
        currency={list.currency}
        onSaved={(n, b) => {
          setName(n);
          setBudget(b);
        }}
      />
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar esta lista?</DialogTitle>
            <DialogDescription>No se puede deshacer. Tu plan no cambia y puedes crear otra lista cuando quieras.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await deleteShoppingListAction({ listId: list.id });
                  if (!res.ok) return void toast.error(res.error.message);
                  toast.success("Lista eliminada");
                  router.push("/app/compras");
                })
              }
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UnitSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Sin unidad</SelectItem>
        {SHOPPING_UNITS.map((u) => (
          <SelectItem key={u} value={u}>
            {u === "unidad" ? "unidades" : u}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ItemDialog({
  item,
  currency,
  onClose,
  onSaved,
  onDeleted,
}: {
  item: ShoppingItemView | null;
  currency: string;
  onClose: () => void;
  onSaved: (item: ShoppingItemView) => void;
  onDeleted: (id: string) => void;
}) {
  const [qty, setQty] = React.useState("");
  const [unit, setUnit] = React.useState("none");
  const [price, setPrice] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [lastId, setLastId] = React.useState<string | null>(null);
  if ((item?.id ?? null) !== lastId) {
    setLastId(item?.id ?? null);
    if (item) {
      setQty(item.quantity == null ? "" : String(item.quantity));
      setUnit(item.unit && (SHOPPING_UNITS as readonly string[]).includes(item.unit) ? item.unit : "none");
      setPrice(item.estimatedPrice == null ? "" : String(item.estimatedPrice));
      setError(null);
    }
  }
  const originalPrice = item?.estimatedPrice == null ? "" : String(item.estimatedPrice);

  return (
    <Dialog open={Boolean(item)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item?.name}</DialogTitle>
          <DialogDescription>Si escribes un precio, se guarda como tu precio (no referencial).</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!item) return;
            const q = parseNum(qty);
            const p = parseNum(price);
            if (Number.isNaN(q) || (q != null && q <= 0)) return setError("La cantidad debe ser un número mayor que 0.");
            if (Number.isNaN(p) || (p != null && p < 0)) return setError("El precio debe ser un número válido.");
            const priceEdited = price.trim() !== originalPrice;
            setError(null);
            startTransition(async () => {
              const res = await updateShoppingItemAction({
                itemId: item.id,
                quantity: q,
                unit: unit === "none" ? null : (unit as (typeof SHOPPING_UNITS)[number]),
                estimatedPrice: p,
                priceEdited,
              });
              if (!res.ok) return setError(res.error.message);
              onSaved({
                ...item,
                quantity: q,
                unit: unit === "none" ? null : unit,
                estimatedPrice: priceEdited ? p : item.estimatedPrice,
                priceSource: priceEdited ? (p == null ? null : "user") : item.priceSource,
              });
              toast.success("Ítem actualizado");
              onClose();
            });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="item-qty">Cantidad</Label>
              <Input id="item-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="item-unit">Unidad</Label>
              <UnitSelect id="item-unit" value={unit} onChange={setUnit} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="item-price">Precio ({currency})</Label>
            <Input id="item-price" inputMode="decimal" placeholder="Sin precio" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          {error ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                item &&
                startTransition(async () => {
                  const res = await deleteShoppingItemAction({ itemId: item.id });
                  if (!res.ok) return setError(res.error.message);
                  onDeleted(item.id);
                  toast.success("Ítem quitado");
                  onClose();
                })
              }
            >
              <Trash2 aria-hidden="true" />
              Quitar
            </Button>
            <Button type="submit" loading={pending}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddItemDialog({
  open,
  onOpenChange,
  listId,
  currency,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  listId: string;
  currency: string;
  onAdded: (item: ShoppingItemView) => void;
}) {
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<ShoppingCategory>("other");
  const [qty, setQty] = React.useState("");
  const [unit, setUnit] = React.useState("none");
  const [price, setPrice] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar ítem</DialogTitle>
          <DialogDescription>Algo que necesitas además de lo del plan.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const q = parseNum(qty);
            const p = parseNum(price);
            if (!name.trim()) return setError("Escribe qué vas a comprar.");
            if (Number.isNaN(q) || (q != null && q <= 0)) return setError("La cantidad debe ser un número mayor que 0.");
            if (Number.isNaN(p) || (p != null && p < 0)) return setError("El precio debe ser un número válido.");
            setError(null);
            startTransition(async () => {
              const u = unit === "none" ? null : (unit as (typeof SHOPPING_UNITS)[number]);
              const res = await addManualShoppingItemAction({ listId, name: name.trim(), category, quantity: q, unit: u, estimatedPrice: p });
              if (!res.ok) return setError(res.error.message);
              onAdded({
                id: res.data.id,
                foodId: null,
                name: name.trim(),
                category,
                quantity: q,
                unit: u,
                checked: false,
                estimatedPrice: p,
                priceSource: p == null ? null : "user",
                position: 9999,
              });
              toast.success("Ítem agregado");
              setName("");
              setQty("");
              setPrice("");
              setUnit("none");
              onOpenChange(false);
            });
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-item-name">Qué</Label>
            <Input id="new-item-name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} placeholder="Ej.: detergente, limones" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-item-cat">Categoría</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ShoppingCategory)}>
              <SelectTrigger id="new-item-cat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHOPPING_CATEGORIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {CATEGORY_LABEL[c.code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-item-qty">Cantidad</Label>
              <Input id="new-item-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-item-unit">Unidad</Label>
              <UnitSelect id="new-item-unit" value={unit} onChange={setUnit} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-item-price">Precio ({currency}, opcional)</Label>
            <Input id="new-item-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          {error ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Agregar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ListDialog({
  open,
  onOpenChange,
  listId,
  name,
  budget,
  currency,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  listId: string;
  name: string;
  budget: number | null;
  currency: string;
  onSaved: (name: string, budget: number | null) => void;
}) {
  const [n, setN] = React.useState(name);
  const [b, setB] = React.useState(budget == null ? "" : String(budget));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setN(name);
      setB(budget == null ? "" : String(budget));
      setError(null);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nombre y presupuesto</DialogTitle>
          <DialogDescription>El presupuesto se compara con el total referencial de la lista.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const value = parseNum(b);
            if (!n.trim()) return setError("Ponle un nombre.");
            if (Number.isNaN(value) || (value != null && value < 0)) return setError("El presupuesto debe ser un número válido.");
            setError(null);
            startTransition(async () => {
              const res = await updateShoppingListAction({ listId, name: n.trim(), budget: value });
              if (!res.ok) return setError(res.error.message);
              onSaved(n.trim(), value);
              toast.success("Lista actualizada");
              onOpenChange(false);
            });
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="list-name">Nombre</Label>
            <Input id="list-name" value={n} maxLength={120} onChange={(e) => setN(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="list-budget" className="gap-1.5">
              <Wallet className="size-4" aria-hidden="true" />
              Presupuesto ({currency}, opcional)
            </Label>
            <Input id="list-budget" inputMode="decimal" value={b} onChange={(e) => setB(e.target.value)} placeholder="Sin presupuesto" />
          </div>
          {error ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ListProgressBadge({ checked, total }: { checked: number; total: number }) {
  return <Badge variant={checked === total && total > 0 ? "success" : "secondary"}>{total ? `${checked}/${total}` : "Vacía"}</Badge>;
}
