"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { formatKg, formatNumber, formatShortDate } from "@/lib/format";
import { deleteMeasurementAction, deleteWeightAction } from "../actions";
import { BODY_FAT_METHOD_LABELS, MEASUREMENT_FIELDS, type BodyFatMethod } from "../schemas";
import type { MeasurementRecord, WeightLogRow } from "../server/progress";

type Pending = { kind: "weight" | "measurement"; id: string; label: string } | null;

const VISIBLE = 10;

function ConfirmDelete({ pending, onClose }: { pending: Pending; onClose: () => void }) {
  const [busy, startTransition] = React.useTransition();
  function confirm() {
    if (!pending) return;
    startTransition(async () => {
      const res = pending.kind === "weight" ? await deleteWeightAction(pending.id) : await deleteMeasurementAction(pending.id);
      if (!res.ok) toast.error(res.error.message);
      else toast.success("Registro borrado.");
      onClose();
    });
  }
  return (
    <Dialog open={pending !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Borrar este registro?</DialogTitle>
          <DialogDescription>{pending?.label}. Esta acción no se puede deshacer.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button variant="destructive" onClick={confirm} loading={busy}>
            Borrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WeightHistory({ rows }: { rows: WeightLogRow[] }) {
  const [pending, setPending] = React.useState<Pending>(null);
  const [all, setAll] = React.useState(false);
  const sorted = [...rows].sort((a, b) => b.local_date.localeCompare(a.local_date));
  const shown = all ? sorted : sorted.slice(0, VISIBLE);
  if (sorted.length === 0) return <p className="text-sm text-muted-foreground">Aún no hay pesajes.</p>;
  return (
    <div className="grid gap-2">
      <ul className="grid gap-1">
        {shown.map((w) => (
          <li key={w.id} className="flex min-h-12 items-center gap-3 rounded-xl px-2">
            <span className="w-24 shrink-0 text-sm text-muted-foreground">{formatShortDate(w.local_date)}</span>
            <span className="flex-1" data-numeric="">
              <span className="font-medium">{formatKg(w.weight_kg)}</span>
              {w.body_fat_pct != null ? (
                <span className="block text-xs text-muted-foreground">
                  {formatNumber(w.body_fat_pct, 1)} % grasa (estimación
                  {w.body_fat_method && w.body_fat_method in BODY_FAT_METHOD_LABELS
                    ? `, ${BODY_FAT_METHOD_LABELS[w.body_fat_method as BodyFatMethod].toLowerCase()}`
                    : ""}
                  )
                </span>
              ) : null}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full text-muted-foreground"
              aria-label={`Borrar pesaje del ${formatShortDate(w.local_date)}`}
              onClick={() => setPending({ kind: "weight", id: w.id, label: `Pesaje del ${formatShortDate(w.local_date)} (${formatKg(w.weight_kg)})` })}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      {sorted.length > VISIBLE ? (
        <Button variant="ghost" size="sm" onClick={() => setAll((v) => !v)} className="justify-self-start">
          {all ? "Ver menos" : `Ver los ${sorted.length} pesajes`}
        </Button>
      ) : null}
      <ConfirmDelete pending={pending} onClose={() => setPending(null)} />
    </div>
  );
}

export function MeasurementHistory({ rows }: { rows: MeasurementRecord[] }) {
  const [pending, setPending] = React.useState<Pending>(null);
  const [all, setAll] = React.useState(false);
  const sorted = [...rows].sort((a, b) => b.local_date.localeCompare(a.local_date));
  const shown = all ? sorted : sorted.slice(0, VISIBLE);
  if (sorted.length === 0) return <p className="text-sm text-muted-foreground">Aún no hay medidas registradas.</p>;
  return (
    <div className="grid gap-2">
      <ul className="grid gap-2">
        {shown.map((m) => {
          const values = MEASUREMENT_FIELDS.filter((f) => m[f.column] != null).map((f) => `${f.label} ${formatNumber(Number(m[f.column]), 1)}`);
          return (
            <li key={m.id} className="flex items-start gap-3 rounded-xl px-2 py-1">
              <span className="w-24 shrink-0 pt-2.5 text-sm text-muted-foreground">{formatShortDate(m.local_date)}</span>
              <span className="flex-1 pt-2.5 text-sm" data-numeric="">
                {values.join(" · ")} cm
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full text-muted-foreground"
                aria-label={`Borrar medidas del ${formatShortDate(m.local_date)}`}
                onClick={() => setPending({ kind: "measurement", id: m.id, label: `Medidas del ${formatShortDate(m.local_date)}` })}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          );
        })}
      </ul>
      {sorted.length > VISIBLE ? (
        <Button variant="ghost" size="sm" onClick={() => setAll((v) => !v)} className="justify-self-start">
          {all ? "Ver menos" : `Ver los ${sorted.length} registros`}
        </Button>
      ) : null}
      <ConfirmDelete pending={pending} onClose={() => setPending(null)} />
    </div>
  );
}
